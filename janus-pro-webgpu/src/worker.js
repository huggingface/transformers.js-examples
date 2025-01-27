import {
  AutoProcessor,
  MultiModalityCausalLM,
  BaseStreamer,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

// Define constants
const IMAGE_GENERATION_COMMAND_PREFIX = "/imagine ";
const MAX_NEW_TEXT_TOKENS = 1024;

/**
 * Helper function to perform WebGPU feature detection
 */
let fp16_supported = false;
async function check() {
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU is not supported (no adapter found)");
    }
    fp16_supported = adapter.features.has("shader-f16");
    self.postMessage({
      status: "success",
      data: fp16_supported,
    });
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
class ImageGenerationPipeline {
  static model_id = "onnx-community/Janus-Pro-1B-ONNX";

  static async getInstance(progress_callback = null) {
    this.processor ??= AutoProcessor.from_pretrained(this.model_id, {
      progress_callback,
    });

    this.model ??= MultiModalityCausalLM.from_pretrained(this.model_id, {
      dtype: fp16_supported
        ? {
            prepare_inputs_embeds: "q4",
            language_model: "q4f16",
            lm_head: "fp16",
            gen_head: "fp16",
            gen_img_embeds: "fp16",
            image_decode: "fp32",
          }
        : {
            prepare_inputs_embeds: "fp32",
            language_model: "q4",
            lm_head: "fp32",
            gen_head: "fp32",
            gen_img_embeds: "fp32",
            image_decode: "fp32",
          },
      device: {
        prepare_inputs_embeds: "wasm", // TODO use "webgpu" when bug is fixed
        language_model: "webgpu",
        lm_head: "webgpu",
        gen_head: "webgpu",
        gen_img_embeds: "webgpu",
        image_decode: "webgpu",
      },
      progress_callback,
    });

    return Promise.all([this.processor, this.model]);
  }
}

class ProgressStreamer extends BaseStreamer {
  constructor(total, on_progress) {
    super();
    this.total = total;
    this.on_progress = on_progress;

    this.count = null;
    this.start_time = null;
  }

  put(value) {
    if (this.count === null) {
      // Ignore the first batch of tokens (prompt)
      this.count = 0;
      this.start_time = performance.now();
      return;
    }

    const progress = ++this.count / this.total;

    this.on_progress({
      count: this.count,
      total: this.total,
      progress,
      time: performance.now() - this.start_time,
    });
  }

  end() {
    /* no nothing */
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();

async function generate(messages) {
  // For this demo, we only respond to the last message
  const message = messages.at(-1);

  // Tell the main thread we are starting
  self.postMessage({ status: "start" });

  // Load the pipeline
  const [processor, model] = await ImageGenerationPipeline.getInstance();

  // Determine if the user wants to generate an image or text
  if (message.content.startsWith(IMAGE_GENERATION_COMMAND_PREFIX)) {
    const text = message.content.replace(IMAGE_GENERATION_COMMAND_PREFIX, "");

    const conversation = [
      {
        role: "<|User|>", // uses title case
        content: text,
      },
    ];
    const inputs = await processor(conversation, {
      chat_template: "text_to_image",
    });

    const callback_function = (output) => {
      self.postMessage({
        status: "image-update",
        ...output,
      });
    };

    const num_image_tokens = processor.num_image_tokens;
    const streamer = new ProgressStreamer(num_image_tokens, callback_function);

    const outputs = await model.generate_images({
      ...inputs,
      min_new_tokens: num_image_tokens,
      max_new_tokens: num_image_tokens,
      do_sample: true,
      streamer,
    });

    const blob = await outputs[0].toBlob();

    // Send the output back to the main thread
    self.postMessage({
      status: "image-update",
      blob,
    });
  } else {
    const inputs = await processor(
      message.image
        ? [
            {
              role: "<|User|>",
              content: "<image_placeholder>\n" + message.content,
              images: [message.image],
            },
          ]
        : [
            {
              role: "<|System|>",
              content:
                "You are a helpful assistant. Answer the user's questions in a concise manner.",
            },
            {
              role: "<|User|>",
              content: message.content,
            },
          ],
    );

    let startTime;
    let numTokens = 0;
    let tps;
    const token_callback_function = () => {
      startTime ??= performance.now();

      if (numTokens++ > 0) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
      }
    };
    const callback_function = (output) => {
      self.postMessage({
        status: "text-update",
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

    // Generate response
    const outputs = await model.generate({
      ...inputs,
      max_new_tokens: MAX_NEW_TEXT_TOKENS,
      do_sample: false,
      streamer,
      stopping_criteria,
    });
  }

  // Tell the main thread we are done
  self.postMessage({
    status: "complete",
  });
}

async function load() {
  self.postMessage({
    status: "loading",
    data: "Loading model...",
  });

  // Load the pipeline and save it for future use.
  const [processor, model] = await ImageGenerationPipeline.getInstance((x) => {
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
      stopping_criteria.reset();
      break;
  }
});
