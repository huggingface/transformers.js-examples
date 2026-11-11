import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  softmax,
} from "@huggingface/transformers";

// DeBERTa v3 xsmall (about 87 MB quantized) rejects subtle false claims that
// smaller MNLI checkpoints accept, such as mixing up quantization levels.
// Label order differs between checkpoints, so it is read from the model config
// instead of hardcoded.
export const NLI_MODEL = "Xenova/nli-deberta-v3-xsmall";

/**
 * Strip markdown decorations that tokenizers handle poorly. Without this,
 * an exact copy of a backtick-heavy list can look unrelated to its source.
 */
export function normalizeNliText(text) {
  return String(text ?? "")
    .replace(/[`"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Small NLI model used to check whether a generated sentence is entailed by a
 * retrieved documentation chunk.
 */
export class NliVerifier {
  constructor({ device = "wasm" } = {}) {
    this.device = device;
    this.tokenizer = null;
    this.model = null;
    this.labels = [];
  }

  async load(progress_callback) {
    if (this.tokenizer && this.model) return;

    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(NLI_MODEL, { progress_callback }),
      AutoModelForSequenceClassification.from_pretrained(NLI_MODEL, {
        dtype: "q8",
        device: this.device,
        progress_callback,
      }),
    ]);

    this.tokenizer = tokenizer;
    this.model = model;
    this.labels = labelOrder(model.config.id2label);
  }

  /**
   * @param {string} premise Retrieved documentation chunk.
   * @param {string} hypothesis Generated sentence.
   */
  async score(premise, hypothesis) {
    if (!this.tokenizer || !this.model) {
      throw new Error("The NLI verifier is not loaded.");
    }

    const inputs = this.tokenizer(normalizeNliText(premise), {
      text_pair: normalizeNliText(hypothesis),
      padding: true,
      truncation: true,
    });
    const output = await this.model(inputs);
    const probabilities = softmax(output.logits.data);

    const scores = { contradiction: 0, entailment: 0, neutral: 0 };
    this.labels.forEach((label, index) => {
      if (label in scores) scores[label] = probabilities[index];
    });
    return scores;
  }
}

function labelOrder(id2label) {
  if (!id2label) return ["contradiction", "entailment", "neutral"];
  return Object.keys(id2label)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => String(id2label[key]).toLowerCase());
}
