"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Response } from "@/components/ai-elements/response";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { MODELS } from "./models";
import { TransformersUIMessage } from "@built-in-ai/transformers-js";
import { TransformersChatTransport } from "./chat-transport";
import { useModelStore } from "../store/store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Copy, PlusIcon, RefreshCcw, X } from "lucide-react";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import Image from "next/image";
import { Action } from "@/components/ai-elements/actions";

const suggestions = [
  "Can you explain how to play tennis?",
  "What is a neural network?",
  "How do I make a really good lasagna?",
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const { selectedModel, setSelectedModel } = useModelStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const { messages, sendMessage, status, stop, regenerate } =
    useChat<TransformersUIMessage>({
      transport: new TransformersChatTransport(),
      experimental_throttle: 75,
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || files) && status === "ready") {
      sendMessage({
        text: input,
        files,
      });
      setInput("");
      setFiles(undefined);

      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const removeImage = (indexToRemove: number) => {
    if (files) {
      const dt = new DataTransfer();
      Array.from(files).forEach((file, index) => {
        if (index !== indexToRemove) {
          dt.items.add(file);
        }
      });
      setFiles(dt.files);

      if (imageInputRef.current) {
        imageInputRef.current.files = dt.files;
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  const copyMessageToClipboard = (message: any) => {
    const textContent = message.parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");

    navigator.clipboard.writeText(textContent);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative h-[calc(100dvh)]">
      <div className="flex flex-col h-full overflow-hidden">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Image alt="logo" width={350} height={120} src="huggingface.svg" />
            <p className="text-sm max-w-xl">
              In-browser, local chat application powered by {""}
              <a
                className="text-blue-400 underline"
                href="https://github.com/huggingface/transformers.js"
                target="_blank"
                rel="noopener noreferrer"
              >
                Transformers.js
              </a>
              , {""}
              <a
                className="text-blue-400 underline"
                href="https://github.com/jakobhoeg/built-in-ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                @built-in-ai/transformers-js
              </a>{" "}
              and {""}
              <a
                className="text-blue-400 underline"
                href="https://ai-sdk.dev/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel AI SDK
              </a>
              .
            </p>
          </div>
        )}

        {messages.length > 0 && (
          <Conversation className="flex-1 min-h-0 overflow-hidden">
            <ConversationContent>
              {messages.map((message, messageIndex) => (
                <div key={message.id}>
                  <Message from={message.role} key={message.id}>
                    <MessageContent>
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "data-modelDownloadProgress":
                            // Only show if message is not empty (hiding completed/cleared progress)
                            if (!part.data.message) return null;
                            // Don't show the entire div when actively streaming
                            if (status === "ready") return null;
                            return (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="flex items-center gap-1">
                                    <Loader />
                                    {part.data.message}
                                  </span>
                                </div>
                                {part.data.status === "downloading" &&
                                  part.data.progress !== undefined && (
                                    <Progress value={part.data.progress} />
                                  )}
                              </div>
                            );
                          case "file":
                            if (part.mediaType?.startsWith("image/"))
                              return (
                                <div key={i} className="mt-2">
                                  <Image
                                    src={part.url || "/placeholder.svg"}
                                    width={300}
                                    height={300}
                                    alt={part.filename || "Uploaded image"}
                                    className="object-contain max-w-sm rounded-lg border"
                                  />
                                </div>
                              );
                            return null;
                          case "text":
                            return (
                              <Response key={`${message.id}-${i}`}>
                                {part.text}
                              </Response>
                            );
                          case "reasoning":
                            return (
                              <Reasoning
                                key={`${message.id}-${i}`}
                                className="w-full"
                                isStreaming={
                                  status === "streaming" &&
                                  messageIndex === messages.length - 1
                                }
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{part.text}</ReasoningContent>
                              </Reasoning>
                            );
                          default:
                            return null;
                        }
                      })}
                      {(message.role === "assistant" ||
                        message.role === "system") &&
                        messageIndex === messages.length - 1 &&
                        status === "ready" && (
                          <div className="flex gap-1 mt-2">
                            <Action
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => copyMessageToClipboard(message)}
                              className="text-muted-foreground hover:text-foreground size-4"
                            >
                              <Copy className="size-3.5" />
                            </Action>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => regenerate()}
                              className="text-muted-foreground hover:text-foreground size-4"
                            >
                              <RefreshCcw className="size-3.5" />
                            </Button>
                          </div>
                        )}
                    </MessageContent>
                  </Message>
                </div>
              ))}
              {/* Loading state */}
              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="flex gap-1 items-center text-gray-500">
                      <Loader />
                      Thinking...
                    </div>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        <div className="shrink-0">
          {messages.length === 0 && (
            <Suggestions>
              {suggestions.map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  onClick={handleSuggestionClick}
                  suggestion={suggestion}
                />
              ))}
            </Suggestions>
          )}
          <PromptInput onSubmit={handleSubmit} className="mt-4">
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <>
                  <PromptInputButton
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <PlusIcon size={16} />
                  </PromptInputButton>
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                </>
                <PromptInputModelSelect
                  onValueChange={(value) => {
                    setSelectedModel(value);
                  }}
                  value={selectedModel}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {MODELS.map((model) => (
                      <PromptInputModelSelectItem
                        key={model.id}
                        value={model.id}
                      >
                        {model.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={status === "ready" && !input.trim()}
                status={status}
                onClick={
                  status === "submitted" || status === "streaming"
                    ? stop
                    : undefined
                }
              />
            </PromptInputToolbar>
            {files && files.length > 0 && (
              <div className="w-full flex px-2 p-2 gap-2">
                {Array.from(files).map((file, index) => (
                  <div
                    key={index}
                    className="relative bg-muted-foreground/20 flex w-fit flex-col gap-2 p-1 border-t border-x rounded-md"
                  >
                    {file.type.startsWith("image/") && (
                      <div className="flex text-sm">
                        <Image
                          width={100}
                          height={100}
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="h-auto rounded-md w-auto max-w-[100px] max-h-[100px]"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-1.5 -right-1.5 text-white cursor-pointer bg-red-500 hover:bg-red-600 w-4 h-4 rounded-full flex items-center justify-center"
                      type="button"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
