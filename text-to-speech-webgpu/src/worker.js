import { HFModelConfig_v1, InterfaceHF } from "outetts";

// Check if WebGPU is supported
let fp16_supported = false;
try {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("WebGPU is not supported (no adapter found)");
  }
  fp16_supported = adapter.features.has("shader-f16");
  self.postMessage({ status: "feature-success" });
} catch (e) {
  self.postMessage({
    status: "feature-error",
    data: e.toString(),
  });
  throw e;
}

// Configure the model
const model_config = new HFModelConfig_v1({
  model_path: "onnx-community/OuteTTS-0.2-500M",
  language: "en", // Supported languages in v0.2: en, zh, ja, ko
  dtype: fp16_supported ? "q4f16" : "q4", // Supported dtypes: fp32, fp16, q8, q4, q4f16
  device: "webgpu", // Supported devices: webgpu, wasm
});

// Initialize the interface
const tts_interface = await InterfaceHF({
  model_version: "0.2",
  cfg: model_config,
});
self.postMessage({ status: "ready" });

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { text, speaker_id } = e.data;

  // Load a default speaker
  const speaker =
    speaker_id === "random"
      ? null
      : tts_interface.load_default_speaker(speaker_id);

  // Generate speech
  const output = await tts_interface.generate({
    text,
    temperature: 0.1, // Lower temperature values may result in a more stable tone
    repetition_penalty: 1.1,
    max_length: 4096,

    // Optional: Use a speaker profile for consistent voice characteristics
    // Without a speaker profile, the model will generate a voice with random characteristics
    speaker,
  });

  // Send the audio file back to the main thread
  const buffer = output.to_wav("output.wav");
  const blob = new Blob([buffer], { type: "audio/wav" });
  self.postMessage({
    status: "complete",
    audio: URL.createObjectURL(blob),
    text,
  });
});
