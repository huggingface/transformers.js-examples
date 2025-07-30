import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useVoxtral } from "./useVoxtral";
import HfIcon from "./HfIcon";

type Transcription = {
  id: string;
  filename: string;
  date: string;
  text: string | null;
  audioKey?: string;
  language: string;
};

type Screen = "intro" | "loading" | "main";

const LANGUAGES = [
  { code: "en", label: "English", icon: "🇬🇧" },
  { code: "fr", label: "Français", icon: "🇫🇷" },
  { code: "de", label: "Deutsch", icon: "🇩🇪" },
  { code: "es", label: "Español", icon: "🇪🇸" },
  { code: "it", label: "Italiano", icon: "🇮🇹" },
  { code: "pt", label: "Português", icon: "🇵🇹" },
  { code: "nl", label: "Nederlands", icon: "🇳🇱" },
  { code: "hi", label: "हिन्दी", icon: "🇮🇳" },
];

const DB_NAME = "voxtral-db";
const DB_VERSION = 1;
const HISTORY_STORE = "history";
const AUDIO_STORE = "audio";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(AUDIO_STORE)) {
          db.createObjectStore(AUDIO_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function promiseify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getHistoryDB(): Promise<Transcription[]> {
  const db = await getDB();
  const tx = db.transaction(HISTORY_STORE, "readonly");
  const store = tx.objectStore(HISTORY_STORE);
  return (await promiseify(store.getAll())) as Transcription[];
}

async function saveHistoryDB(history: Transcription[]) {
  const db = await getDB();
  const tx = db.transaction(HISTORY_STORE, "readwrite");
  const store = tx.objectStore(HISTORY_STORE);
  history.forEach((item) => store.put(item));
  return transactionPromise(tx);
}

async function removeHistoryItemDB(id: string) {
  const db = await getDB();
  const tx = db.transaction(HISTORY_STORE, "readwrite");
  tx.objectStore(HISTORY_STORE).delete(id);
  return transactionPromise(tx);
}

async function saveAudioToDB(key: string, file: File): Promise<void> {
  const db = await getDB();
  const arrayBuffer = await file.arrayBuffer();
  const tx = db.transaction(AUDIO_STORE, "readwrite");
  tx.objectStore(AUDIO_STORE).put({ key, buffer: arrayBuffer, type: file.type });
  return transactionPromise(tx);
}

async function getAudioUrlFromDB(key: string): Promise<string | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const result = await promiseify(tx.objectStore(AUDIO_STORE).get(key));

    if (result?.buffer) {
      const blob = new Blob([result.buffer], { type: result.type || "audio/wav" });
      return URL.createObjectURL(blob);
    }
    return null;
  } catch {
    return null;
  }
}

async function removeAudioFromDB(key?: string) {
  if (!key) return;
  const db = await getDB();
  const tx = db.transaction(AUDIO_STORE, "readwrite");
  tx.objectStore(AUDIO_STORE).delete(key);
  return transactionPromise(tx);
}

function inferAudioKey(item: Transcription): string | undefined {
  return item.audioKey ?? (item.id ? `voxtral_audio_${item.id}` : undefined);
}

async function fileToAudioBuffer(file: File, targetSampleRate: number): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    if (decoded.sampleRate === targetSampleRate) {
      await audioCtx.close();
      return decoded;
    }

    const offlineCtx = new OfflineAudioContext(
      decoded.numberOfChannels,
      Math.ceil(decoded.duration * targetSampleRate),
      targetSampleRate,
    );
    const src = offlineCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(offlineCtx.destination);
    src.start();
    const rendered = await offlineCtx.startRendering();
    await audioCtx.close();
    return rendered;
  } catch (error) {
    console.error("Failed to decode or resample audio:", error);
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [history, setHistory] = useState<Transcription[]>([]);
  const [viewedTranscription, setViewedTranscription] = useState<Transcription | null>(null);
  const [pendingTranscriptionId, setPendingTranscriptionId] = useState<string | null>(null);
  const [audioSaveError, setAudioSaveError] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [search, setSearch] = useState("");

  const [audioUrlCache, setAudioUrlCache] = useState<Map<string, string>>(new Map());
  const { status, error, transcription, setTranscription, loadModel, transcribe, stopTranscription } = useVoxtral();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filenameInputRef = useRef<HTMLInputElement | null>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const urlCacheRef = useRef(audioUrlCache);

  const sortedHistory = useMemo(() => [...history].sort((a, b) => Number(b.id) - Number(a.id)), [history]);
  const currentTranscription = useMemo(() => {
    if (!viewedTranscription) return "";
    if (pendingTranscriptionId === viewedTranscription.id) {
      return transcription;
    }
    return viewedTranscription.text;
  }, [viewedTranscription, pendingTranscriptionId, transcription]);

  const audioSrc = useMemo(() => {
    if (!viewedTranscription) return null;
    const key = inferAudioKey(viewedTranscription);
    return key ? (audioUrlCache.get(key) ?? null) : null;
  }, [viewedTranscription, audioUrlCache]);

  const filteredHistory = useMemo(() => {
    if (!search.trim()) return sortedHistory;
    const s = search.trim().toLowerCase();
    return sortedHistory.filter(
      (item) => item.filename.toLowerCase().includes(s) || (item.text && item.text.toLowerCase().includes(s)),
    );
  }, [sortedHistory, search]);

  const handleFile = useCallback(
    async (file: File) => {
      const id = Date.now().toString();
      const audioKey = `voxtral_audio_${id}`;
      setAudioSaveError(null);

      const objectUrl = URL.createObjectURL(file);
      setAudioUrlCache((prev) => {
        if (prev.get(audioKey) === objectUrl) return prev;
        return new Map(prev).set(audioKey, objectUrl);
      });

      const entry: Transcription = {
        id,
        filename: file.name.replace(/\.[^/.]+$/, ""),
        date: new Date().toLocaleString(),
        text: null,
        audioKey,
        language: selectedLanguage,
      };

      setTranscription("");
      setHistory((prev) => [entry, ...prev]);
      setViewedTranscription(entry);
      setPendingTranscriptionId(id);

      saveAudioToDB(audioKey, file).catch((e) => {
        console.error("DB save error:", e);
        setAudioSaveError("Failed to save to IndexedDB. Storage may be full.");
      });
      saveHistoryDB([entry]).catch(() => {});

      const audioBuffer = await fileToAudioBuffer(file, 16000);
      const result = audioBuffer
        ? await transcribe(audioBuffer.getChannelData(0), selectedLanguage)
        : "Failed to decode audio.";

      const finalEntry = { ...entry, text: result ?? "Transcription failed." };
      setHistory((currentHistory) => {
        const finalHistory = currentHistory.map((h) => (h.id === id ? finalEntry : h));
        saveHistoryDB(finalHistory);
        return finalHistory;
      });
      setViewedTranscription(finalEntry);
      setPendingTranscriptionId(null);
    },
    [transcribe, setTranscription, selectedLanguage],
  );

  const deleteHistoryItem = useCallback(
    async (e: React.MouseEvent, item: Transcription) => {
      e.stopPropagation();
      const isCurrentlyViewed = viewedTranscription?.id === item.id;
      const key = inferAudioKey(item);
      const newHistory = history.filter((h) => h.id !== item.id);

      setHistory(newHistory);
      if (isCurrentlyViewed) {
        setViewedTranscription(newHistory.length > 0 ? newHistory[0] : null);
      }

      await removeHistoryItemDB(item.id);
      await removeAudioFromDB(key);

      if (key) {
        setAudioUrlCache((prev) => {
          const newCache = new Map(prev);
          const urlToRevoke = newCache.get(key);
          if (urlToRevoke) {
            URL.revokeObjectURL(urlToRevoke);
          }
          newCache.delete(key);
          return newCache;
        });
      }
    },
    [history, viewedTranscription],
  );

  const updateFilename = useCallback(async (id: string, newFilename: string) => {
    setHistory((prev) => {
      const updated = prev.map((h) => (h.id === id ? { ...h, filename: newFilename } : h));
      saveHistoryDB(updated);
      return updated;
    });
  }, []);

  const updateTranscriptionText = useCallback(async (id: string, newText: string) => {
    setViewedTranscription((prev) => (prev && prev.id === id ? { ...prev, text: newText } : prev));
    setHistory((prev) => {
      const updated = prev.map((h) => (h.id === id ? { ...h, text: newText } : h));
      saveHistoryDB(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*,video/*";
    input.style.display = "none";
    const handleChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        handleFile(file);
      }
      target.value = "";
    };
    input.addEventListener("change", handleChange);
    document.body.appendChild(input);
    fileInputRef.current = input;

    return () => {
      input.removeEventListener("change", handleChange);
      document.body.removeChild(input);
    };
  }, [handleFile]);

  useEffect(() => {
    (async () => {
      const hist = await getHistoryDB();
      setHistory(hist);
    })();
  }, []);

  useEffect(() => {
    if (!viewedTranscription) return;

    const key = inferAudioKey(viewedTranscription);
    if (!key || audioUrlCache.has(key)) {
      return;
    }

    let cancelled = false;
    (async () => {
      const url = await getAudioUrlFromDB(key);
      if (url && !cancelled) {
        setAudioUrlCache((prev) => new Map(prev).set(key, url));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewedTranscription, audioUrlCache]);

  useEffect(() => {
    return () => {
      for (const url of urlCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (screen === "main" && sortedHistory.length > 0 && !viewedTranscription) {
      setViewedTranscription(sortedHistory[0]);
    }
  }, [screen, sortedHistory, viewedTranscription]);

  useEffect(() => {
    if (screen !== "intro" || !introRef.current) return;
    const ref = introRef.current;
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { offsetWidth, offsetHeight } = ref;
      const x = (clientX / offsetWidth) * 100;
      const y = (clientY / offsetHeight) * 100;
      ref.style.setProperty("--mouse-x", `${x}%`);
      ref.style.setProperty("--mouse-y", `${y}%`);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [screen]);

  useEffect(() => {
    if (editingFilename && filenameInputRef.current) {
      filenameInputRef.current.focus();
      filenameInputRef.current.select();
    }
  }, [editingFilename]);

  if (screen === "intro") {
    return (
      <div
        ref={introRef}
        className="relative flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] text-white overflow-hidden"
        style={{ "--mouse-x": "50%", "--mouse-y": "50%" } as React.CSSProperties}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_400px_at_var(--mouse-x)_var(--mouse-y),rgba(124,58,237,0.2),transparent_80%)]"></div>

        <main className="text-center z-10 p-4">
          <div className="inline-block mb-6 px-3 py-1 text-md bg-gray-800/50 border border-gray-700 rounded-full">
            Powered by{" "}
            <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noopener noreferrer">
              <HfIcon className="w-5 inline translate-y-[-1px]" />
              Transformers.js
            </a>
          </div>
          <h1 className="text-7xl font-extrabold tracking-tight mb-4">Voxtral WebGPU</h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-400 mb-8">
            State-of-the-art audio transcription directly in your browser.
          </p>
          <div className="max-w-xl mx-auto text-md text-gray-500 mb-8 space-y-2 text-left bg-black/20 p-4 border border-gray-800 rounded-lg">
            <p>
              You are about to load{" "}
              <a
                href="https://huggingface.co/onnx-community/Voxtral-Mini-3B-2507-ONNX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 opacity-90 hover:opacity-100 hover:underline font-semibold transition-opacity"
              >
                Voxtral-Mini
              </a>
              , a 4.68B parameter model, optimized for inference on the web.
            </p>
            <p>
              Everything runs entirely in your browser with <strong>Transformers.js</strong> and{" "}
              <strong>ONNX Runtime Web</strong>, meaning no data is sent to a server.
            </p>
            <p>Get started by clicking the button below.</p>
          </div>
          <div className="flex justify-center">
            <button
              className="px-6 py-3 bg-purple-600 rounded-lg font-semibold hover:bg-purple-700 transition-transform hover:scale-105 cursor-pointer"
              onClick={async () => {
                setScreen("loading");
                await loadModel();
                setScreen("main");
              }}
            >
              Load Model
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (screen === "loading" || status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] text-white p-4">
        <div className="flex flex-col items-center p-8 bg-gray-900/50 border border-gray-700 rounded-xl shadow-lg w-full max-w-2xl">
          <h2 className="text-2xl font-semibold mb-2 text-purple-400">Loading Voxtral Model...</h2>
          <p className="text-gray-400 text-center mb-8">
            This may take some time to download on first load.
            <br />
            Afterwards, the model will be cached for future use.
          </p>
          <div className="w-full space-y-3">
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-500 h-2.5 rounded-full animate-progress"
                style={{ width: "75%", animationDelay: "0.1s" }}
              ></div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-500 h-2.5 rounded-full animate-progress"
                style={{ width: "75%", animationDelay: "0.2s" }}
              ></div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-purple-500 h-2.5 rounded-full animate-progress"
                style={{ width: "75%", animationDelay: "0.3s" }}
              ></div>
            </div>
          </div>
          {error && (
            <div className="mt-6 text-red-500 bg-red-900/20 border border-red-500/30 p-3 rounded-lg">{error}</div>
          )}
        </div>
      </div>
    );
  }

  const isProcessing = pendingTranscriptionId && pendingTranscriptionId === viewedTranscription?.id;

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white font-sans">
      <aside className="w-80 bg-black/30 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex flex-col flex-1">
            <h2 className="text-lg font-bold text-gray-200">Transcript History</h2>
            <select
              className="mt-2 bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-[150px]"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              title="Select language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <input
              className="mt-2 bg-gray-800 text-gray-200 rounded px-2 py-1 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
              type="text"
              placeholder="Search transcripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="ml-2 p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:bg-gray-800/50 disabled:text-gray-500 disabled:cursor-not-allowed"
            title="Add new file"
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "transcribing"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No transcriptions yet.</div>
          ) : (
            <ul>
              {filteredHistory.map((item) => {
                const language = LANGUAGES.find((l) => l.code === item.language);
                return (
                  <li
                    key={item.id}
                    className={`border-b border-gray-800 px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer flex items-start group relative ${viewedTranscription?.id === item.id ? "bg-purple-900/20" : ""}`}
                    onClick={() => setViewedTranscription(item)}
                  >
                    {viewedTranscription?.id === item.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-r-full"></div>
                    )}
                    <div className="flex-1 min-w-0 pl-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-300 truncate">{item.filename}</div>
                        <div className="text-xs text-gray-500 mb-1">{item.date}</div>
                        <div className="text-sm text-gray-400 line-clamp-2">
                          {item.text !== null ? (
                            item.text
                          ) : (
                            <span className="text-gray-500 italic">Transcription in progress...</span>
                          )}
                        </div>
                      </div>
                      <span className="text-lg flex-shrink-0 ml-2" title={language?.label || item.language}>
                        {language?.icon || "🌐"}
                      </span>
                    </div>
                    <button
                      className="ml-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete transcription"
                      onClick={(e) => deleteHistoryItem(e, item)}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <div className="w-full h-full flex-1 p-8 flex justify-center">
          <div className="w-full max-w-4xl h-full flex flex-col">
            {audioSaveError && (
              <div className="mb-4 text-red-500 bg-red-900/20 border border-red-500/30 p-3 rounded-lg">
                {audioSaveError}
              </div>
            )}
            {!viewedTranscription ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-600">
                <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-gray-500">Select a transcription</h2>
                <p className="text-gray-600">Choose an item from the history or add a new file to begin.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="mb-4 relative">
                  {editingFilename ? (
                    <input
                      ref={filenameInputRef}
                      className="text-2xl font-bold text-gray-200 truncate bg-gray-800 border border-purple-500 rounded px-2 py-1 outline-none w-full"
                      style={{
                        lineHeight: "2.25rem",
                        minHeight: "2.75rem",
                        height: "2.75rem",
                        fontFamily: "inherit",
                        fontWeight: "700",
                        fontSize: "1.5rem",
                        padding: "0.25rem 0.5rem",
                      }}
                      value={viewedTranscription.filename}
                      onChange={(e) => setViewedTranscription({ ...viewedTranscription, filename: e.target.value })}
                      onBlur={() => {
                        setEditingFilename(false);
                        updateFilename(viewedTranscription.id, viewedTranscription.filename);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape") {
                          e.preventDefault();
                          setEditingFilename(false);
                          updateFilename(viewedTranscription.id, viewedTranscription.filename);
                        }
                      }}
                    />
                  ) : (
                    <h1
                      className="text-2xl font-bold text-gray-200 truncate cursor-pointer hover:underline w-full px-2 py-1 rounded"
                      style={{
                        lineHeight: "2.25rem",
                        minHeight: "2.75rem",
                        height: "2.75rem",
                        fontFamily: "inherit",
                        fontWeight: "700",
                        fontSize: "1.5rem",
                        padding: "0.25rem 0.5rem",
                        border: "1px solid transparent",
                        boxSizing: "border-box",
                        pointerEvents: isProcessing ? "none" : "auto",
                      }}
                      title="Click to rename"
                      onClick={() => setEditingFilename(true)}
                    >
                      {viewedTranscription.filename}
                    </h1>
                  )}
                  <p className="text-sm text-gray-500 pl-2">{viewedTranscription.date}</p>
                </div>

                <div className="mb-6">
                  <audio src={audioSrc || undefined} controls className="w-full styled-audio" />
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                  <div className="absolute inset-0 bg-gray-900/50 border border-gray-700 rounded-lg p-1">
                    <textarea
                      className="w-full h-full bg-transparent rounded-md p-4 text-gray-300 font-mono text-base resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-gray-500"
                      value={currentTranscription || ""}
                      onChange={(e) => updateTranscriptionText(viewedTranscription.id, e.target.value)}
                      readOnly={!!isProcessing}
                    />
                  </div>
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 rounded-lg z-10">
                      <div className="flex flex-col items-center text-gray-400 relative">
                        <span className="relative flex h-10 w-10">
                          <span className="relative inline-flex rounded-full h-10 w-10 items-center justify-center animate-spin-slow">
                            <svg className="h-7 w-7 text-purple-400" viewBox="0 0 24 24" fill="none">
                              <circle
                                className="opacity-30"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                d="M22 12a10 10 0 00-10-10"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                                className="text-purple-500"
                              />
                            </svg>
                          </span>
                        </span>
                        <span className="mt-2 pointer-events-none">
                          {transcription.length === 0 ? "Processing audio..." : "Transcribing..."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between mt-4">
                  {isProcessing ? (
                    <button
                      className="bottom-8 left-8 z-20 px-4 py-2 bg-gray-800 text-red-400 rounded shadow-lg transition-colors text-base font-medium flex items-center gap-2 cursor-pointer hover:bg-red-900 hover:text-white"
                      title="Stop transcription"
                      onClick={stopTranscription}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                      </svg>
                      Stop
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    className={`bottom-8 right-8 z-20 px-4 py-2 bg-gray-800 text-gray-200 rounded shadow-lg transition-colors text-base font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed${
                      viewedTranscription.text ? " hover:bg-purple-700" : ""
                    }`}
                    title="Download transcript"
                    disabled={!viewedTranscription.text}
                    onClick={() => {
                      const baseName = viewedTranscription.filename;
                      const filename = `${baseName}.txt`;
                      const blob = new Blob([viewedTranscription.text ?? ""], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => {
                        URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      }, 100);
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                      />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
