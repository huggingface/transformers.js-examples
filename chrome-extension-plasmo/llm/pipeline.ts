import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env
} from "@huggingface/transformers"

import { Storage } from "@plasmohq/storage"

import type { ModelConfig } from "~/src/types"

import { DEFAULT_MODEL_CONFIG } from "./default-config"

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
//
// (Note by fs-eire)
// The issue mentioned above is fixed in the latest version of ORT. However, multi-threading is still not working in service workers, because
// of a different issue: https://github.com/whatwg/html/issues/8362
env.backends.onnx.wasm.numThreads = 1

// env.backends.onnx.wasm.wasmPaths =
//   "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/";

// (Note by fs-eire)
// In this example, the .wasm file is included (and processed/renamed by webpack) in the "build" folder. So we don't need to override the wasm path.
//
// However, Transformer.js will set this flag to a CDN path. If we keep the override, the WebAssembly will failed to load because there is a version mismatch.
// ORT only works when the .wasm file and the .mjs file match (they need to be generated from the same build).
//
// So, we need to set this flag to undefined to revert it back to the default behavior.
env.backends.onnx.wasm.wasmPaths = undefined

env.backends.onnx.wasm.proxy = false

const storage = new Storage()

class TextGenerationPipeline {
  static model = null
  static tokenizer = null

  static async getInstance(progress_callback = null) {
    // store original reference
    const originalConsole = self.console

    // override function reference with a new arrow function that does nothing
    self.console.error = () => {}

    /* 
      model_id: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
      dtype: "q4f16",
      device: "webgpu",
      use_external_data_format: false
    */
    const modelConfig: ModelConfig =
      (await storage.get("model_config")) ?? DEFAULT_MODEL_CONFIG

    this.tokenizer ??= AutoTokenizer.from_pretrained(modelConfig.model_id, {
      progress_callback
    })

    this.model ??= AutoModelForCausalLM.from_pretrained(modelConfig.model_id, {
      dtype: modelConfig.dtype,
      device: modelConfig.device,
      use_external_data_format: modelConfig.use_external_data_format,
      progress_callback
    })

    // restore the original function reference, so that console.error() works just as before
    self.console.error = originalConsole.error

    return Promise.all([this.tokenizer, this.model])
  }
}

export { TextGenerationPipeline }
