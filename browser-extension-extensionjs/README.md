# Transformers.js - Cross-browser extension

An example project to show how to run 🤗 Transformers in a browser extension that builds for Chrome, Edge, and Firefox from a single source, using [Extension.js](https://extension.js.org).

It is the same demo as the [browser-extension](../browser-extension/) example: type text, and the sentiment classification prints below it. Here the UI lives in a side panel next to the page, so it can also classify the page text or your selection, and a right-click menu entry classifies selected text. Inference runs locally: the model is fetched from the Hugging Face Hub on first use, then cached.

## Getting Started

1. Clone the repo and enter the project directory:

   ```bash
   git clone https://github.com/huggingface/transformers.js-examples.git
   cd transformers.js-examples/browser-extension-extensionjs/
   ```

1. Install the necessary dependencies:

   ```bash
   npm install
   ```

1. Start the development browser:

   ```bash
   npm run dev
   ```

   This opens a browser with the extension already loaded and reloads it when you edit a file. Use `npm run dev -- --browser=firefox` to develop against Firefox instead.

1. That's it! Click the extension's icon to open the side panel, type some text, and use the model in your browser.

## Building for the stores

```bash
npm run build           # Chrome, output in dist/chrome
npm run build:edge      # Edge, output in dist/edge
npm run build:firefox   # Firefox, output in dist/firefox
```

## Editing the example

All source code is in the `./src/` directory:

- `background.js` ([service worker](https://developer.chrome.com/docs/extensions/mv3/service_workers/)) - handles all the requests from the UI, does processing in the background, then returns the result. It keeps one pipeline per model configuration and registers the context menu entry. It also sets `env.backends.onnx.wasm.wasmPaths` so onnxruntime uses the bundled WASM instead of a CDN, which keeps the extension within its content security policy.

- `content/scripts.js` ([content script](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)) - runs in every page the user visits. It answers the service worker with the page text or the current selection.

- `sidebar/index.html`, `sidebar/styles.css`, `sidebar/SidebarApp.js` ([side panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)) - the panel the user sees when they click the extension's icon: the text box and the output block from the popup example, the page text and selection buttons, and the model settings, which persist in `storage.sync`.

- `manifest.json` - one manifest for every target. Keys that differ between browsers carry a prefix, for example `chromium:manifest_version` and `firefox:manifest_version`, and each build keeps only the keys that apply to it.

Every awaited extension API is called through `globalThis.browser ?? chrome`, so the same code works on Chrome's callback APIs and Firefox's promise-based ones. Edits are picked up by `npm run dev` without reloading the extension by hand.
