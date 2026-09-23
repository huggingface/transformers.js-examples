// background.js - Handles requests from the UI, runs the model, then sends back a response
import { env, pipeline } from "@huggingface/transformers";
import { ACTION_NAME, CONTEXT_MENU_ITEM_ID } from "./constants.js";

// Firefox Manifest V2 returns promises only from the browser namespace, so
// every awaited call goes through it when it exists.
const ext = globalThis.browser ?? chrome;

console.log(
  "[From the background context] Hello from the background worker/script!",
);

// Browser compatibility handling for sidebar functionality
const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === "firefox" ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === "gecko-based";

const isSafariLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === "safari" ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === "webkit-based";

// Safari has no side panel surface, so the sidebar page opens in a tab.
let sidebarTabId;

function openSidebarTab() {
  const url = chrome.runtime.getURL("sidebar/index.html");

  const openNewTab = () => {
    chrome.tabs.create({ url }, (tab) => {
      sidebarTabId = tab?.id;
    });
  };

  // A repeat click focuses the tab already opened instead of a new copy.
  const knownTabId = sidebarTabId;

  if (knownTabId === undefined) {
    openNewTab();

    return;
  }

  chrome.tabs.update(knownTabId, { active: true }, () => {
    if (chrome.runtime.lastError) openNewTab();
  });
}

if (isFirefoxLike) {
  browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.open();
  });
} else if (isSafariLike) {
  // Safari never had setPanelBehavior, so the toolbar click needs a listener.
  chrome.action?.onClicked.addListener(() => {
    openSidebarTab();
  });
} else {
  // setPanelBehavior only affects FUTURE action clicks — registering it
  // inside onClicked would swallow the first toolbar click.
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
}

// If you'd like to use a local model instead of loading the model
// from the Hugging Face Hub, you can remove this line.
env.allowLocalModels = false;

// In a page context transformers.js points onnxruntime at jsDelivr, which the
// extension CSP blocks. Unset, onnxruntime loads the WASM this build bundles.
env.backends.onnx.wasm.wasmPaths = undefined;

/**
 * Wrap the pipeline construction in a small manager to ensure:
 * (1) each pipeline is only loaded once, and
 * (2) the pipeline can be loaded lazily (only when needed).
 *
 * It keeps one pipeline per configuration, and reads the active configuration
 * from storage, which is what the side panel's model settings write to.
 */
function configKey(cfg) {
  const safe = {
    task: cfg.task,
    model: cfg.model,
    device: cfg.device,
    dtype: cfg.dtype,
  };

  return JSON.stringify(safe);
}

// Build a cache entry whose `fn` lazily instantiates the pipeline on first use
// and serializes calls through a single promise chain.
function createCachedRunner(cfg, progress_callback) {
  const entry = {};

  entry.fn = async (...args) => {
    entry.instance ||= pipeline(cfg.task, cfg.model, {
      progress_callback,
      device: cfg.device,
      dtype: cfg.dtype,
    });

    entry.promise_chain = (entry.promise_chain || Promise.resolve()).then(
      async () => {
        const runner = await entry.instance;

        return runner(...args);
      },
    );

    return entry.promise_chain;
  };

  return entry;
}

class ModelManager {
  constructor() {
    this.cache = new Map();
    this.currentKey = null;
    this.currentConfig = null;
    this.ready = this.loadInitial();
    ext.storage.onChanged.addListener(this.onStorageChanged.bind(this));
  }

  async loadInitial() {
    const { modelConfig } = await ext.storage.sync.get("modelConfig");
    this.currentConfig = modelConfig || {
      task: "text-classification",
      model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
      device: "webgpu",
      dtype: "q4",
    };

    this.currentKey = configKey(this.currentConfig);
  }

  onStorageChanged(changes, area) {
    if (area !== "sync" || !changes.modelConfig) return;

    this.currentConfig = changes.modelConfig.newValue;
    this.currentKey = configKey(this.currentConfig);
    // Lazy rebuild: next call uses the new key; cache retains previous instance
  }

  async getRunner(progress_callback) {
    await this.ready;
    const key = this.currentKey;

    if (!this.cache.has(key)) {
      this.cache.set(
        key,
        createCachedRunner(this.currentConfig, progress_callback),
      );
    }

    return this.cache.get(key).fn;
  }
}

const models = new ModelManager();

// Create generic classify function, which will be reused for the different types of events.
const classify = async (text) => {
  // Get the pipeline for the active configuration. This will load and build
  // the model when run for the first time.
  const classifier = await models.getRunner(() => {
    // You can track the progress of the pipeline creation here.
    // e.g., you can send the progress data back to the UI for a progress bar
    // console.log(data)
  });

  // Run the model on the input text
  const result = await classifier(text);

  return result;
};

// Ask the active tab's content script for either the full page context or
// the current selection. Mirrors the ai-* templates' relay pattern.
async function relayActiveTabRequest(messageType) {
  const [tab] = await ext.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (!tab?.id) {
    return { ok: false, error: "No active tab" };
  }

  try {
    const context = await ext.tabs.sendMessage(tab.id, { type: messageType });

    if (!context) {
      return { ok: false, error: "No context received from page" };
    }

    return { ok: true, context };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    return { ok: false, error };
  }
}

////////////////////// 1. Context Menus //////////////////////
//
// Add a listener to create the initial context menu items,
// context menu items only need to be created at runtime.onInstalled
ext.runtime.onInstalled.addListener(() => {
  // Register a context menu item that will only show up for selection text.
  try {
    ext.contextMenus.create({
      id: CONTEXT_MENU_ITEM_ID,
      title: 'Classify "%s"',
      contexts: ["selection"],
    });
  } catch (error) {
    console.warn("[transformers-js] contextMenus.create failed", error);
  }
});

// Perform inference when the user clicks a context menu, then broadcast the
// result so an open side panel shows it next to the page.
ext.contextMenus?.onClicked.addListener(async (info) => {
  // Ignore context menu clicks that are not for classifications (or when there is no input)
  const text = info.selectionText?.trim();
  if (info.menuItemId !== CONTEXT_MENU_ITEM_ID || !text) return;

  try {
    const result = await classify(text);
    ext.runtime.sendMessage({
      action: "classification-broadcast",
      ok: true,
      text,
      result,
    });
  } catch (e) {
    ext.runtime.sendMessage({
      action: "classification-broadcast",
      ok: false,
      error: e?.message || "classification failed",
    });
  }
});
//////////////////////////////////////////////////////////////

////////////////////// 2. Message Events /////////////////////
//
// Listen for messages from the UI, process it, and send the result back.
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTION_NAME) {
    // Run model prediction asynchronously
    (async function () {
      try {
        // Perform classification
        const result = await classify(message.text);

        // Send response back to UI
        sendResponse(result);
      } catch (e) {
        sendResponse({ error: e?.message || "classification failed" });
      }
    })();

    // return true to indicate we will send a response asynchronously
    return true;
  }

  // The side panel asks for the active page's text or selection, which the
  // content script reads. A panel cannot message a tab on its own.
  if (
    message.action === "getActiveTabContext" ||
    message.action === "getActiveTabSelection"
  ) {
    const messageType =
      message.action === "getActiveTabSelection"
        ? "getSelection"
        : "getPageContext";

    (async () => sendResponse(await relayActiveTabRequest(messageType)))();

    return true;
  }
});
//////////////////////////////////////////////////////////////
