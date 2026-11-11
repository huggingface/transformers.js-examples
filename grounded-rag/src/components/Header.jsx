import { CpuIcon, GithubIcon, LayersIcon, ShieldCheckIcon } from "./Icons.jsx";

const REPO_URL =
  "https://github.com/huggingface/transformers.js-examples/tree/main/grounded-rag";

export default function Header({ info, engineStatus }) {
  return (
    <header className="border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
            <ShieldCheckIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Grounded RAG
              </h1>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                Transformers.js docs
              </span>
            </div>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
              Ask the documentation. Every answer is cited, checked against the
              retrieved chunks, or refused.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
            <CpuIcon className="h-3.5 w-3.5 text-indigo-500" />
            {info?.webgpu ? "WebGPU" : "WASM"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
            <LayersIcon className="h-3.5 w-3.5 text-indigo-500" />
            {engineStatus === "ready"
              ? `${info?.chunks ?? 0} chunks`
              : "Indexing docs"}
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <GithubIcon className="h-3.5 w-3.5" />
            Source
          </a>
        </div>
      </div>
    </header>
  );
}
