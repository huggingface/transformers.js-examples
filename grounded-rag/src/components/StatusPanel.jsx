import { AlertIcon, CheckIcon } from "./Icons.jsx";

function formatBytes(bytes) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export default function StatusPanel({
  status,
  message,
  progressItems,
  indexProgress,
  error,
}) {
  if (status === "ready" && !error) return null;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 p-5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          {error ? (
            <AlertIcon className="h-5 w-5 text-rose-500" />
          ) : (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">
            {error ? "Something went wrong" : "Preparing the demo"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {error ?? message ?? "Starting..."}
          </p>

          {indexProgress && !error && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {indexProgress.stage === "cached"
                    ? "Loaded embeddings from browser cache"
                    : "Embedding documentation chunks"}
                </span>
                <span>
                  {indexProgress.current} / {indexProgress.total}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                  style={{
                    width: `${
                      indexProgress.total
                        ? (indexProgress.current / indexProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {progressItems.length > 0 && !error && (
        <div className="max-h-56 overflow-auto bg-slate-50/70 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Model files
          </p>
          <ul className="space-y-2">
            {progressItems.map((item) => {
              const percent =
                item.total > 0
                  ? Math.min(100, Math.round((item.loaded / item.total) * 100))
                  : 0;
              return (
                <li key={item.file ?? item.name} className="text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-[11px] text-slate-600">
                      {item.file ?? item.name}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {item.status === "done" ? (
                        <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        `${percent}%`
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-400 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {item.total > 0 && (
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {formatBytes(item.loaded)} / {formatBytes(item.total)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
