import { useState } from "react";
import { parseAnswerSegments } from "../lib/segments.js";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  QuoteIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "./Icons.jsx";

const BADGES = {
  grounded: {
    label: "Grounded",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: ShieldCheckIcon,
  },
  partially_grounded: {
    label: "Partially grounded",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    Icon: AlertIcon,
  },
  unsupported: {
    label: "Unsupported",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    Icon: AlertIcon,
  },
  refused: {
    label: "Refused",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    Icon: ShieldCheckIcon,
  },
  refused_after_filter: {
    label: "Refused after verification",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    Icon: ShieldCheckIcon,
  },
  empty: {
    label: "No answer",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    Icon: AlertIcon,
  },
};

function formatMs(value) {
  if (value === null || value === undefined) return "n/a";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
}

function InlineText({ text, sources, onSelectSource }) {
  const parts = text.split(/(`[^`\n]+`|\[\d+(?:\s*,\s*\d+)*\])/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
          return (
            <code
              key={index}
              className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-800"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        const match = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
        if (!match) return <span key={index}>{part}</span>;

        const numbers = match[1].split(",").map(Number);
        return (
          <span key={index} className="mx-0.5 inline-flex gap-0.5 align-baseline">
            {numbers.map((number) => {
              const source = sources[number - 1];
              const valid = Boolean(source);
              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => valid && onSelectSource(number)}
                  title={
                    valid
                      ? `${source.docTitle} - ${source.heading}`
                      : `Source ${number} was not provided`
                  }
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1 text-[10px] font-semibold transition ${
                    valid
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100"
                      : "border-rose-200 bg-rose-50 text-rose-600"
                  }`}
                >
                  {number}
                </button>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

function AnswerText({ text, sources, onSelectSource }) {
  const segments = parseAnswerSegments(text);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "code" ? (
          <pre
            key={index}
            className="my-2 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100"
          >
            <code>{segment.code}</code>
          </pre>
        ) : (
          <InlineText
            key={index}
            text={segment.text}
            sources={sources}
            onSelectSource={onSelectSource}
          />
        ),
      )}
    </>
  );
}

export default function AnswerCard({
  current,
  isGenerating,
  onSelectSource,
  onInspect,
}) {
  const [copied, setCopied] = useState(false);

  if (!current) {
    return (
      <section className="card flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <QuoteIcon className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">
          Answers with receipts
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Ask a question about Transformers.js. The app retrieves documentation
          chunks, generates an answer from them, and checks every citation
          before showing the result.
        </p>
        <div className="mt-5 grid w-full max-w-md gap-2 text-left sm:grid-cols-3">
          {[
            ["1", "Embed", "all-MiniLM-L6-v2"],
            ["2", "Retrieve", "cosine + MMR"],
            ["3", "Verify", "citations + overlap"],
          ].map(([step, title, detail]) => (
            <div
              key={step}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <span className="text-[10px] font-semibold text-indigo-500">
                STEP {step}
              </span>
              <p className="mt-0.5 text-xs font-semibold text-slate-800">
                {title}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const verification = current.verification;
  const badge = verification ? BADGES[verification.status] : null;
  const BadgeIcon = badge?.Icon ?? SparklesIcon;
  const answerText = verification?.answer ?? current.streaming ?? "";
  const showStreaming = isGenerating && !verification;

  async function copyAnswer() {
    if (!answerText) return;
    try {
      await navigator.clipboard.writeText(answerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable.
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Question
            </p>
            <h2 className="mt-1 text-base font-semibold leading-6 text-slate-900">
              {current.question}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {badge ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.className}`}
              >
                <BadgeIcon className="h-3.5 w-3.5" />
                {badge.label}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                {current.status === "retrieving"
                  ? "Retrieving"
                  : current.status === "verifying"
                    ? "Verifying"
                    : "Generating"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        {current.status === "retrieving" && !answerText && (
          <div className="space-y-2">
            <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-9/12 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-slate-100" />
          </div>
        )}

        {answerText && (
          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            <AnswerText
              text={answerText}
              sources={current.sources ?? []}
              onSelectSource={onSelectSource}
            />
            {showStreaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-indigo-500 align-middle" />
            )}
          </div>
        )}

        {current.status === "verifying" && current.verifyingMessage && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            {current.verifyingMessage}
          </p>
        )}

        {verification && (
          <div className="mt-4 space-y-2">
            {current.refusedBeforeGeneration && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The best retrieval score was below the refusal threshold, so the
                language model was not called.
              </p>
            )}

            {verification.removedCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Removed {verification.removedCount} unsupported sentence
                {verification.removedCount === 1 ? "" : "s"} or code block
                {verification.removedCount === 1 ? "" : "s"} in strict mode.
                Open Checks to see the original output.
              </p>
            )}

            {verification.invalidCitations.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The model cited source
                {verification.invalidCitations.length === 1 ? " " : "s "}
                {verification.invalidCitations.join(", ")}, which were not
                provided.
              </p>
            )}

            {verification.inferredCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The model omitted{" "}
                {verification.inferredCount === 1 ? "a citation" : "citations"}.
                The verifier added{" "}
                {verification.inferredCount === 1 ? "one" : "them"} after matching
                the sentence to a source.
              </p>
            )}

            {verification.correctedCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Corrected {verification.correctedCount} citation
                {verification.correctedCount === 1 ? "" : "s"} that pointed to the
                wrong source.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          {current.timings && (
            <>
              <span>{formatMs(current.timings.totalMs)} total</span>
              <span>{formatMs(current.timings.retrievalMs)} retrieval</span>
              {current.timings.generationMs > 0 && (
                <span>{formatMs(current.timings.generationMs)} generation</span>
              )}
              {current.timings.verificationMs > 0 && (
                <span>{formatMs(current.timings.verificationMs)} verification</span>
              )}
              {current.timings.tokensPerSecond > 0 && (
                <span>
                  {Math.round(current.timings.tokensPerSecond)} tok/s
                </span>
              )}
            </>
          )}
          <span>
            {current.sources?.length ?? 0} source
            {current.sources?.length === 1 ? "" : "s"}
          </span>
          {verification?.citations?.length > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <CheckIcon className="h-3 w-3" />
              {verification.citations.length} cited
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onInspect("checks")}
              className="rounded-md px-2 py-1 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Checks
            </button>
            <button
              type="button"
              onClick={() => onInspect("prompt")}
              className="rounded-md px-2 py-1 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Prompt
            </button>
            <button
              type="button"
              onClick={copyAnswer}
              disabled={!answerText}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {copied ? (
                <CheckIcon className="h-3 w-3 text-emerald-500" />
              ) : (
                <CopyIcon className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
