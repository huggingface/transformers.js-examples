import { pipeline } from "@huggingface/transformers";

// Create a feature-extraction pipeline
const extractor = await pipeline(
  "feature-extraction",
  "Xenova/all-MiniLM-L6-v2",
);

// Compute sentence embeddings
const sentences = ["Hello world", "This is an example sentence"];
const output = await extractor(sentences, { pooling: "mean", normalize: true });
console.log(output.tolist());
// [
//   [ -0.03172111138701439, 0.04395204409956932, 0.00014728980022482574, ... ],
//   [ 0.0646488294005394, 0.0715673640370369, 0.05925070866942406, ... ]
// ]
