// https://nextjs.org/docs/app/building-your-application/routing/route-handlers

import { pipeline } from "@huggingface/transformers";

// NOTE: We attach the classifier to the global object to avoid unnecessary reloads during development
const classifier = (globalThis.classifier ??= await pipeline(
  "text-classification",
  "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
));

export async function GET(request) {
  const text = request.nextUrl.searchParams.get("text");

  if (!text) {
    return Response.json({ message: "No text provided" }, { status: 400 });
  }

  const result = await classifier(text);
  return Response.json(result[0]);
}
