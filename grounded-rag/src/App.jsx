import { useEffect, useRef, useState } from "react";

import AnswerCard from "./components/AnswerCard.jsx";
import Header from "./components/Header.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Inspector from "./components/Inspector.jsx";
import QuestionBox from "./components/QuestionBox.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import StatusPanel from "./components/StatusPanel.jsx";
import { EVAL_SUMMARY } from "./eval-summary.js";
import { AlertIcon, XIcon } from "./components/Icons.jsx";

const EXAMPLES = [
  "How do I run a model on WebGPU?",
  "What dtype should I use for 4-bit quantization?",
  "How do I disable remote model loading?",
  "What is the capital of France?",
];

function upsertProgress(items, next) {
  const index = items.findIndex((item) => item.file === next.file);
  if (index === -1) return [...items, next];
  const copy = [...items];
  copy[index] = { ...copy[index], ...next };
  return copy;
}

export default function App() {
  const worker = useRef(null);

  const [engine, setEngine] = useState({
    status: "loading",
    message: "Starting the worker...",
    error: null,
  });
  const [progressItems, setProgressItems] = useState([]);
  const [indexProgress, setIndexProgress] = useState(null);
  const [info, setInfo] = useState(null);

  const [question, setQuestion] = useState("");
  const [current, setCurrent] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState({
    topK: 4,
    threshold: 0.3,
    strict: true,
  });

  const [activeTab, setActiveTab] = useState("sources");
  const [selectedSource, setSelectedSource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const instance = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    worker.current = instance;

    const onMessage = (event) => {
      const message = event.data;

      switch (message.status) {
        case "loading":
          setEngine((previous) => ({
            ...previous,
            status: "loading",
            message: message.data,
          }));
          break;

        case "initiate":
          setProgressItems((previous) =>
            upsertProgress(previous, {
              file: message.file,
              name: message.name,
              status: "initiate",
              progress: 0,
              loaded: 0,
              total: 0,
            }),
          );
          break;

        case "progress":
          setProgressItems((previous) =>
            upsertProgress(previous, {
              file: message.file,
              name: message.name,
              status: "progress",
              progress: message.progress,
              loaded: message.loaded,
              total: message.total,
            }),
          );
          break;

        case "done":
          setProgressItems((previous) =>
            previous.map((item) =>
              item.file === message.file
                ? {
                    ...item,
                    status: "done",
                    progress: 100,
                    loaded: item.total || item.loaded,
                  }
                : item,
            ),
          );
          break;

        case "index":
          setIndexProgress({
            stage: message.data.stage,
            current: message.data.current,
            total: message.data.total,
          });
          break;

        case "ready":
          setInfo(message.data);
          setEngine({ status: "ready", message: "", error: null });
          setProgressItems([]);
          break;

        case "retrieval":
          setCurrent((previous) =>
            previous && previous.id === message.data.id
              ? {
                  ...previous,
                  status: "generating",
                  sources: message.data.sources,
                  topScore: message.data.topScore,
                  threshold: message.data.threshold,
                  insufficientContext: message.data.insufficientContext,
                  retrievalMs: message.data.retrievalMs,
                }
              : previous,
          );
          break;

        case "update":
          setCurrent((previous) =>
            previous && previous.id === message.data.id
              ? {
                  ...previous,
                  streaming:
                    (previous.streaming ?? "") + message.data.output,
                }
              : previous,
          );
          break;

        case "verifying":
          setCurrent((previous) =>
            previous && previous.id === message.data.id
              ? {
                  ...previous,
                  status: "verifying",
                  verifyingMessage: message.data.message,
                }
              : previous,
          );
          break;

        case "complete":
          setCurrent((previous) =>
            previous && previous.id === message.data.id
              ? {
                  ...previous,
                  ...message.data,
                  status: "complete",
                  streaming: message.data.answer,
                }
              : previous,
          );
          setIsGenerating(false);
          break;

        case "error": {
          const data = message.data;
          if (data?.id) {
            setCurrent((previous) =>
              previous && previous.id === data.id
                ? { ...previous, status: "error", error: data.message }
                : previous,
            );
            setEngine((previous) => ({
              ...previous,
              status: "ready",
              message: "",
            }));
            setError(data.message);
          } else {
            setEngine((previous) => ({
              ...previous,
              status: "error",
              error: data?.message ?? String(data),
            }));
          }
          setIsGenerating(false);
          break;
        }

        default:
          break;
      }
    };

    const onError = (event) => {
      setEngine((previous) => ({
        ...previous,
        status: "error",
        error: event.message || "The worker failed to start.",
      }));
      setIsGenerating(false);
    };

    instance.addEventListener("message", onMessage);
    instance.addEventListener("error", onError);
    instance.postMessage({ type: "init" });

    return () => {
      instance.removeEventListener("message", onMessage);
      instance.removeEventListener("error", onError);
      instance.terminate();
      if (worker.current === instance) worker.current = null;
    };
  }, []);

  function ask(value = question) {
    const trimmed = value.trim();
    if (
      !trimmed ||
      isGenerating ||
      engine.status !== "ready" ||
      !worker.current
    ) {
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setCurrent({
      id,
      question: trimmed,
      status: "retrieving",
      sources: [],
      streaming: "",
      verification: null,
      timings: null,
      topScore: null,
      threshold: settings.threshold,
      insufficientContext: false,
      refusedBeforeGeneration: false,
      prompt: null,
    });
    setQuestion("");
    setIsGenerating(true);
    setError(null);
    setSelectedSource(null);
    setActiveTab("sources");

    worker.current.postMessage({
      type: "ask",
      data: {
        id,
        question: trimmed,
        topK: settings.topK,
        threshold: settings.threshold,
        strict: settings.strict,
      },
    });
  }

  function cancel() {
    worker.current?.postMessage({ type: "cancel" });
  }

  function handleExample(example) {
    setQuestion(example);
    ask(example);
  }

  function handleSelectSource(number) {
    setSelectedSource(number);
    setActiveTab("sources");
  }

  function handleInspect(tab) {
    setActiveTab(tab);
    document
      .getElementById("inspector")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const isBusy = isGenerating || engine.status !== "ready";

  return (
    <div className="min-h-screen">
      <Header info={info} engineStatus={engine.status} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded p-0.5 text-rose-500 hover:bg-rose-100"
              aria-label="Dismiss error"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-4">
            <StatusPanel
              status={engine.status}
              message={engine.message}
              progressItems={progressItems}
              indexProgress={indexProgress}
              error={engine.error}
            />

            <QuestionBox
              value={question}
              onChange={setQuestion}
              onSubmit={() => ask()}
              onCancel={cancel}
              disabled={isBusy}
              isGenerating={isGenerating}
              examples={EXAMPLES}
              onExample={handleExample}
            />

            <SettingsPanel
              settings={settings}
              onChange={setSettings}
              disabled={isGenerating}
            />

            <AnswerCard
              current={current}
              isGenerating={isGenerating}
              onSelectSource={handleSelectSource}
              onInspect={handleInspect}
            />

            <HowItWorks summary={EVAL_SUMMARY} />
          </div>

          <div id="inspector" className="min-w-0">
            <Inspector
              current={current}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              selectedSource={selectedSource}
              onSelectSource={handleSelectSource}
            />
          </div>
        </div>

        <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-4 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Runs entirely in your browser with Transformers.js. Documentation
            from the Transformers.js repository (Apache-2.0).
          </p>
          <div className="flex gap-3">
            <a
              href="https://github.com/huggingface/transformers.js-examples/issues/79"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-600"
            >
              Issue #79
            </a>
            <a
              href="https://huggingface.co/docs/transformers.js"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-600"
            >
              Transformers.js docs
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
