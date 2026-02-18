import {
  AutoModel,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";

const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX";
let model: PreTrainedModel | null = null;
let tokenizer: PreTrainedTokenizer | null = null;
let device: "webgpu" | "wasm" | null = null;

self.onmessage = async (event) => {
  const { type, payload } = event.data;
  if (type === "load-model") {
    try {
      // Only use webgpu if available
      let isWebGPUAvailable = false;
      if (navigator.gpu) {
        try {
          isWebGPUAvailable = !!(await navigator.gpu.requestAdapter());
        } catch {}
      }
      device = isWebGPUAvailable ? "webgpu" : "wasm";
      tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
      model = await AutoModel.from_pretrained(MODEL_ID, {
        device,
        dtype: "q4",
        model_file_name: isWebGPUAvailable ? "model_no_gather" : "model",
        progress_callback: (progress) => {
          if (
            progress.status === "progress" &&
            progress.file.endsWith(".onnx_data")
          ) {
            const percentage = Math.round(
              (progress.loaded / progress.total) * 100,
            );
            self.postMessage({
              type: "progress",
              payload: {
                percentage,
                status: `Loading model... ${percentage}%`,
              },
            });
          }
        },
      });
      self.postMessage({ type: "ready", payload: { device } });
    } catch (error) {
      self.postMessage({
        type: "error",
        payload: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (type === "embed" && model && tokenizer) {
    try {
      const { sentences, options } = payload;
      const inputs = tokenizer(sentences, options);
      const { sentence_embedding } = await model(inputs);
      const embeddings = sentence_embedding.tolist();
      self.postMessage({ type: "embeddings", payload: { embeddings } });
    } catch (error) {
      self.postMessage({
        type: "error",
        payload: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
