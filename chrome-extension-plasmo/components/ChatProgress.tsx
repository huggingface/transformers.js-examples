import { formatBytes } from "~/lib/formatter"
import type { ProgressItem } from "~/src/types"

function Progress({ file, progress, total }) {
  progress ??= 0
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-700 text-left rounded-lg overflow-hidden mb-0.5">
      <div
        className="bg-blue-400 whitespace-nowrap px-1 text-sm"
        style={{ width: `${progress}%` }}>
        {file} ({progress.toFixed(2)}%
        {isNaN(total) ? "" : ` of ${formatBytes(total)}`})
      </div>
    </div>
  )
}

function ChatProgress({ progressItems }: { progressItems: ProgressItem[] }) {
  return (
    <div className="fixed bottom-[64px] left-0 right-0 z-50">
      <div className="m-2 p-2">
        {progressItems.map((item) => (
          <Progress key={item.file} {...item} />
        ))}
      </div>
    </div>
  )
}

export default ChatProgress
