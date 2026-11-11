import { SettingsIcon } from "./Icons.jsx";

export default function SettingsPanel({ settings, onChange, disabled }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white/70">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-medium text-slate-600 marker:hidden">
        <SettingsIcon className="h-4 w-4 text-slate-400" />
        Retrieval settings
        <span className="ml-auto text-[11px] text-slate-400 group-open:hidden">
          {settings.topK} sources, threshold {settings.threshold.toFixed(2)}
        </span>
      </summary>

      <div className="grid gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-slate-700">
            Sources
            <span className="font-mono text-slate-500">{settings.topK}</span>
          </span>
          <input
            type="range"
            min="2"
            max="8"
            step="1"
            value={settings.topK}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...settings, topK: Number(event.target.value) })
            }
            className="mt-2 w-full accent-indigo-600"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Chunks passed to the generator.
          </span>
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-slate-700">
            Refusal threshold
            <span className="font-mono text-slate-500">
              {settings.threshold.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min="0.15"
            max="0.6"
            step="0.01"
            value={settings.threshold}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...settings, threshold: Number(event.target.value) })
            }
            className="mt-2 w-full accent-indigo-600"
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            Refuse before generation when the top score is lower.
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={settings.strict}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...settings, strict: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
          />
          <span>
            <span className="block text-xs font-medium text-slate-700">
              Strict citation filter
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Remove answer sentences that are not entailed by a cited chunk,
              and code blocks that do not closely match a source. If nothing
              remains, refuse.
            </span>
          </span>
        </label>
      </div>
    </details>
  );
}
