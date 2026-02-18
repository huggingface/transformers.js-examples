import { useState, useCallback } from "react";
import { KokoroTTS, TextSplitterStream } from "kokoro-js";

interface TTSState {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  progress: number;
}

type TTSGlobal = { model: KokoroTTS | null };
const g = globalThis as any;
let __TTS: TTSGlobal = g.__TTS || { model: null };
g.__TTS = __TTS;

export const useTTS = () => {
  const [state, setState] = useState<TTSState>({
    isLoading: false,
    isReady: !!__TTS.model,
    error: null,
    progress: __TTS.model ? 100 : 0,
  });

  const load = async () => {
    if (__TTS.model) return __TTS.model;
    setState((p) => ({ ...p, isLoading: true, error: null, progress: 0 }));
    try {
      const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "fp32",
        device: "webgpu",
        progress_callback: (item) => {
          if (item.status === "progress" && item.file?.endsWith?.("onnx")) {
            setState((p) => ({ ...p, progress: item.progress || 0 }));
          }
        },
      });
      __TTS.model = tts;
      setState((p) => ({
        ...p,
        isLoading: false,
        isReady: true,
        progress: 100,
      }));
      return tts;
    } catch (error) {
      setState((p) => ({
        ...p,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load TTS model",
      }));
      throw error;
    }
  };

  const stream = useCallback((onAudioChunk: (chunk: { audio: Float32Array; text?: string }) => void) => {
    const tts = __TTS.model as KokoroTTS | null;
    if (!tts) throw new Error("TTS model not loaded. Call load() first.");
    const splitter = new TextSplitterStream();
    const ttsStream = tts.stream(splitter);
    const ttsPromise = (async () => {
      for await (const chunk of ttsStream) {
        if (chunk.audio) {
          onAudioChunk({ audio: chunk.audio.audio, text: chunk.text });
        }
      }
    })();
    return { splitter, ttsPromise };
  }, []);

  return {
    ...state,
    load,
    stream,
  };
};
