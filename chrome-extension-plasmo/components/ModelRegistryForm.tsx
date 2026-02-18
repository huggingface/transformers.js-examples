import { TrashIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { formatBytes } from "~/lib/formatter"

import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { ScrollArea } from "./ui/scroll-area"
import { Separator } from "./ui/separator"

function ModelRegistryForm() {
  const targetCacheName = "transformers-cache"
  const listCacheStorage = async (targetCacheName: string) => {
    try {
      const cacheNames = await caches.keys()

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName)
        const requests = await cache.keys()
        console.log(`Cache: ${cacheName}`)

        if (cacheName === targetCacheName) {
          const cacheDetails = await Promise.all(
            requests.map(async (request) => {
              const response = await cache.match(request)
              const blob = await response.blob()
              return {
                url: request.url,
                size: blob.size,
                sizeFormatted: formatBytes(blob.size)
              }
            })
          )
          return cacheDetails
        }
      }

      return []
    } catch (error) {
      console.error("Error accessing cache:", error)
    }
  }

  const [cachedFiles, setCachedFiles] = useState<
    { url: string; size: number; sizeFormatted: string }[]
  >([])

  useEffect(() => {
    listCacheStorage(targetCacheName).then((requests) =>
      setCachedFiles(requests)
    )
  }, [])

  const handleDelete = async (url: string) => {
    const cache = await caches.open(targetCacheName)
    await cache.delete(url)
    setCachedFiles((prev) => prev.filter((file) => file.url !== url))
  }

  return (
    <ScrollArea className="h-72 max-w rounded-md border">
      <p className="text-sm text-muted-foreground p-4">
        {cachedFiles.length} files cached.{" "}
        {formatBytes(cachedFiles.reduce((acc, file) => acc + file.size, 0))} in
        total.
      </p>
      <Separator className="my-2" />
      <div className="p-4">
        {cachedFiles.map((file) => (
          <>
            <div key={file.url} className="text-sm">
              {file.url} <Badge variant="secondary">{file.sizeFormatted}</Badge>{" "}
              <Button
                variant="destructive"
                size="icon"
                onClick={() => handleDelete(file.url)}>
                <TrashIcon />
              </Button>
            </div>
            <Separator className="my-2" />
          </>
        ))}
      </div>
    </ScrollArea>
  )
}

export default ModelRegistryForm
