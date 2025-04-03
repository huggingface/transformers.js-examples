import type { GenerationConfig } from "@huggingface/transformers/types/generation/configuration_utils"
import { useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import { DEFAULT_GENERATION_CONFIG } from "~/llm/default-config"

import { Alert, AlertDescription } from "./ui/alert"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Switch } from "./ui/switch"

function GenerationConfigForm() {
  const [config, setConfig] = useStorage<GenerationConfig>(
    "generation_config",
    DEFAULT_GENERATION_CONFIG
  )
  const [updated, setUpdated] = useState(false)

  const handleChange = async (
    field: keyof GenerationConfig,
    value: number | boolean
  ) => {
    await setConfig({
      ...config,
      [field]: value
    })
    setUpdated(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="do_sample" className="min-w-32 text-left">
          Do Sample
        </Label>
        <Switch
          id="do_sample"
          checked={config.do_sample}
          onCheckedChange={(checked) => handleChange("do_sample", checked)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="top_k" className="min-w-32 text-left">
          Top K (1-50)
        </Label>
        <Input
          id="top_k"
          type="number"
          min={1}
          max={50}
          step={1}
          value={config.top_k}
          onChange={(e) => handleChange("top_k", Number(e.target.value))}
          className="max-w-24"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="temperature" className="min-w-32 text-left">
          Temperature (0-1)
        </Label>
        <Input
          id="temperature"
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={config.temperature}
          onChange={(e) => handleChange("temperature", Number(e.target.value))}
          className="max-w-24"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="top_p" className="min-w-32 text-left">
          Top P (0-1)
        </Label>
        <Input
          id="top_p"
          type="number"
          min={0}
          max={1}
          step={0.1}
          value={config.top_p}
          onChange={(e) => handleChange("top_p", Number(e.target.value))}
          className="max-w-24"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="max_new_tokens" className="min-w-32 text-left">
          Max New Tokens (1-1024)
        </Label>
        <Input
          id="max_new_tokens"
          type="number"
          min={1}
          max={1024}
          step={1}
          value={config.max_new_tokens}
          onChange={(e) =>
            handleChange("max_new_tokens", Number(e.target.value))
          }
          className="max-w-24"
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="repetition_penalty" className="min-w-32 text-left">
          Repetition Penalty (1-2)
        </Label>
        <Input
          id="repetition_penalty"
          type="number"
          min={1}
          max={2}
          step={0.05}
          value={config.repetition_penalty}
          onChange={(e) =>
            handleChange("repetition_penalty", Number(e.target.value))
          }
          className="max-w-24"
        />
      </div>

      {updated && (
        <Alert>
          <AlertDescription>
            Generation config updated. Please send a message to see the changes.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default GenerationConfigForm
