import { pipeline } from "@huggingface/transformers";

let classifierPromise;
async function classify(event, text) {
    classifierPromise ??= pipeline(
        "text-classification",
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
        { dtype: "q8" },
    );
    const classifier = await classifierPromise;
    return await classifier(text);
}

export { classify };
