import { useEffect, useRef, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  ExternalLinkIcon,
  QuoteIcon,
  ShieldCheckIcon,
  XIcon,
} from "./Icons.jsx";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "prompt", label: "Prompt" },
  { id: "checks", label: "Checks" },
];

const SENTENCE_BADGES = {
  supported: {
    label: "Supported",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  weak_support: {
    label: "Weak support",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  no_citation: {
    label: "No citation",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  invalid_citation: {
    label: "Invalid citation",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  unsupported_code: {
    label: "Unverified code",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  refusal: {
    label: "Refusal",
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
};

const INFERRED_BADGE =
  "border-indigo-200 bg-indigo-50 text-indigo-700";
const CORRECTED_BADGE = "border-amber-200 bg-amber-50 text-amber-700";
const CODE_BADGE = "border-sky-200 bg-sky-50 text-sky-700";

function scoreColor(score) {
  if (score >= 0.5) return "bg-emerald-500";
  if (score >= 0.35) return "bg-amber-500";
  return "bg-rose-400";
}

function SourcesTab({ current, selectedSource, onSelectSource }) {
  const [expanded, setExpanded] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (selectedSource) setExpanded(selectedSource);
  }, [selectedSource]);

  if (!current || !current.sources?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <QuoteIcon className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">
          No sources yet
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Ask a question to see the retrieved documentation chunks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={listRef}>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
        <span className="text-slate-500">Top score</span>
        <span className="font-mono font-semibold text-slate-800">
          {current.topScore?.toFixed(3) ?? "n/a"}
        </span>
      </div>

      {current.insufficientContext && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Below the {current.threshold?.toFixed(2)} threshold. The answer was
          refused without calling the generator.
        </p>
      )}

      {current.sources.map((source, index) => {
        const rank = index + 1;
        const isOpen = expanded === rank;
        return (
          <article
            key={source.id}
            className={`rounded-xl border bg-white transition ${
              selectedSource === rank
                ? "border-indigo-300 ring-2 ring-indigo-500/10"
                : "border-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setExpanded(isOpen ? null : rank);
                onSelectSource(rank);
              }}
              className="w-full p-3 text-left"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[10px] font-semibold text-white">
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {source.docTitle}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {source.heading}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {source.score.toFixed(3)}
                </span>
              </div>

              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${scoreColor(source.score)}`}
                  style={{
                    width: `${Math.max(4, Math.min(100, source.score * 100))}%`,
                  }}
                />
              </div>

              {!isOpen && (
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">
                  {source.text}
                </p>
              )}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <p className="whitespace-pre-wrap text-[11px] leading-5 text-slate-600">
                  {source.text}
                </p>
                <a
                  href={source.source}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Open source file
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function PromptTab({ current }) {
  if (!current?.prompt) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <QuoteIcon className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">
          No prompt available
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {current?.refusedBeforeGeneration
            ? "The model was not called because retrieval was below the threshold."
            : "Ask a question to inspect the exact prompt."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          System
        </p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[10px] leading-5 text-slate-600">
          {current.prompt.system}
        </pre>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          User
        </p>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[10px] leading-5 text-slate-600">
          {current.prompt.user}
        </pre>
      </div>
    </div>
  );
}

function ChecksTab({ current }) {
  const verification = current?.verification;

  if (!verification) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <ShieldCheckIcon className="h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">
          No checks yet
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Every answer sentence is checked for entailment in a cited chunk.
          Code blocks must match a source exactly or nearly exactly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Supported units</span>
          <span className="font-mono font-semibold text-slate-800">
            {verification.supportedCount} / {verification.totalCount}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {verification.usedNli
            ? "NLI entailment for prose, source match for code"
            : "Lexical overlap only"}
        </p>
        {verification.inferredCount > 0 && (
          <p className="mt-1 text-[11px] text-indigo-700">
            {verification.inferredCount} citation
            {verification.inferredCount === 1 ? "" : "s"} inferred from the best
            matching source
          </p>
        )}
        {verification.correctedCount > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">
            {verification.correctedCount} citation
            {verification.correctedCount === 1 ? "" : "s"} corrected
          </p>
        )}
        {verification.removedCount > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">
            {verification.removedCount} removed in strict mode
          </p>
        )}
      </div>

      <div className="space-y-2">
        {verification.sentences.map((sentence, index) => {
          const badge =
            SENTENCE_BADGES[sentence.status] ?? SENTENCE_BADGES.no_citation;
          return (
            <div
              key={`${index}-${sentence.text.slice(0, 20)}`}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
                >
                  {sentence.status === "supported" ? (
                    <CheckIcon className="h-2.5 w-2.5" />
                  ) : (
                    <XIcon className="h-2.5 w-2.5" />
                  )}
                  {badge.label}
                </span>
                {sentence.type === "code" && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CODE_BADGE}`}
                  >
                    code block
                  </span>
                )}
                {sentence.inferred && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${INFERRED_BADGE}`}
                  >
                    citation inferred [{sentence.sourceIndex}]
                  </span>
                )}
                {sentence.corrected && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${CORRECTED_BADGE}`}
                  >
                    citation corrected [{sentence.sourceIndex}]
                  </span>
                )}
                {!sentence.inferred &&
                  !sentence.corrected &&
                  sentence.citations?.length > 0 && (
                    <span className="font-mono text-[10px] text-slate-400">
                      cites {sentence.citations.map((c) => `[${c}]`).join(" ")}
                    </span>
                  )}
                <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-slate-400">
                  {sentence.nli && (
                    <span
                      title={`contradiction ${(sentence.nli.contradiction * 100).toFixed(1)}%, neutral ${(sentence.nli.neutral * 100).toFixed(1)}%`}
                    >
                      entail {(sentence.nli.entailment * 100).toFixed(0)}%
                    </span>
                  )}
                  <span>
                    {sentence.type === "code"
                      ? sentence.status === "supported"
                        ? sentence.exactMatch
                          ? "verbatim match"
                          : "near-verbatim match"
                        : "no source match"
                      : `lexical ${Math.round((sentence.lexical ?? 0) * 100)}%`}
                  </span>
                </span>
              </div>
              {sentence.type === "code" ? (
                <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950 p-2 text-[10px] leading-4 text-slate-100">
                  <code>{sentence.text}</code>
                </pre>
              ) : (
                <p className="mt-1.5 text-[11px] leading-5 text-slate-600">
                  {sentence.displayText ?? sentence.text}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {verification.removedCount > 0 && (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-600">
            Original model output
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-500">
            {verification.rawAnswer}
          </p>
        </details>
      )}
    </div>
  );
}

export default function Inspector({
  current,
  activeTab,
  onChangeTab,
  selectedSource,
  onSelectSource,
}) {
  return (
    <aside className="card flex min-h-[420px] flex-col overflow-hidden lg:sticky lg:top-4">
      <div className="border-b border-slate-100 px-2 pt-2">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`rounded-t-lg px-3 py-2 text-[11px] font-medium transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {activeTab === "sources" && (
          <SourcesTab
            current={current}
            selectedSource={selectedSource}
            onSelectSource={onSelectSource}
          />
        )}
        {activeTab === "prompt" && <PromptTab current={current} />}
        {activeTab === "checks" && <ChecksTab current={current} />}
      </div>
    </aside>
  );
}
