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
import { CheckIcon, Copy, PlusIcon, RefreshCcw, X, XIcon } from "lucide-react";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import Image from "next/image";
import { Action } from "@/components/ai-elements/actions";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from "@/components/ai-elements/confirmation";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";

const suggestions = [
  "Where am I located?",
  "What time is it?",
  "Solve a math problem",
  "Generate a random number",
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const { selectedModel, setSelectedModel } = useModelStore();

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
  } = useChat<TransformersUIMessage>({
    transport: new TransformersChatTransport(),
    experimental_throttle: 75,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({
        text: input,
      });
      setInput("");
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
                Vercel AI SDK v6
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
                            // Handle tool parts
                            if (part.type.startsWith("tool-")) {
                              if (!("state" in part)) return null;

                              // Handle tool states that need confirmation UI
                              const needsConfirmation =
                                part.state === "approval-requested" ||
                                part.state === "approval-responded" ||
                                part.state === "output-denied";

                              if (needsConfirmation && "approval" in part) {
                                const toolName = part.type.replace("tool-", "");
                                return (
                                  <Tool key={i}>
                                    <ToolHeader
                                      type={part.type as any}
                                      state={part.state}
                                    />
                                    <ToolContent>
                                      {"input" in part &&
                                        part.input !== undefined && (
                                          <ToolInput input={part.input} />
                                        )}
                                      <Confirmation
                                        approval={part.approval ?? null}
                                        state={part.state}
                                      >
                                        <ConfirmationTitle>
                                          <ConfirmationRequest>
                                            Allow {toolName} to execute with
                                            these parameters?
                                          </ConfirmationRequest>
                                          <ConfirmationAccepted>
                                            <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
                                            <span>Accepted</span>
                                          </ConfirmationAccepted>
                                          <ConfirmationRejected>
                                            <XIcon className="size-4 text-destructive" />
                                            <span>Rejected</span>
                                          </ConfirmationRejected>
                                        </ConfirmationTitle>
                                        <ConfirmationActions>
                                          <ConfirmationAction
                                            onClick={() =>
                                              addToolApprovalResponse({
                                                id: part.approval!.id,
                                                approved: false,
                                                reason:
                                                  "User denied tool execution",
                                              })
                                            }
                                            variant="outline"
                                          >
                                            Reject
                                          </ConfirmationAction>
                                          <ConfirmationAction
                                            onClick={() =>
                                              addToolApprovalResponse({
                                                id: part.approval!.id,
                                                approved: true,
                                              })
                                            }
                                            variant="default"
                                          >
                                            Accept
                                          </ConfirmationAction>
                                        </ConfirmationActions>
                                      </Confirmation>
                                    </ToolContent>
                                  </Tool>
                                );
                              }

                              const toolState = part.state || "input-streaming";

                              const formatOutput = (
                                output: unknown,
                              ): React.ReactNode => {
                                if (output === undefined || output === null)
                                  return undefined;
                                if (typeof output === "string") return output;
                                return (
                                  <pre className="text-xs overflow-auto">
                                    {JSON.stringify(output, null, 2)}
                                  </pre>
                                );
                              };

                              return (
                                <Tool key={i}>
                                  <ToolHeader
                                    type={part.type as any}
                                    state={toolState as any}
                                  />
                                  <ToolContent>
                                    {"input" in part &&
                                      part.input !== undefined && (
                                        <ToolInput input={part.input} />
                                      )}
                                    {("output" in part ||
                                      "errorText" in part) && (
                                      <ToolOutput
                                        output={
                                          "output" in part && part.output
                                            ? formatOutput(part.output)
                                            : undefined
                                        }
                                        errorText={
                                          "errorText" in part && part.errorText
                                            ? String(part.errorText)
                                            : undefined
                                        }
                                      />
                                    )}
                                  </ToolContent>
                                </Tool>
                              );
                            }
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
              {/* Loading state when tool approval was sent and we're waiting for response */}
              {messages.length > 0 &&
                (messages[messages.length - 1].role === "assistant" ||
                  messages[messages.length - 1].role === "system") &&
                status === "submitted" &&
                messages[messages.length - 1].parts.some(
                  (part) =>
                    part.type.startsWith("tool-") &&
                    "state" in part &&
                    part.state === "approval-responded",
                ) && (
                  <div className="flex gap-1 items-center text-gray-500 mt-2">
                    <Loader />
                    Executing tool...
                  </div>
                )}

              {/* Loading state - only show as separate message if not after tool approval */}
              {status === "submitted" &&
                !messages.some(
                  (m, index) =>
                    index === messages.length - 1 &&
                    (m.role === "assistant" || m.role === "system") &&
                    m.parts.some(
                      (part) =>
                        part.type.startsWith("tool-") &&
                        "state" in part &&
                        part.state === "approval-responded",
                    ),
                ) && (
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
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
