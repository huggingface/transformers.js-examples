import type { GenerationConfig } from "@huggingface/transformers/types/generation/configuration_utils"

import type { ModelConfig } from "~/src/types"

const DEFAULT_GENERATION_CONFIG = {
  do_sample: true,
  top_k: 3,
  temperature: 0.2,
  top_p: 0.9,
  max_new_tokens: 512,
  repetition_penalty: 1.0
} as GenerationConfig

const DEFAULT_MODEL_CONFIG = {
  task: "text-generation",
  model_id: "onnx-community/Llama-3.2-1B-Instruct-q4f16",
  dtype: "q4f16",
  device: "webgpu",
  use_external_data_format: false
} as ModelConfig

export { DEFAULT_GENERATION_CONFIG, DEFAULT_MODEL_CONFIG }
