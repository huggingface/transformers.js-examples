import { useStorage } from "@plasmohq/storage/hook"

import { DEFAULT_MODEL_CONFIG } from "~/llm/default-config"
import { modelList } from "~/llm/model-list"
import type { ModelConfig } from "~/src/types"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "./ui/accordion"
import { Alert, AlertDescription } from "./ui/alert"
import { Button } from "./ui/button"

function ChangeModelForm() {
  const [config, setConfig] = useStorage<ModelConfig>(
    "model_config",
    DEFAULT_MODEL_CONFIG
  )
  const availableModels = modelList

  const handleChange = async (model: ModelConfig) => {
    await setConfig(model)
    alert("Model changed. Please refresh the page to apply the changes.")
    chrome.runtime.reload()
  }

  return (
    <div className="flex flex-col max-w">
      <Accordion type="single" collapsible defaultValue={config.model_id}>
        {availableModels.map((model) => (
          <AccordionItem value={model.model_id}>
            <AccordionTrigger>{model.model_id}</AccordionTrigger>
            <AccordionContent>
              {config.model_id == model.model_id && (
                <Alert variant="destructive">
                  <AlertDescription>
                    You're using this model {model.model_id}.
                  </AlertDescription>
                </Alert>
              )}
              <div className="text-sm text-gray-500 bg-gray-100 p-2 rounded-md my-2">
                {JSON.stringify(model, null, 2)}
              </div>
              <div className="flex flex-row gap-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    window.open(
                      `https://huggingface.co/${model.model_id}`,
                      "_blank"
                    )
                  }}>
                  Model Card
                </Button>
                <Button
                  variant="default"
                  className="w-full"
                  disabled={config.model_id == model.model_id}
                  onClick={() => {
                    handleChange(model)
                  }}>
                  Use
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export default ChangeModelForm
