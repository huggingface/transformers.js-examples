import { AutoModel, Tensor, pipeline } from '@huggingface/transformers';

/**
 * Sample rate of the audio.
 * Coindicentally, this is the same for both models (Moonshine and Silero VAD)
 */
const SAMPLE_RATE = 16000;

/**
 * Probabilities ABOVE this value are considered as SPEECH
 */
const SPEECH_THRESHOLD = 0.3;

/**
 * If current state is SPEECH, and the probability of the next state
 * is below this value, it is considered as NON-SPEECH. Also known as
 * the exit threshold.
 */
const EXIT_THRESHOLD = 0.1;

/**
 * After each speech chunk, wait for at least this amount of silence
 * before considering the next chunk as a new speech chunk
 */
const MIN_SILENCE_DURATION_SAMPLES = 500 / 1000 * SAMPLE_RATE; // 500 ms

/**
 * Pad the speech chunk with this amount each side
 */
const SPEECH_PAD_SAMPLES = 80 / 1000 * SAMPLE_RATE; // 80 ms

/**
 * Final speech chunks below this duration are discarded
 */
const MIN_SPEECH_DURATION_SAMPLES = 250 / 1000 * SAMPLE_RATE; // 250 ms

/**
 * Maximum duration of audio that can be handled by Moonshine
 */
const MAX_BUFFER_DURATION = 30;

/**
 * Size of the incoming buffers
 */
const NEW_BUFFER_SIZE = 512;

/**
 * The number of previous buffers to keep, to ensure the audio is padded correctly
 */
const MAX_NUM_PREV_BUFFERS = Math.ceil(SPEECH_PAD_SAMPLES / NEW_BUFFER_SIZE);

/**
 * Global audio buffer to store incoming audio
 */
const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE);
let bufferPointer = 0;

// Load models
const silero_vad = await AutoModel.from_pretrained('onnx-community/silero-vad', {
    config: { model_type: 'custom' },
    dtype: 'fp32', // Full-precision
});
console.log('vad ready');

console.log('asr loading');
const transcriber = await pipeline(
    "automatic-speech-recognition",
    "onnx-community/moonshine-base-ONNX", // or "onnx-community/whisper-tiny.en",
    {
        device: 'webgpu',
        dtype: 'fp32',
    }
);
console.log('asr ready');

// Transformers.js currently doesn't support simultaneous inference,
// so we need to chain the inference promises.
let inferenceChain = Promise.resolve();

// Initial state for VAD
const sr = new Tensor('int64', [SAMPLE_RATE], []);
let state = new Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128]);

/**
 * Whether we are in the process of adding audio to the buffer
 */
let isRecording = false;

/**
 * Perform Voice Activity Detection (VAD)
 * @param {Float32Array} buffer The new audio buffer
 * @returns {Promise<boolean>} `true` if the buffer is speech, `false` otherwise.
 */
async function vad(buffer) {
    const input = new Tensor('float32', buffer, [1, buffer.length]);

    const { stateN, output } = await (
        inferenceChain = inferenceChain.then(_ => silero_vad({ input, sr, state }))
    );
    state = stateN; // Update state

    const isSpeech = output.data[0];

    // Use heuristics to determine if the buffer is speech or not
    return (
        // Case 1: We are above the threshold (definitely speech)
        isSpeech > SPEECH_THRESHOLD
        ||
        // Case 2: We are in the process of recording, and the probability is above the negative (exit) threshold
        isRecording && isSpeech >= EXIT_THRESHOLD
    )
}

/**
 * Transcribe the audio buffer
 * @param {Float32Array} buffer The audio buffer
 */
const transcribe = async (buffer) => {
    const output = await (
        inferenceChain = inferenceChain.then(_ => transcriber(buffer))
    );
    self.postMessage({ buffer, output });
}

// Track the number of samples after the last speech chunk
let postSpeechSamples = 0;
const reset = (offset = 0) => {
    BUFFER.fill(0, offset);
    bufferPointer = offset;
    isRecording = false;
    postSpeechSamples = 0;
}

const dispatchForTranscriptionAndResetAudioBuffer = (overflow) => {
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
    transcribe(paddedBuffer);

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
