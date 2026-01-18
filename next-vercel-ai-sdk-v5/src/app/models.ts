import { WorkerLoadOptions } from "@built-in-ai/transformers-js";

export interface ModelConfig extends Omit<WorkerLoadOptions, "modelId"> {
  id: string;
  name: string;
  supportsWorker?: boolean;
}

export const MODELS: ModelConfig[] = [
  {
    id: "HuggingFaceTB/SmolLM2-360M-Instruct",
    name: "SmolLM2 360M",
    device: "webgpu",
    dtype: "q4",
    supportsWorker: true,
  },
  {
    id: "onnx-community/gemma-3-270m-it-ONNX",
    name: "Gemma 3 270M",
    dtype: "fp32",
    supportsWorker: false,
  },
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    name: "Qwen3 0.6B",
    device: "webgpu",
    dtype: "q4f16",
    supportsWorker: true,
  },
  {
    id: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
    name: "Llama 3.2 1B",
    device: "webgpu",
    supportsWorker: true,
  },
  {
    id: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
    name: "Deepseek R1 Distill 1.5B",
    device: "webgpu",
    dtype: "q4f16",
  },
  {
    id: "HuggingFaceTB/SmolVLM-256M-Instruct",
    name: "SmolVLM 256M (Vision)",
    device: "webgpu",
    dtype: "fp32",
    isVisionModel: true,
    supportsWorker: true,
  },
];
