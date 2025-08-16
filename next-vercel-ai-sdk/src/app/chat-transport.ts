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
} from "@built-in-ai/transformers-js";
import { useModelStore } from "../store/store";

export class TransformersChatTransport
  implements ChatTransport<TransformersUIMessage> {

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

    const prompt = convertToModelMessages(messages);
    const model = await this.getModel();

    // Check if model is already available to skip progress tracking
    const availability = await model.availability();
    if (availability === "available") {
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

    // Handle model download with progress tracking
    return createUIMessageStream<TransformersUIMessage>({
      execute: async ({ writer }) => {
        try {
          let downloadProgressId: string | undefined;

          // Get model instance from store for download progress
          const model = await this.getModel();

          // Download/prepare model with progress monitoring
          await model.createSessionWithProgress(
            (progress: { progress: number }) => {
              const percent = Math.round(progress.progress * 100);

              if (progress.progress >= 1) {
                // Download complete
                if (downloadProgressId) {
                  writer.write({
                    type: "data-modelDownloadProgress",
                    id: downloadProgressId,
                    data: {
                      status: "complete",
                      progress: 100,
                      message:
                        "Model finished downloading! Getting ready for inference...",
                    },
                  });
                }
                return;
              }

              // First progress update
              if (!downloadProgressId) {
                downloadProgressId = `download-${Date.now()}`;
                writer.write({
                  type: "data-modelDownloadProgress",
                  id: downloadProgressId,
                  data: {
                    status: "downloading",
                    progress: percent,
                    message: "Downloading browser AI model...",
                  },
                  transient: true,
                });
                return;
              }

              // Ongoing progress updates
              writer.write({
                type: "data-modelDownloadProgress",
                id: downloadProgressId,
                data: {
                  status: "downloading",
                  progress: percent,
                  message: `Downloading browser AI model... ${percent}%`,
                },
              });
            },
          );

          // Stream the actual text response
          const result = streamText({
            model: wrapLanguageModel({
              model,
              middleware: extractReasoningMiddleware({
                tagName: "think",
              }),
            }),
            messages: prompt,
            abortSignal: abortSignal,
            onChunk(event) {
              // Clear progress message on first text chunk
              if (event.chunk.type === "text-delta" && downloadProgressId) {
                writer.write({
                  type: "data-modelDownloadProgress",
                  id: downloadProgressId,
                  data: { status: "complete", progress: 100, message: "" },
                });
                downloadProgressId = undefined;
              }
            },
          });

          writer.merge(result.toUIMessageStream({ sendStart: false }));
        } catch (error) {
          writer.write({
            type: "data-notification",
            data: {
              message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
              level: "error",
            },
            transient: true,
          });
          throw error;
        }
      },
    });
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
