import { pipeline, TextStreamer } from '@huggingface/transformers'

class MySummarizationPipeline {
  static task = 'summarization'
  static model = 'Xenova/distilbart-cnn-6-6'
  static instance = null

  static async getInstance(progress_callback = null) {
    this.instance ??= pipeline(this.task, this.model, {
      progress_callback,
      dtype: 'q8',
    })
    return this.instance
  }
}

self.addEventListener('message', async (event) => {
  const summarizer = await MySummarizationPipeline.getInstance((progressData) => {
    self.postMessage(progressData)
  })

  const streamer = new TextStreamer(summarizer.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: function (text) {
      self.postMessage({
        status: 'update',
        output: text,
      })
    },
  })

  const output = await summarizer(event.data.text, {
    max_length: 100,
    min_length: 10,

    streamer,
  })

  self.postMessage({
    status: 'complete',
    output,
  })
})
