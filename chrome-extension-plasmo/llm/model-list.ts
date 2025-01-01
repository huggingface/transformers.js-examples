import type { ModelConfig } from "~/src/types"

const modelList: ModelConfig[] = [
  {
    task: "text-generation",
    model_id: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: false
  },
  {
    task: "text-generation",
    model_id: "onnx-community/Llama-3.2-3B-Instruct",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: true
  },
  {
    task: "text-generation",
    model_id: "onnx-community/gemma-2-2b-jpn-it",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: true
  },
  {
    task: "text-generation",
    model_id: "onnx-community/Phi-3.5-mini-instruct-onnx-web",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: true
  },
  {
    task: "text-generation",
    model_id: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: false
  },
  {
    task: "text-generation",
    model_id: "onnx-community/Qwen2.5-0.5B-Instruct",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: false
  },
  {
    task: "text-generation",
    model_id: "onnx-community/Qwen2.5-1.5B-Instruct",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: false
  },
  {
    task: "text-generation",
    model_id: "onnx-community/Qwen2.5-Coder-3B-Instruct",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: true
  },
  {
    task: "text-generation",
    model_id: "onnx-community/Qwen2.5-Coder-1.5B-Instruct",
    dtype: "q4f16",
    device: "webgpu",
    use_external_data_format: false
  }
]

export { modelList }
