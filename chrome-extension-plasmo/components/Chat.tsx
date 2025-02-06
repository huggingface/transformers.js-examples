import { ArrowUp } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import ChatExamples from "~/components/ChatExamples"
import ChatHeader from "~/components/ChatHeader"
import ChatMessages from "~/components/ChatMessages"
import ChatProgress from "~/components/ChatProgress"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { DEFAULT_MODEL_CONFIG } from "~/llm/default-config"
import type { Message, ModelConfig, ProgressItem } from "~/src/types"

function Chat() {
  const [inputText, setInputText] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([])

  const [modelConfig, setModelConfig] = useStorage<ModelConfig>(
    "model_config",
    DEFAULT_MODEL_CONFIG
  )

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.status === "initiate") {
        console.log("Model initiate:", message)
        setProgressItems((prev) => [...prev, message.data])

        setMessages((prev) =>
          prev.map((m) => {
            if (m.content === "Thinking...") {
              return { ...m, content: "Loading model..." }
            }
            return m
          })
        )
      } else if (message.status === "progress") {
        // Handle model progress
        setProgressItems((prev) =>
          prev.map((item) => {
            if (item.file === message.data.file) {
              return { ...item, ...message.data }
            }
            return item
          })
        )
      } else if (message.status === "done") {
        // Handle model done
        console.log("Model done:", message)
        setProgressItems((prev) => {
          const newItems = prev.filter(
            (item) => item.file !== message.data.file
          )
          if (newItems.length === 0) {
            setMessages((prev) =>
              prev.map((m) => {
                if (["Thinking...", "Loading model..."].includes(m.content)) {
                  return { ...m, content: "Thinking..." }
                }
                return m
              })
            )
          }
          return newItems
        })
      } else if (message.status === "assistant") {
        console.log("Assistant:", message)
        setMessages((prev) =>
          prev.map((m) => {
            if (["Thinking...", "Loading model..."].includes(m.content)) {
              return { ...m, content: message.data.text }
            }
            return m
          })
        )
      } else if (message.status === "update") {
        setMessages((prev) => {
          const response = message.data
          const metadata = `${response.numTokens} tokens in ${response.latency.toFixed(0)} ms (${response.tps.toFixed(1)} tokens/sec)`
          const last = prev[prev.length - 1]
          const content = ["Thinking...", "Loading model..."].includes(
            last.content
          )
            ? response.output
            : last.content + response.output
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: content,
              role: "assistant",
              metadata
            }
          ]
        })
      }
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(event.target.value)
    },
    []
  )

  const handleSubmitOnText = (text: string) => {
    setIsLoading(true)

    const promptMessages = messages
      .map((m) => ({
        role: m.role,
        content: m.content
      }))
      .concat([
        {
          role: "user",
          content: text
        }
      ])
    const message = {
      action: "generate",
      messages: promptMessages
    }

    const pendingMessages = promptMessages.concat([
      { role: "assistant", content: "Thinking..." }
    ])
    setMessages(pendingMessages)
    setInputText("")

    chrome.runtime.sendMessage(message, (response) => {
      setIsLoading(false)
    })
  }

  const handleSubmit = useCallback(() => {
    if (!inputText.trim()) return
    if (isLoading) return

    handleSubmitOnText(inputText)
  }, [inputText])

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "#F0F2F5"
      }}>
      {/* Fixed Header */}
      <ChatHeader
        modelName={modelConfig.model_id}
        onNewChat={() => {
          setMessages([])
          setInputText("")
        }}
        hasChat={messages.length > 0}
      />

      {/* Fixed Progress Bar */}
      {progressItems.length > 0 && (
        <ChatProgress progressItems={progressItems} />
      )}

      {/* Scrollable Messages Container */}
      {messages.length > 0 ? (
        <ChatMessages messages={messages} messagesEndRef={messagesEndRef} />
      ) : (
        <ChatExamples
          onExampleClick={(example) => {
            setInputText(example)
            handleSubmitOnText(example)
          }}
        />
      )}

      {/* Fixed Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #DDD",
          backgroundColor: "white",
          display: "flex",
          gap: 8,
          boxShadow: "0 -1px 2px rgba(0,0,0,0.1)"
        }}>
        <Input
          type="email"
          placeholder="Type a message..."
          value={inputText}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={isLoading || inputText.length == 0}>
          <ArrowUp className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export default Chat
