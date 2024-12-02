import {
  ArrowLeftRight,
  Bot,
  EllipsisVertical,
  Eraser,
  Github,
  History,
  Logs,
  Milestone,
  Pencil,
  Power,
  Settings2
} from "lucide-react"
import React, { useEffect, useState } from "react"

import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "~/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~/components/ui/tooltip"

import ChangeModelForm from "./ChangeModelForm"
import GenerationConfigForm from "./GenerationConfigForm"
import ModelRegistryForm from "./ModelRegistryForm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog"

function ChatHeader({
  modelName,
  onNewChat,
  hasChat
}: {
  modelName: string
  onNewChat: () => void
  hasChat: boolean
}) {
  const [version, setVersion] = useState<string>("0.0.0")
  const [dialogMode, setDialogMode] = useState<
    "generation_settings" | "change_model" | "model_registry"
  >("generation_settings")

  useEffect(() => {
    if (chrome?.runtime?.getManifest) {
      const manifest = chrome.runtime.getManifest()
      setVersion(manifest.version)
    }
  }, [])

  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #DDD",
        backgroundColor: "white",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
      <h2 className="text-sm font-bold">
        Chat with{" "}
        <a
          href={`https://huggingface.co/${modelName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 underline">
          {modelName.split("/")[1]}
        </a>
      </h2>
      <div style={{ display: "flex", gap: 2 }}>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!hasChat}
                onClick={onNewChat}>
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-black">New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Generation</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    setDialogMode("generation_settings")
                  }}>
                  <Settings2 />
                  Change Settings
                </DropdownMenuItem>
              </DialogTrigger>
              <DropdownMenuLabel>Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  chrome.runtime.reload()
                }}>
                <Power />
                Restart Model
              </DropdownMenuItem>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    setDialogMode("change_model")
                  }}>
                  <ArrowLeftRight />
                  Change Model
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    setDialogMode("model_registry")
                  }}>
                  <Bot />
                  Model Registry
                </DropdownMenuItem>
              </DialogTrigger>
              <DropdownMenuLabel>Others</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Milestone />
                Version {version}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    "https://github.com/tantara/transformers.js-chrome",
                    "_blank"
                  )
                }>
                <Logs />
                Change Logs
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    "https://github.com/tantara/transformers.js-chrome",
                    "_blank"
                  )
                }>
                <Github />
                Repository
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            {dialogMode === "generation_settings" && (
              <DialogHeader>
                <DialogTitle>Generation Settings</DialogTitle>
                <DialogDescription>
                  <GenerationConfigForm />
                </DialogDescription>
              </DialogHeader>
            )}
            {dialogMode === "change_model" && (
              <DialogHeader>
                <DialogTitle>Change Model</DialogTitle>
                <DialogDescription>
                  <ChangeModelForm />
                </DialogDescription>
              </DialogHeader>
            )}
            {dialogMode === "model_registry" && (
              <DialogHeader>
                <DialogTitle>Model Registry</DialogTitle>
                <DialogDescription>
                  <ModelRegistryForm />
                </DialogDescription>
              </DialogHeader>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default ChatHeader
