// SidebarApp.js - handles interaction with the extension's side panel, sends
// requests to the service worker (background.js), and updates the panel's UI
// (index.html) on completion.

import { ACTION_NAME } from "../constants.js";
import "./styles.css";

// Firefox Manifest V2 returns promises only from the browser namespace.
const ext = globalThis.browser ?? chrome;

const inputElement = document.getElementById("text");
const outputElement = document.getElementById("output");

// Listen for changes made to the textbox.
inputElement.addEventListener("input", async (event) => {
  // Bundle the input data into a message.
  const message = {
    action: ACTION_NAME,
    text: event.target.value,
  };

  // Send this message to the service worker.
  const response = await ext.runtime.sendMessage(message);

  // Handle results returned by the service worker (`background.js`) and
  // update the panel's UI.
  outputElement.textContent = JSON.stringify(response, null, 2);
});

////////////////////// 1. Active tab //////////////////////
//
// The side panel sits next to a page, so it can classify that page's text or
// selection. The content script reads it, the service worker relays it here
// (a panel cannot message a tab directly), and the textbox runs it through
// the same listener as typed text.
function classify(text) {
  inputElement.value = text;
  inputElement.dispatchEvent(new Event("input"));
}

async function classifyFromActiveTab(action, what) {
  const response = await ext.runtime.sendMessage({ action });
  const text = response?.ok ? response.context?.text || "" : "";

  if (!text) {
    const error = response?.error || `No ${what} found on the active tab`;
    outputElement.textContent = JSON.stringify({ error }, null, 2);

    return;
  }

  classify(text);
}

document.getElementById("use-page").addEventListener("click", () => {
  classifyFromActiveTab("getActiveTabContext", "page text");
});

document.getElementById("use-selection").addEventListener("click", () => {
  classifyFromActiveTab("getActiveTabSelection", "selection");
});

////////////////////// 2. Context menu //////////////////////
//
// A right-click classification runs in the service worker and is broadcast
// back, so an open panel shows the same result as typed text would.
ext.runtime.onMessage.addListener((message) => {
  if (message?.action !== "classification-broadcast") return;

  if (typeof message.text === "string") inputElement.value = message.text;

  const output = message.ok ? message.result : { error: message.error };
  outputElement.textContent = JSON.stringify(output, null, 2);
});

////////////////////// 3. Model settings //////////////////////
//
// The service worker caches one pipeline per configuration and reads the
// active one from storage, so a change here takes effect on the next run.
const DEFAULTS = {
  task: "text-classification",
  model: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
  device: "webgpu",
  dtype: "q4",
};

const MODELS = {
  "text-classification": [
    "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
    "Xenova/mobilebert-uncased-mnli",
  ],
  "token-classification": ["Xenova/bert-base-cased-finetuned-conll03-english"],
  "question-answering": ["Xenova/distilbert-base-cased-distilled-squad"],
  "text-generation": ["Xenova/tiny-stories-1M"],
};

const taskEl = document.getElementById("task");
const modelEl = document.getElementById("model");
const customEl = document.getElementById("customModel");
const deviceEl = document.getElementById("device");
const dtypeEl = document.getElementById("dtype");

function populateModels(taskValue, selected) {
  modelEl.replaceChildren(...MODELS[taskValue].map((m) => new Option(m, m)));

  if (selected && MODELS[taskValue].includes(selected)) {
    modelEl.value = selected;
  }
}

async function loadConfig() {
  taskEl.replaceChildren(...Object.keys(MODELS).map((t) => new Option(t, t)));

  const { modelConfig } = await ext.storage.sync.get("modelConfig");
  const cfg = { ...DEFAULTS, ...(modelConfig || {}) };

  taskEl.value = cfg.task;
  populateModels(cfg.task, cfg.model);
  customEl.value = cfg.customModel || "";
  deviceEl.value = cfg.device;
  dtypeEl.value = cfg.dtype;
}

async function saveConfig() {
  const customModel = customEl.value.trim();

  await ext.storage.sync.set({
    modelConfig: {
      task: taskEl.value,
      model: customModel || modelEl.value,
      customModel: customModel || undefined,
      device: deviceEl.value,
      dtype: dtypeEl.value,
    },
  });
}

// Changing the task re-populates the model list. Every change persists.
taskEl.addEventListener("change", async () => {
  populateModels(taskEl.value);
  await saveConfig();
});

for (const el of [modelEl, customEl, deviceEl, dtypeEl]) {
  el.addEventListener("change", saveConfig);
}

loadConfig();
