import { useState, useCallback, useRef } from "react";
import {
  VoxtralForConditionalGeneration,
  VoxtralProcessor,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

type VoxtralStatus = "idle" | "loading" | "ready" | "transcribing" | "error";

export function useVoxtral() {
  const [status, setStatus] = useState<VoxtralStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>("");

  const processorRef = useRef<any>(
    (window as any).__VOXTRAL_PROCESSOR__ || null,
  );
  const modelRef = useRef<any>((window as any).__VOXTRAL_MODEL__ || null);
  const stoppingCriteriaRef = useRef<any>(null);

  const loadModel = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      if (!processorRef.current || !modelRef.current) {
        const model_id = "onnx-community/Voxtral-Mini-3B-2507-ONNX";
        const processor = await VoxtralProcessor.from_pretrained(model_id);
        const model = await VoxtralForConditionalGeneration.from_pretrained(
          model_id,
          {
            dtype: {
              embed_tokens: "q4", // 252 MB
              audio_encoder: "q4", // 440 MB
              decoder_model_merged: "q4f16", // 2.0 GB
            },
            device: {
              embed_tokens: "wasm", // Just a look-up, so can be wasm
              audio_encoder: "webgpu",
              decoder_model_merged: "webgpu",
            },
          },
        );
        processorRef.current = processor;
        modelRef.current = model;

        // Store globally to persist across hot reloads
        (window as any).__VOXTRAL_PROCESSOR__ = processor;
        (window as any).__VOXTRAL_MODEL__ = model;
      }
      setStatus("ready");
    } catch (err: any) {
      setStatus("error");
      setError("Failed to load model: " + (err?.message || err));
    }
  }, []);

  const transcribe = useCallback(
    async (audio: Float32Array, language: string = "en") => {
      const processor = processorRef.current;
      const model = modelRef.current;
      if (!processor || !model) {
        setError("Model not loaded");
        setStatus("error");
        return;
      }
      setStatus("transcribing");
      setTranscription("");
      setError(null);
      try {
        const conversation = [
          {
            role: "user",
            content: [
              { type: "audio" },
              { type: "text", text: `lang:${language}[TRANSCRIBE]` },
            ],
          },
        ];
        const text = processor.apply_chat_template(conversation, {
          tokenize: false,
        });
        const inputs = await processor(text, audio);

        let output = "";
        const streamer = new TextStreamer(processor.tokenizer, {
          skip_special_tokens: true,
          skip_prompt: true,
          callback_function: (token: string) => {
            output += token;
            setTranscription((prev) => prev + token);
          },
        });

        stoppingCriteriaRef.current = new InterruptableStoppingCriteria();

        await model.generate({
          ...inputs,
          max_new_tokens: 8192,
          streamer,
          stopping_criteria: stoppingCriteriaRef.current,
        });

        setStatus("ready");
        return output;
      } catch (err: any) {
        setStatus("error");
        setError("Transcription failed: " + (err?.message || err));
      } finally {
        stoppingCriteriaRef.current = null;
      }
    },
    [],
  );

  const stopTranscription = useCallback(() => {
    if (stoppingCriteriaRef.current) {
      stoppingCriteriaRef.current.interrupt();
    }
  }, []);

  return {
    status,
    error,
    transcription,
    loadModel,
    transcribe,
    setTranscription,
    stopTranscription,
  };
}
