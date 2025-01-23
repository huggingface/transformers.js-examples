import {
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  InterruptableStoppingCriteria,
  load_image,
} from "@huggingface/transformers";

const MAX_NEW_TOKENS = 1024;

/**
 * Helper function to perform feature detection for WebGPU
 */
let fp16_supported = false;
async function check() {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU is not supported (no adapter found)");
    }
    fp16_supported = adapter.features.has("shader-f16");
  } catch (e) {
    self.postMessage({
      status: "error",
      data: e.toString(),
    });
  }
}

/**
 * This class uses the Singleton pattern to enable lazy-loading of the pipeline
 */
class SmolVLM {
  static model_id = "HuggingFaceTB/SmolVLM-256M-Instruct";

  static async getInstance(progress_callback = null) {
    this.processor ??= AutoProcessor.from_pretrained(this.model_id, {
      progress_callback,
    });

    this.model ??= AutoModelForVision2Seq.from_pretrained(this.model_id, {
      dtype: "fp32",
      device: "webgpu",
      progress_callback,
    });

    return Promise.all([this.processor, this.model]);
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();

let past_key_values_cache = null;
async function generate(messages) {
  // For this demo, we only respond to the last message
  messages = messages.slice(-1);

  // Retrieve the text-generation pipeline.
  const [processor, model] = await SmolVLM.getInstance();

  // Load all images
  const images = await Promise.all(
    messages
      .map((x) => x.content)
      .flat(Infinity)
      .filter((msg) => msg.image !== undefined)
      .map((msg) => load_image(msg.image)),
  );

  // Prepare inputs
  const text = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  });
  const inputs = await processor(text, images, {
    // Set `do_image_splitting: true` to split images into multiple patches.
    // NOTE: This uses more memory, but can provide more accurate results.
    // do_image_splitting: false,
  });

  let startTime;
  let numTokens = 0;
  let tps;
  const token_callback_function = (tokens) => {
    startTime ??= performance.now();

    if (numTokens++ > 0) {
      tps = (numTokens / (performance.now() - startTime)) * 1000;
    }
  };
  const callback_function = (output) => {
    self.postMessage({
      status: "update",
      output,
      tps,
      numTokens,
    });
  };

  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function,
    token_callback_function,
  });

  // Tell the main thread we are starting
  self.postMessage({ status: "start" });

  const { past_key_values, sequences } = await model
    .generate({
      ...inputs,
      // TODO: Add back when fixed
      // past_key_values: past_key_values_cache,

      // Sampling
      do_sample: false,
      repetition_penalty: 1.1,
      // top_k: 3,
      // temperature: 0.2,

      max_new_tokens: MAX_NEW_TOKENS,
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
    })
    .catch((e) => {
      self.postMessage({
        status: "error",
        data: e.toString(),
      });
    });
  past_key_values_cache = past_key_values;

  const decoded = processor.batch_decode(sequences, {
    skip_special_tokens: true,
  });

  // Send the output back to the main thread
  self.postMessage({
    status: "complete",
    output: decoded,
  });
}

async function load() {
  self.postMessage({
    status: "loading",
    data: "Loading model...",
  });

  // Load the pipeline and save it for future use.
  const [processor, model] = await SmolVLM.getInstance((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  });

  self.postMessage({ status: "ready" });
}
// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "check":
      check();
      break;

    case "load":
      load();
      break;

    case "generate":
      stopping_criteria.reset();
      generate(data);
      break;

    case "interrupt":
      stopping_criteria.interrupt();
      break;

    case "reset":
      past_key_values_cache = null;
      stopping_criteria.reset();
      break;
  }
});
