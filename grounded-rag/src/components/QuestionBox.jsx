import { ArrowRightIcon, SearchIcon, StopIcon } from "./Icons.jsx";

export default function QuestionBox({
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  isGenerating,
  examples,
  onExample,
}) {
  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <SearchIcon className="h-4 w-4 text-indigo-500" />
        Ask the docs
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-1 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
          placeholder="How do I run a model on WebGPU?"
          className="block w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-3 px-2 pb-1.5">
          <span className="text-[11px] text-slate-400">
            Enter to ask, Shift + Enter for a new line
          </span>
          {isGenerating ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
            >
              <StopIcon className="h-3.5 w-3.5" />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled || !value.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              Ask
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled}
            onClick={() => onExample(example)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
