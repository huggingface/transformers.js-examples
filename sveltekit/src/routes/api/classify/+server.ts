// https://svelte.dev/tutorial/kit/get-handlers

import { pipeline } from "@huggingface/transformers";
import { json, error } from "@sveltejs/kit";

import type { TextClassificationPipeline } from "@huggingface/transformers";

// NOTE: We attach the classifier to the global object to avoid unnecessary reloads during development
declare global {
  var classifier: TextClassificationPipeline;
}

const classifier = (globalThis.classifier ??= await pipeline(
  "text-classification",
  "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
));

export async function GET({ url }: { url: URL }) {
  const text = url.searchParams.get("text");

  if (!text) {
    return error(400, "No text provided");
  }

  const result = await classifier(text);
  return json(result[0]);
}
