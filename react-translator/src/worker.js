import { pipeline, TextStreamer } from "@huggingface/transformers";

/**
 * This class uses the Singleton pattern to ensure that only one instance of the
 * pipeline is loaded. This is because loading the pipeline is an expensive
 * operation and we don't want to do it every time we want to translate a sentence.
 */
class MyTranslationPipeline {
  static task = "translation";
  static model = "Xenova/nllb-200-distilled-600M";
  static instance = null;

  static async getInstance(progress_callback = null) {
    this.instance ??= pipeline(this.task, this.model, {
      progress_callback,
      dtype: "q8",
    });
    return this.instance;
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  // Retrieve the translation pipeline. When called for the first time,
  // this will load the pipeline and save it for future use.
  const translator = await MyTranslationPipeline.getInstance((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  });

  // Capture partial output as it streams from the pipeline
  const streamer = new TextStreamer(translator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: function (text) {
      self.postMessage({
        status: "update",
        output: text,
      });
    },
  });

  // Actually perform the translation
  const output = await translator(event.data.text, {
    tgt_lang: event.data.tgt_lang,
    src_lang: event.data.src_lang,

    // Allows for partial output
    streamer,
  });

  // Send the output back to the main thread
  self.postMessage({
    status: "complete",
    output,
  });
});
