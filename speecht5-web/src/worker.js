import {
  Tensor,
  AutoTokenizer,
  SpeechT5ForTextToSpeech,
  SpeechT5HifiGan,
} from "@huggingface/transformers";
import { encodeWAV } from "./utils";

// Use the Singleton pattern to enable lazy construction of the pipeline.
class MyTextToSpeechPipeline {
  static BASE_URL =
    "https://huggingface.co/datasets/Xenova/cmu-arctic-xvectors-extracted/resolve/main/";

  static model_id = "Xenova/speecht5_tts";
  static vocoder_id = "Xenova/speecht5_hifigan";

  static tokenizer_instance = null;
  static model_instance = null;
  static vocoder_instance = null;

  static async getInstance(progress_callback = null) {
    this.tokenizer_instance ??= AutoTokenizer.from_pretrained(this.model_id, {
      progress_callback,
    });

    this.model_instance ??= SpeechT5ForTextToSpeech.from_pretrained(
      this.model_id,
      {
        dtype: "fp32",
        progress_callback,
      },
    );

    this.vocoder_instance ??= SpeechT5HifiGan.from_pretrained(this.vocoder_id, {
      dtype: "fp32",
      progress_callback,
    });

    return new Promise(async (resolve, reject) => {
      const result = await Promise.all([
        this.tokenizer_instance,
        this.model_instance,
        this.vocoder_instance,
      ]);
      self.postMessage({
        status: "ready",
      });
      resolve(result);
    });
  }

  static async getSpeakerEmbeddings(speaker_id) {
    // e.g., `cmu_us_awb_arctic-wav-arctic_a0001`
    const speaker_embeddings_url = `${this.BASE_URL}${speaker_id}.bin`;
    const speaker_embeddings = new Tensor(
      "float32",
      new Float32Array(
        await (await fetch(speaker_embeddings_url)).arrayBuffer(),
      ),
      [1, 512],
    );
    return speaker_embeddings;
  }
}

// Mapping of cached speaker embeddings
const speaker_embeddings_cache = new Map();

// Listen for messages from the main thread
self.addEventListener("message", async (event) => {
  // Load the pipeline
  const [tokenizer, model, vocoder] = await MyTextToSpeechPipeline.getInstance(
    (x) => {
      // We also add a progress callback so that we can track model loading.
      self.postMessage(x);
    },
  );

  // Tokenize the input
  const { input_ids } = tokenizer(event.data.text);

  // Load the speaker embeddings
  let speaker_embeddings = speaker_embeddings_cache.get(event.data.speaker_id);
  if (speaker_embeddings === undefined) {
    speaker_embeddings = await MyTextToSpeechPipeline.getSpeakerEmbeddings(
      event.data.speaker_id,
    );
    speaker_embeddings_cache.set(event.data.speaker_id, speaker_embeddings);
  }

  // Generate the waveform
  const { waveform } = await model.generate_speech(
    input_ids,
    speaker_embeddings,
    { vocoder },
  );

  // Encode the waveform as a WAV file
  const wav = encodeWAV(waveform.data);

  // Send the output back to the main thread
  self.postMessage({
    status: "complete",
    output: new Blob([wav], { type: "audio/wav" }),
  });
});
