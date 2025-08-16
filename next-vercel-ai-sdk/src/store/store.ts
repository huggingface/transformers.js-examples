import { create } from 'zustand';
import { TransformersJSLanguageModel, transformersJS } from '@built-in-ai/transformers-js';
import { MODELS } from '../app/models';

interface ModelStore {
  selectedModel: string;
  modelInstance: TransformersJSLanguageModel | null;
  setSelectedModel: (modelId: string) => void;
  getModelInstance: () => Promise<TransformersJSLanguageModel>;
  clearModelInstance: () => void;
}

export const useModelStore = create<ModelStore>((set, get) => ({
  selectedModel: MODELS[0].id,
  modelInstance: null,

  setSelectedModel: (modelId: string) => {
    const state = get();
    if (state.selectedModel !== modelId) {
      set({ selectedModel: modelId, modelInstance: null });
    }
  },

  getModelInstance: async (): Promise<TransformersJSLanguageModel> => {
    const state = get();

    // Return existing instance if available
    if (state.modelInstance) {
      return state.modelInstance;
    }

    // Find the selected model config
    const modelConfig = MODELS.find(model => model.id === state.selectedModel);
    if (!modelConfig) {
      throw new Error(`Model configuration not found for: ${state.selectedModel}`);
    }

    const { ...modelOptions } = modelConfig;

    // Only use worker if the model supports it
    const workerConfig = modelConfig.supportsWorker
      ? {
        worker: new Worker(new URL('../app/worker.ts', import.meta.url), {
          type: "module",
        }),
      }
      : {};

    const modelInstance = transformersJS(modelConfig.id, {
      ...modelOptions,
      ...workerConfig,
    });

    // Store the instance
    set({ modelInstance });

    return modelInstance;
  },

  clearModelInstance: () => {
    const state = get();
    if (state.modelInstance) {
      set({ modelInstance: null });
    }
  },
}));
