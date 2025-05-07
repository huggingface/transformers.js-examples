import { Check, Copy } from "lucide-react"
import { useState } from "react"

function ChatCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (text: string) => {
    setCopied(true)
    await navigator.clipboard.writeText(text)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <button
      onClick={() => handleCopy(text)}
      title="Copy message"
      disabled={copied}>
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  )
}

export default ChatCopyButton
