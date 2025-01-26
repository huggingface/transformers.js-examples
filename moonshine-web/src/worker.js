import { AutoModel, Tensor, pipeline } from "@huggingface/transformers";
import {
  MAX_BUFFER_DURATION,
  SAMPLE_RATE,
  SPEECH_THRESHOLD,
  EXIT_THRESHOLD,
  SPEECH_PAD_SAMPLES,
  MAX_NUM_PREV_BUFFERS,
  MIN_SILENCE_DURATION_SAMPLES,
  MIN_SPEECH_DURATION_SAMPLES,
} from "./constants";
import { supportsWebGPU } from "./utils";

const device = (await supportsWebGPU()) ? "webgpu" : "wasm";
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
    decoder_model_merged: "q4",
  },
  wasm: {
    encoder_model: "fp32",
    decoder_model_merged: "q8",
  },
};
const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/moonshine-base-ONNX", // or "onnx-community/whisper-tiny.en",
  {
    device,
    dtype: DEVICE_DTYPE_CONFIGS[device],
  },
).catch((error) => {
  self.postMessage({ error });
  throw error;
});

await transcriber(new Float32Array(SAMPLE_RATE)); // Compile shaders
self.postMessage({ type: "status", status: "ready", message: "Ready!" });

// Transformers.js currently doesn't support simultaneous inference,
// so we need to chain the inference promises.
let inferenceChain = Promise.resolve();

// Global audio buffer to store incoming audio
const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE);
let bufferPointer = 0;

// Initial state for VAD
const sr = new Tensor("int64", [SAMPLE_RATE], []);
let state = new Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);

// Whether we are in the process of adding audio to the buffer
let isRecording = false;

/**
 * Perform Voice Activity Detection (VAD)
 * @param {Float32Array} buffer The new audio buffer
 * @returns {Promise<boolean>} `true` if the buffer is speech, `false` otherwise.
 */
async function vad(buffer) {
  const input = new Tensor("float32", buffer, [1, buffer.length]);

  const { stateN, output } = await (inferenceChain = inferenceChain.then((_) =>
    silero_vad({ input, sr, state }),
  ));
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
const transcribe = async (buffer, data) => {
  const { text } = await (inferenceChain = inferenceChain.then((_) =>
    transcriber(buffer),
  ));
  self.postMessage({ type: "output", buffer, message: text, ...data });
};

// Track the number of samples after the last speech chunk
let postSpeechSamples = 0;
const reset = (offset = 0) => {
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
    now - ((postSpeechSamples + SPEECH_PAD_SAMPLES) / SAMPLE_RATE) * 1000;
  const start = end - (bufferPointer / SAMPLE_RATE) * 1000;
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
  transcribe(paddedBuffer, { start, end, duration });

  // Set overflow (if present) and reset the rest of the audio buffer
  if (overflow) {
    BUFFER.set(overflow, 0);
  }
  reset(overflowLength);
};

let prevBuffers = [];
self.onmessage = async (event) => {
  const { buffer } = event.data;

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
    reset();
    return;
  }

  dispatchForTranscriptionAndResetAudioBuffer();
};
