import { useState, useCallback } from "react";
import { pipeline, TextStreamer } from "@huggingface/transformers";
import type { TextSplitterStream } from "kokoro-js";

interface LLMState {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  progress: number;
}

type LLMGlobal = { generator: any | null };
const g = globalThis as any;
let __LLM: LLMGlobal = g.__LLM || { generator: null };
g.__LLM = __LLM;

export type generateFn = (
  messages: Array<{ role: string; content: string }>,
  onToken?: (token: string) => void,
  splitter?: TextSplitterStream,
) => Promise<void>;

export const useLLM = () => {
  const [state, setState] = useState<LLMState>({
    isLoading: false,
    isReady: !!__LLM.generator,
    error: null,
    progress: __LLM.generator ? 100 : 0,
  });

  const load = async () => {
    if (__LLM.generator) return __LLM.generator;
    setState((p) => ({ ...p, isLoading: true, error: null, progress: 0 }));
    try {
      const generator = await pipeline("text-generation", "onnx-community/gemma-3-270m-it-ONNX", {
        dtype: "fp32",
        device: "webgpu",
        progress_callback: (item) => {
          if (item.status === "progress" && item.file?.endsWith?.("onnx_data")) {
            setState((p) => ({ ...p, progress: item.progress || 0 }));
          }
        },
      });
      __LLM.generator = generator;
      setState((p) => ({
        ...p,
        isLoading: false,
        isReady: true,
        progress: 100,
      }));
      return generator;
    } catch (error) {
      setState((p) => ({
        ...p,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load model",
      }));
      throw error;
    }
  };

  const generate: generateFn = useCallback(async (messages, onToken, splitter) => {
    const generator = __LLM.generator;
    if (!generator) throw new Error("Model not loaded. Call load() first.");
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (token: string) => {
        onToken?.(token);
        splitter?.push(token);
      },
    });
    await generator(messages, {
      max_new_tokens: 1024,
      do_sample: false,
      streamer,
    });
    splitter?.close();
  }, []);

  return {
    ...state,
    load,
    generate,
  };
};
