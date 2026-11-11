import {
  BookIcon,
  LayersIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "./Icons.jsx";

const STEPS = [
  {
    Icon: BookIcon,
    title: "Chunk",
    text: "The Transformers.js docs are split on headings and paragraphs into retrieval-sized chunks.",
  },
  {
    Icon: LayersIcon,
    title: "Embed",
    text: "all-MiniLM-L6-v2 turns every chunk into a normalized vector, cached in IndexedDB.",
  },
  {
    Icon: SearchIcon,
    title: "Retrieve",
    text: "Cosine similarity plus MMR selects diverse sources. A score threshold can refuse before generation.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Verify",
    text: "Each sentence needs entailment in a cited chunk. Code blocks must match a source, exactly or nearly exactly. Everything else is removed.",
  },
];

export default function HowItWorks({ summary }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-900">How it works</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ Icon, title, text }, index) => (
          <article key={title} className="card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Step {index + 1}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-800">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
          </article>
        ))}
      </div>

      {summary && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-xs font-semibold text-slate-800">
              Evaluation snapshot
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {summary.questions} questions, {summary.answerable} answerable and{" "}
              {summary.unanswerable} unanswerable. Baseline answers use the same
              model without retrieval. Reproduce with{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                npm run eval
              </code>
              .
            </p>
          </div>
          <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              ["Retrieval hit@4", summary.hitAt4],
              ["Citations (RAG)", summary.citationRate],
              ["Fully grounded (RAG)", summary.groundedRate],
              ["Refusal accuracy", summary.refusalAccuracy],
              ["Citations (baseline)", summary.ungroundedCitationRate],
              ["Grounded (baseline)", summary.ungroundedGroundedRate],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
