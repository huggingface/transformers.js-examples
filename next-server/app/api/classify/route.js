// https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { pipeline } from "@huggingface/transformers";

// NOTE: We attach the classifier to the global object to avoid loading it multiple times
const classifier = (globalThis.classifier ??= await pipeline(
  "text-classification",
  "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
));

export async function GET(request) {
  // https://nextjs.org/docs/app/building-your-axpplication/routing/route-handlers#url-query-parameters
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get("text");

  const result = await classifier(text);
  return Response.json(result[0]);
}
