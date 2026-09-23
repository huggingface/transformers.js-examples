/** @type {import('extension').FileConfig} */
export default {
  // The production build ships the onnxruntime WebAssembly core (about 21 MiB)
  // at the output root and bundles the Transformers.js pipeline into background.
  perfBudgets: {
    runtime: 32 * 1024 * 1024,
    "service-worker": 1024 * 1024,
  },
};
