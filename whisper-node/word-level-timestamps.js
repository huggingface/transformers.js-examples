import { pipeline } from "@huggingface/transformers";
import { read_audio } from "./utils.js";

// Load model
const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-tiny.en_timestamped",
  { dtype: { encoder_model: "fp32", decoder_model_merged: "q4" } },
);

// Load audio data
const audio = await read_audio(
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav",
  transcriber.processor.feature_extractor.config.sampling_rate,
);

// Run model w/ default settings
console.time("Execution time");
const output = await transcriber(audio, { return_timestamps: "word" });
console.timeEnd("Execution time");
console.log(output);
// {
//   text: ' And so my fellow Americans ask not what your country can do for you, ask what you can do for your country.',
//   chunks: [
//     { text: ' And', timestamp: [0, 0.76] },
//     { text: ' so', timestamp: [0.76, 1.06] },
//     ...
//     { text: ' country.', timestamp: [10.22, 10.72] },
//   ],
// }
