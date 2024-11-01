import {
  Florence2ForConditionalGeneration,
  AutoProcessor,
  AutoTokenizer,
} from "@huggingface/transformers";

export class Caption {
  /**
   * Create a new Caption model.
   * @param {import('@huggingface/transformers').PreTrainedModel} model The model to use for captioning
   * @param {import('@huggingface/transformers').Processor} processor The processor to use for captioning
   * @param {import('@huggingface/transformers').PreTrainedTokenizer} tokenizer The tokenizer to use for captioning
   */
  constructor(model, processor, tokenizer) {
    this.model = model;
    this.processor = processor;
    this.tokenizer = tokenizer;

    // Prepare text inputs
    this.task = "<CAPTION>";
    const prompts = processor.construct_prompts(this.task);
    this.text_inputs = tokenizer(prompts);
  }

  /**
   * Generate a caption for an image.
   * @param {import('@huggingface/transformers').RawImage} image The input image.
   * @returns {Promise<string>} The caption for the image
   */
  async describe(image) {
    const vision_inputs = await this.processor(image);

    // Generate text
    const generated_ids = await this.model.generate({
      ...this.text_inputs,
      ...vision_inputs,
      max_new_tokens: 256,
    });

    // Decode generated text
    const generated_text = this.tokenizer.batch_decode(generated_ids, {
      skip_special_tokens: false,
    })[0];

    // Post-process the generated text
    const result = this.processor.post_process_generation(
      generated_text,
      this.task,
      image.size,
    );
    return result[this.task];
  }

  static async from_pretrained(model_id) {
    const model = await Florence2ForConditionalGeneration.from_pretrained(
      model_id,
      { dtype: "fp32" },
    );
    const processor = await AutoProcessor.from_pretrained(model_id);
    const tokenizer = await AutoTokenizer.from_pretrained(model_id);

    return new Caption(model, processor, tokenizer);
  }
}
