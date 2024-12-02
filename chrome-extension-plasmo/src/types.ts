import {
  DATA_TYPES,
  DEVICE_TYPES
} from "@huggingface/transformers/src/utils/dtypes"

interface Message {
  role: "user" | "assistant"
  content: string
  metadata?: string
}

interface ProgressItem {
  file: string
  progress: number
  total: number
}

interface ModelConfig {
  task: string
  model_id: string
  dtype: DATA_TYPES
  device: DEVICE_TYPES
  use_external_data_format: boolean
}

export type { Message, ProgressItem, ModelConfig }
