import { useState, useCallback, useEffect } from "react";

interface ModelLoaderState {
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  progress: number;
  status: string;
  device: "webgpu" | "wasm" | null;
}

let worker: Worker | null = null;
let workerReady = false;
let pendingEmbeddings: ((embeddings: number[][]) => void)[] = [];

export const useModel = () => {
  const [state, setState] = useState<ModelLoaderState>({
    isLoading: false,
    isReady: false,
    error: null,
    progress: 0,
    status: "Waiting to start...",
    device: null,
  });

  useEffect(() => {
    if (!worker) {
      worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === "progress") {
          setState((prev) => ({
            ...prev,
            progress: payload.percentage,
            status: payload.status,
          }));
        } else if (type === "ready") {
          workerReady = true;
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isReady: true,
            progress: 100,
            status: "Ready. Enter sentences and generate the galaxy!",
            device: payload.device,
          }));
        } else if (type === "error") {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: payload,
            status: "An error occurred",
          }));
        } else if (type === "embeddings") {
          if (pendingEmbeddings.length > 0) {
            pendingEmbeddings.shift()?.(payload.embeddings);
          }
        }
      };
    }
  }, []);

  const loadModel = useCallback(async () => {
    if (workerReady && state.device) {
      return { device: state.device };
    }
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: 0,
      status: "Initializing...",
    }));
    worker?.postMessage({ type: "load-model" });
    return new Promise<{ device: "webgpu" | "wasm" }>((resolve, reject) => {
      const checkReady = () => {
        if (workerReady && state.device) {
          resolve({ device: state.device });
        } else if (state.error) {
          reject(state.error);
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }, [state.error, state.device]);

  const embed = useCallback(async (sentences: string[], options: any) => {
    return new Promise<number[][]>((resolve, _reject) => {
      pendingEmbeddings.push(resolve);
      worker?.postMessage({ type: "embed", payload: { sentences, options } });
    });
  }, []);

  return {
    ...state,
    loadModel,
    embed,
  };
};
