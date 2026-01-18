import { WorkerLoadOptions } from "@built-in-ai/transformers-js";

export interface ModelConfig extends Omit<WorkerLoadOptions, "modelId"> {
  id: string;
  name: string;
  supportsWorker?: boolean;
}

export const MODELS: ModelConfig[] = [
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    name: "Qwen3 0.6B",
    device: "webgpu",
    dtype: "q4f16",
    supportsWorker: true,
  },
  {
    id: "onnx-community/granite-4.0-350m-ONNX-web",
    name: "Granite 4.0 350M",
    device: "webgpu",
    dtype: "fp16",
    supportsWorker: false,
  },
  {
    id: "onnx-community/granite-4.0-micro-ONNX-web",
    name: "Granite 4.0 Micro",
    device: "webgpu",
    dtype: "q4f16",
    supportsWorker: false,
  },
  {
    id: "onnx-community/LFM2-1.2B-Tool-ONNX",
    name: "LFM2 1.2B-Tool",
    device: "webgpu",
    dtype: "fp16",
    supportsWorker: false,
  },
];
