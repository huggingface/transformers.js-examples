// worker.js
// Runs the text-generation pipeline in a separate thread with streaming updates.

import { pipeline, TextStreamer } from '@huggingface/transformers'

let textGenerationPipeline = null

// Initialize the pipeline (Singleton style)
async function getTextGenerationPipeline(progressCallback) {
  if (!textGenerationPipeline) {
    textGenerationPipeline = await pipeline(
      'text-generation',
      'Xenova/LiteLlama-460M-1T',
      {
        dtype: 'q8',
        model_file_name: 'decoder_model_merged',
        progress_callback: progressCallback,
      }
    )
  }
  return textGenerationPipeline
}

// Listen for messages from the main script
self.addEventListener('message', async (event) => {
  const { type, prompt, max_new_tokens } = event.data

  if (type === 'generate') {
    // 1) Load the pipeline if necessary
    const pipe = textGenerationPipeline
    // Create text streamer
    const streamer = new TextStreamer(pipe.tokenizer, {
      skip_prompt: true,
      callback_function: (text) => {
        self.postMessage({
          status: 'update',
          output: text,
        })
      },
    })
    await pipe(prompt, { max_new_tokens, streamer, repetition_penalty: 10.0 })

    // 3) Send final output
    self.postMessage({
      status: 'complete',
    })
  } else if (type === 'init') {
    await getTextGenerationPipeline((status) => {
      self.postMessage(status)
    })
  }
})
