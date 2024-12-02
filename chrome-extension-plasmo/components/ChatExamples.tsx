import { Terminal } from "lucide-react"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"

function ChatExamples({
  onExampleClick
}: {
  onExampleClick: (example: string) => void
}) {
  const [examples, setExamples] = useState<string[]>([
    "Give me some tips to improve my time management skills.",
    "What is the difference between AI and ML?",
    "Write python code to compute the nth fibonacci number."
  ])

  const handleExampleClick = (example: string) => {
    onExampleClick(example)
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        justifyContent: "flex-end"
      }}>
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Hello Local World!</AlertTitle>
        <AlertDescription>
          You can chat with large language models locally. No internet
          connection needed.
        </AlertDescription>
      </Alert>
      {examples.map((example, index) => (
        <div
          key={index}
          onClick={() => handleExampleClick(example)}
          className="text-sm bg-blue-100 rounded-md p-2 cursor-pointer hover:bg-blue-200">
          {example}
        </div>
      ))}
    </div>
  )
}

export default ChatExamples
