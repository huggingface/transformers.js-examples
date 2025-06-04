import {
  // VAD
  AutoModel,

  // LLM
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,

  // Speech recognition
  Tensor,
  pipeline,
} from "@huggingface/transformers";

import { KokoroTTS, TextSplitterStream } from "kokoro-js";

import {
  MAX_BUFFER_DURATION,
  INPUT_SAMPLE_RATE,
  SPEECH_THRESHOLD,
  EXIT_THRESHOLD,
  SPEECH_PAD_SAMPLES,
  MAX_NUM_PREV_BUFFERS,
  MIN_SILENCE_DURATION_SAMPLES,
  MIN_SPEECH_DURATION_SAMPLES,
} from "./constants";

const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
let voice;
const tts = await KokoroTTS.from_pretrained(model_id, {
  dtype: "fp32",
  device: "webgpu",
});

const device = "webgpu";
self.postMessage({ type: "info", message: `Using device: "${device}"` });
self.postMessage({
  type: "info",
  message: "Loading models...",
  duration: "until_next",
});

// Load models
const silero_vad = await AutoModel.from_pretrained(
  "onnx-community/silero-vad",
  {
    config: { model_type: "custom" },
    dtype: "fp32", // Full-precision
  },
).catch((error) => {
  self.postMessage({ error });
  throw error;
});

const DEVICE_DTYPE_CONFIGS = {
  webgpu: {
    encoder_model: "fp32",
    decoder_model_merged: "fp32",
  },
  wasm: {
    encoder_model: "fp32",
    decoder_model_merged: "q8",
  },
};
const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-base", // or "onnx-community/moonshine-base-ONNX",
  {
    device,
    dtype: DEVICE_DTYPE_CONFIGS[device],
  },
).catch((error) => {
  self.postMessage({ error });
  throw error;
});

await transcriber(new Float32Array(INPUT_SAMPLE_RATE)); // Compile shaders

const llm_model_id = "HuggingFaceTB/SmolLM2-1.7B-Instruct";
const tokenizer = await AutoTokenizer.from_pretrained(llm_model_id);
const llm = await AutoModelForCausalLM.from_pretrained(llm_model_id, {
  dtype: "q4f16",
  device: "webgpu",
});

const SYSTEM_MESSAGE = {
  role: "system",
  content:
    "You're a helpful and conversational voice assistant. Keep your responses short, clear, and casual.",
};
await llm.generate({ ...tokenizer("x"), max_new_tokens: 1 }); // Compile shaders

let messages = [SYSTEM_MESSAGE];
let past_key_values_cache;
let stopping_criteria;
self.postMessage({
  type: "status",
  status: "ready",
  message: "Ready!",
  voices: tts.voices,
});

// Global audio buffer to store incoming audio
const BUFFER = new Float32Array(MAX_BUFFER_DURATION * INPUT_SAMPLE_RATE);
let bufferPointer = 0;

// Initial state for VAD
const sr = new Tensor("int64", [INPUT_SAMPLE_RATE], []);
let state = new Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);

// Whether we are in the process of adding audio to the buffer
let isRecording = false;
let isPlaying = false; // new flag

/**
 * Perform Voice Activity Detection (VAD)
 * @param {Float32Array} buffer The new audio buffer
 * @returns {Promise<boolean>} `true` if the buffer is speech, `false` otherwise.
 */
async function vad(buffer) {
  const input = new Tensor("float32", buffer, [1, buffer.length]);

  const { stateN, output } = await silero_vad({ input, sr, state });
  state = stateN; // Update state

  const isSpeech = output.data[0];

  // Use heuristics to determine if the buffer is speech or not
  return (
    // Case 1: We are above the threshold (definitely speech)
    isSpeech > SPEECH_THRESHOLD ||
    // Case 2: We are in the process of recording, and the probability is above the negative (exit) threshold
    (isRecording && isSpeech >= EXIT_THRESHOLD)
  );
}

/**
 * Transcribe the audio buffer
 * @param {Float32Array} buffer The audio buffer
 * @param {Object} data Additional data
 */
const speechToSpeech = async (buffer, data) => {
  isPlaying = true;

  // 1. Transcribe the audio from the user
  const text = await transcriber(buffer).then(({ text }) => text.trim());
  if (["", "[BLANK_AUDIO]"].includes(text)) {
    // If the transcription is empty or a blank audio, we skip the rest of the processing
    return;
  }
  messages.push({ role: "user", content: text });

  // Set up text-to-speech streaming
  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, {
    voice,
  });
  (async () => {
    for await (const { text, phonemes, audio } of stream) {
      self.postMessage({ type: "output", text, result: audio });
    }
  })();

  // 2. Generate a response using the LLM
  const inputs = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
  });
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => {
      splitter.push(text);
    },
    token_callback_function: () => {},
  });

  stopping_criteria = new InterruptableStoppingCriteria();
  const { past_key_values, sequences } = await llm.generate({
    ...inputs,
    past_key_values: past_key_values_cache,

    do_sample: false, // TODO: do_sample: true is bugged (invalid data location on topk sample)
    max_new_tokens: 1024,
    streamer,
    stopping_criteria,
    return_dict_in_generate: true,
  });
  past_key_values_cache = past_key_values;

  // Finally, close the stream to signal that no more text will be added.
  splitter.close();

  const decoded = tokenizer.batch_decode(
    sequences.slice(null, [inputs.input_ids.dims[1], null]),
    { skip_special_tokens: true },
  );

  messages.push({ role: "assistant", content: decoded[0] });
};

// Track the number of samples after the last speech chunk
let postSpeechSamples = 0;
const resetAfterRecording = (offset = 0) => {
  self.postMessage({
    type: "status",
    status: "recording_end",
    message: "Transcribing...",
    duration: "until_next",
  });
  BUFFER.fill(0, offset);
  bufferPointer = offset;
  isRecording = false;
  postSpeechSamples = 0;
};

const dispatchForTranscriptionAndResetAudioBuffer = (overflow) => {
  // Get start and end time of the speech segment, minus the padding
  const now = Date.now();
  const end =
    now - ((postSpeechSamples + SPEECH_PAD_SAMPLES) / INPUT_SAMPLE_RATE) * 1000;
  const start = end - (bufferPointer / INPUT_SAMPLE_RATE) * 1000;
  const duration = end - start;
  const overflowLength = overflow?.length ?? 0;

  // Send the audio buffer to the worker
  const buffer = BUFFER.slice(0, bufferPointer + SPEECH_PAD_SAMPLES);

  const prevLength = prevBuffers.reduce((acc, b) => acc + b.length, 0);
  const paddedBuffer = new Float32Array(prevLength + buffer.length);
  let offset = 0;
  for (const prev of prevBuffers) {
    paddedBuffer.set(prev, offset);
    offset += prev.length;
  }
  paddedBuffer.set(buffer, offset);
  speechToSpeech(paddedBuffer, { start, end, duration });

  // Set overflow (if present) and reset the rest of the audio buffer
  if (overflow) {
    BUFFER.set(overflow, 0);
  }
  resetAfterRecording(overflowLength);
};

let prevBuffers = [];
self.onmessage = async (event) => {
  const { type, buffer } = event.data;

  // refuse new audio while playing back
  if (type === "audio" && isPlaying) return;

  switch (type) {
    case "start_call": {
      const name = tts.voices[voice ?? "af_heart"]?.name ?? "Heart";
      greet(`Hey there, my name is ${name}! How can I help you today?`);
      return;
    }
    case "end_call":
      messages = [SYSTEM_MESSAGE];
      past_key_values_cache = null;
    case "interrupt":
      stopping_criteria?.interrupt();
      return;
    case "set_voice":
      voice = event.data.voice;
      return;
    case "playback_ended":
      isPlaying = false;
      return;
  }

  const wasRecording = isRecording; // Save current state
  const isSpeech = await vad(buffer);

  if (!wasRecording && !isSpeech) {
    // We are not recording, and the buffer is not speech,
    // so we will probably discard the buffer. So, we insert
    // into a FIFO queue with maximum size of PREV_BUFFER_SIZE
    if (prevBuffers.length >= MAX_NUM_PREV_BUFFERS) {
      // If the queue is full, we discard the oldest buffer
      prevBuffers.shift();
    }
    prevBuffers.push(buffer);
    return;
  }

  const remaining = BUFFER.length - bufferPointer;
  if (buffer.length >= remaining) {
    // The buffer is larger than (or equal to) the remaining space in the global buffer,
    // so we perform transcription and copy the overflow to the global buffer
    BUFFER.set(buffer.subarray(0, remaining), bufferPointer);
    bufferPointer += remaining;

    // Dispatch the audio buffer
    const overflow = buffer.subarray(remaining);
    dispatchForTranscriptionAndResetAudioBuffer(overflow);
    return;
  } else {
    // The buffer is smaller than the remaining space in the global buffer,
    // so we copy it to the global buffer
    BUFFER.set(buffer, bufferPointer);
    bufferPointer += buffer.length;
  }

  if (isSpeech) {
    if (!isRecording) {
      // Indicate start of recording
      self.postMessage({
        type: "status",
        status: "recording_start",
        message: "Listening...",
        duration: "until_next",
      });
    }
    // Start or continue recording
    isRecording = true;
    postSpeechSamples = 0; // Reset the post-speech samples
    return;
  }

  postSpeechSamples += buffer.length;

  // At this point we're confident that we were recording (wasRecording === true), but the latest buffer is not speech.
  // So, we check whether we have reached the end of the current audio chunk.
  if (postSpeechSamples < MIN_SILENCE_DURATION_SAMPLES) {
    // There was a short pause, but not long enough to consider the end of a speech chunk
    // (e.g., the speaker took a breath), so we continue recording
    return;
  }

  if (bufferPointer < MIN_SPEECH_DURATION_SAMPLES) {
    // The entire buffer (including the new chunk) is smaller than the minimum
    // duration of a speech chunk, so we can safely discard the buffer.
    resetAfterRecording();
    return;
  }

  dispatchForTranscriptionAndResetAudioBuffer();
};

function greet(text) {
  isPlaying = true;
  const splitter = new TextSplitterStream();
  const stream = tts.stream(splitter, { voice });
  (async () => {
    for await (const { text: chunkText, audio } of stream) {
      self.postMessage({ type: "output", text: chunkText, result: audio });
    }
  })();
  splitter.push(text);
  splitter.close();
  messages.push({ role: "assistant", content: text });
}
