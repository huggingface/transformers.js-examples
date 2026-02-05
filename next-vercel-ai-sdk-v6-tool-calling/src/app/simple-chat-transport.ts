import {
  ChatTransport,
  UIMessageChunk,
  streamText,
  convertToModelMessages,
  ChatRequestOptions,
  createUIMessageStream,
  wrapLanguageModel,
  extractReasoningMiddleware,
} from "ai";
import {
  TransformersJSLanguageModel,
  TransformersUIMessage,
} from "@browser-ai/transformers-js";
import { useModelStore } from "../store/store";

// Simple version of the chat transport without progress tracking
export class TransformersChatTransport implements ChatTransport<TransformersUIMessage> {
  private async getModel(): Promise<TransformersJSLanguageModel> {
    return useModelStore.getState().getModelInstance();
  }

  async sendMessages(
    options: {
      chatId: string;
      messages: TransformersUIMessage[];
      abortSignal: AbortSignal | undefined;
    } & {
      trigger: "submit-message" | "submit-tool-result" | "regenerate-message";
      messageId: string | undefined;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const { chatId, messages, abortSignal, trigger, messageId, ...rest } =
      options;

    const prompt = await convertToModelMessages(messages);
    const model = await this.getModel();

    const result = streamText({
      model: wrapLanguageModel({
        model,
        middleware: extractReasoningMiddleware({
          tagName: "think",
        }),
      }),
      messages: prompt,
      abortSignal: abortSignal,
    });
    return result.toUIMessageStream();
  }

  async reconnectToStream(
    options: {
      chatId: string;
    } & ChatRequestOptions,
  ): Promise<ReadableStream<UIMessageChunk> | null> {
    // Client-side AI doesn't support stream reconnection
    return null;
  }
}
