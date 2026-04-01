import { WorkerLoadOptions } from "@browser-ai/transformers-js";

export interface ModelConfig extends Omit<WorkerLoadOptions, "modelId"> {
  id: string;
  name: string;
  supportsWorker?: boolean;
  enableThinking?: boolean;
  prependThinkTag?: boolean; // Some models needs <think> tag to be appended to the assitant messages. We handle this in the chat-transport
  supportsTools?: boolean;
}

export const MODELS: ModelConfig[] = [
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    name: "Qwen3 0.6B",
    device: "webgpu",
    dtype: "q4f16",
    enableThinking: true,
    supportsWorker: true,
    supportsTools: true
  },
  {
    id: "onnx-community/Qwen3.5-0.8B-ONNX",
    name: "Qwen3.5 0.8B",
    device: "webgpu",
    dtype: "q4f16",
    isVisionModel: true,
    enableThinking: true,
    supportsWorker: true,
    prependThinkTag: true,
  },
  {
    id: "LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
    name: "LFM2.5 1.2B Thinking",
    device: "webgpu",
    dtype: "q4",
    supportsWorker: false,
  },
  {
    id: "onnx-community/NVIDIA-Nemotron-3-Nano-4B-BF16-ONNX",
    name: "Nemotron-3-Nano 4B",
    device: "webgpu",
    dtype: "q4",
    enableThinking: true,
    prependThinkTag: true,
  },
    {
    id: "onnx-community/LFM2.5-350M-ONNX",
    name: "LFM2.5 350M",
    device: "webgpu",
    dtype: "q4",
    supportsWorker: true,
    supportsTools: true
  },
  {
    id: "onnx-community/granite-4.0-350m-ONNX-web",
    name: "Granite 4.0 350M",
    device: "webgpu",
    dtype: "fp16",
    supportsWorker: false,
    supportsTools: true    
  },
  {
    id: "onnx-community/granite-4.0-micro-ONNX-web",
    name: "Granite 4.0 Micro",
    device: "webgpu",
    dtype: "q4f16",
    supportsWorker: false,
    supportsTools: true
  },
  {
    id: "onnx-community/LFM2-1.2B-Tool-ONNX",
    name: "LFM2 1.2B-Tool",
    device: "webgpu",
    dtype: "fp16",
    supportsWorker: false,
    supportsTools: true
  },
];
