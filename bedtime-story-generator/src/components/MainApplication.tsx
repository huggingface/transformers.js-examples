import { useReducer, useState, useRef, useEffect, useCallback } from "react";
import type React from "react";
import { Dices, RefreshCw } from "lucide-react";

import type { generateFn } from "../hooks/useLLM";
import NeoButton from "./NeoButton";
import OptionCard from "./OptionCard";
import { STORY_DATA } from "../constants";

interface MainApplicationProps {
  isVisible: boolean;
  playPopSound: () => void;
  playHoverSound: () => void;
  generate: generateFn;
  streamTTS: (onAudioChunk: (chunk: { audio: Float32Array; text?: string }) => void) => {
    splitter: any;
    ttsPromise: Promise<void>;
  };
  isTTSReady: boolean;
  audioWorkletNode: AudioWorkletNode | null;
  toggleMusic: (force?: boolean) => void;
  isMusicPlaying: boolean;
}

type StoryState = {
  character: string;
  setting: string;
  item: string;
  theme: string;
  length: string;
  customCharacter: string;
  customSetting: string;
  customItem: string;
};

type StoryAction =
  | { type: "SET_FIELD"; field: keyof StoryState; value: string }
  | {
      type: "SURPRISE_ME";
      payload: Omit<StoryState, "customCharacter" | "customSetting" | "customItem">;
    }
  | { type: "RESET" };

const initialState: StoryState = {
  character: STORY_DATA.characters[0],
  setting: STORY_DATA.settings[0],
  item: STORY_DATA.items[0],
  theme: STORY_DATA.themes[0],
  length: STORY_DATA.length[0],
  customCharacter: "",
  customSetting: "",
  customItem: "",
};

const storyReducer = (state: StoryState, action: StoryAction): StoryState => {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SURPRISE_ME":
      return { ...initialState, ...action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
};

const MainApplication: React.FC<MainApplicationProps> = ({
  isVisible,
  playPopSound,
  playHoverSound,
  generate,
  streamTTS,
  isTTSReady,
  audioWorkletNode,
  toggleMusic,
  isMusicPlaying,
}) => {
  const [storyState, dispatch] = useReducer(storyReducer, initialState);
  const { character, setting, item, theme, length, customCharacter, customSetting, customItem } = storyState;

  const [generatedStory, setGeneratedStory] = useState<string | null>(null);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [previewText, setPreviewText] = useState<string>("");

  const storyPanelRef = useRef<HTMLDivElement | null>(null);

  const [ranges, setRanges] = useState<Array<{ start: number; end: number }>>([]);
  const rangesRef = useRef(ranges);
  useEffect(() => {
    rangesRef.current = ranges;
  }, [ranges]);

  const pendingRef = useRef<string[]>([]);
  const rawSearchStartRef = useRef(0);
  const normDataRef = useRef<{ norm: string; map: number[] } | null>(null);

  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(-1);
  const finishedIndexRef = useRef<number>(-1);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const chunkRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const resumeMusicOnPlaybackEndRef = useRef<boolean>(false);
  const activeSplitterRef = useRef<any>(null);

  const displayedText = previewText || generatedStory || "";

  const buildNorm = (text: string) => {
    const map: number[] = [];
    let norm = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) continue;
      map.push(i);
      norm += ch;
    }
    return { norm, map };
  };

  const tryResolve = useCallback(() => {
    const normData = normDataRef.current;
    if (!normData) return;

    const { norm, map } = normData;
    const nextRanges = rangesRef.current.slice();

    const normStartFromRaw = () => {
      let i = 0;
      while (i < map.length && map[i] < rawSearchStartRef.current) i++;
      return i;
    };

    let changed = false;
    while (pendingRef.current.length) {
      const nextText = pendingRef.current[0];
      const needle = nextText.replace(/\s+/g, "");
      if (!needle) {
        pendingRef.current.shift();
        continue;
      }
      const startNormIdx = normStartFromRaw();
      const idx = norm.indexOf(needle, startNormIdx);
      if (idx === -1) break;

      const startRaw = map[idx];
      const endRaw = map[idx + needle.length - 1] + 1;

      nextRanges.push({ start: startRaw, end: endRaw });
      rawSearchStartRef.current = endRaw;
      pendingRef.current.shift();
      changed = true;
    }

    if (changed) {
      setRanges(nextRanges);
      setCurrentChunkIdx((prev) =>
        prev === -1 ? Math.min(finishedIndexRef.current + 1, nextRanges.length - 1) : prev,
      );
    }
  }, []);

  useEffect(() => {
    normDataRef.current = buildNorm(displayedText);
    tryResolve();
  }, [displayedText, tryResolve]);

  useEffect(() => {
    if (!audioWorkletNode) return;
    const handler = (event: MessageEvent) => {
      const data = (event as any).data;
      if (!data || typeof data !== "object") return;
      if (data.type === "next_chunk") {
        finishedIndexRef.current += 1;
        const nextIdx = finishedIndexRef.current + 1;
        setCurrentChunkIdx(nextIdx < rangesRef.current.length ? nextIdx : -1);
      } else if (data.type === "playback_ended") {
        setIsSpeaking(false);
        setCurrentChunkIdx(-1);
        if (resumeMusicOnPlaybackEndRef.current) {
          toggleMusic();
        }
      }
    };
    (audioWorkletNode.port as any).onmessage = handler;
    return () => {
      if (audioWorkletNode?.port) (audioWorkletNode.port as any).onmessage = null;
    };
  }, [audioWorkletNode, toggleMusic]);

  useEffect(() => {
    if (currentChunkIdx < 0) return;
    const container = textContainerRef.current;
    const el = chunkRefs.current[currentChunkIdx];
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTopInContainer = elRect.top - containerRect.top + container.scrollTop;
    const targetTop = Math.max(0, elTopInContainer - container.clientHeight * 0.3);
    container.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [currentChunkIdx]);

  const getRandomItem = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

  const handleSurpriseMe = () => {
    playPopSound();
    if (isShuffling) return;
    setIsShuffling(true);
    dispatch({ type: "SET_FIELD", field: "customCharacter", value: "" });
    dispatch({ type: "SET_FIELD", field: "customSetting", value: "" });
    dispatch({ type: "SET_FIELD", field: "customItem", value: "" });

    let count = 0;
    const max = 15;
    const interval = setInterval(() => {
      dispatch({
        type: "SURPRISE_ME",
        payload: {
          character: getRandomItem(STORY_DATA.characters),
          setting: getRandomItem(STORY_DATA.settings),
          item: getRandomItem(STORY_DATA.items),
          theme: getRandomItem(STORY_DATA.themes),
          length: getRandomItem(STORY_DATA.length),
        },
      });
      count++;
      if (count >= max) {
        clearInterval(interval);
        setIsShuffling(false);
      }
    }, 60);
  };

  const generateStory = async () => {
    if (!audioWorkletNode) return;
    playPopSound();
    setIsLoading(true);
    setPreviewText("");
    setGeneratedStory(null);

    setRanges([]);
    rangesRef.current = [];
    pendingRef.current = [];
    rawSearchStartRef.current = 0;
    setCurrentChunkIdx(-1);
    finishedIndexRef.current = -1;
    chunkRefs.current = [];

    const wasMusicPlaying = isMusicPlaying;
    resumeMusicOnPlaybackEndRef.current = wasMusicPlaying;

    storyPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    setIsSpeaking(true);
    if (wasMusicPlaying) toggleMusic();

    const { splitter, ttsPromise } = streamTTS(({ audio, text }) => {
      audioWorkletNode.port.postMessage(audio);
      if (text) {
        pendingRef.current.push(text);
        tryResolve();
      }
    });
    activeSplitterRef.current = splitter;

    const selectedCharacter = (customCharacter || character).trim();
    const selectedSetting = (customSetting || setting).trim();
    const selectedItem = (customItem || item).trim();

    const lengthMap: Record<string, string> = {
      Short: "100-200 word",
      Medium: "200-300 word",
      Long: "300-400 word",
    };

    const userMessage = `Write a ${lengthMap[length]} ${theme.toLowerCase()} story about ${selectedCharacter} ${selectedSetting} that ${selectedItem}.`;

    try {
      const llmPromise = generate(
        [{ role: "user", content: userMessage }],
        (token: string) => setPreviewText((prev) => prev + token),
        splitter,
      );
      await Promise.all([llmPromise, ttsPromise]);
    } catch {
      setGeneratedStory(previewText || "Sorry, the story failed to generate.");
    } finally {
      activeSplitterRef.current = null;
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    playPopSound();

    activeSplitterRef.current?.close?.();
    activeSplitterRef.current = null;
    audioWorkletNode?.port.postMessage("stop");
    setIsSpeaking(false);

    if (!isMusicPlaying && resumeMusicOnPlaybackEndRef.current) {
      toggleMusic();
    }
    resumeMusicOnPlaybackEndRef.current = false;

    setRanges([]);
    rangesRef.current = [];
    pendingRef.current = [];
    rawSearchStartRef.current = 0;
    setCurrentChunkIdx(-1);
    finishedIndexRef.current = -1;
    chunkRefs.current = [];

    setGeneratedStory(null);
    setPreviewText("");

    dispatch({ type: "RESET" });
  };

  const transitionClass = isVisible ? "opacity-100" : "opacity-0 translate-y-10 pointer-events-none";

  return (
    <div
      className={`h-screen py-16 px-8 overflow-y-scroll transition-all duration-700 ease-in-out ${isVisible ? "delay-300" : ""} ${transitionClass}`}
    >
      <header className="text-center mb-8">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter">Let's Make a Story!</h1>
        <p className="text-lg mt-2 bg-cyan-300 inline-block px-3 py-1 border-2 border-black rounded-md">
          Runs completely on your device, powered by
          <a
            href="https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 font-semibold text-gray-700 hover:text-black transition-colors"
          >
            Gemma 3 270M
          </a>
          !
        </p>
      </header>

      <main className="w-full max-w-4xl mx-auto space-y-6">
        <OptionCard
          title="1. Choose a Character"
          options={STORY_DATA.characters}
          selected={character}
          onSelect={(val) => dispatch({ type: "SET_FIELD", field: "character", value: val })}
          customValue={customCharacter}
          onCustomChange={(val) =>
            dispatch({
              type: "SET_FIELD",
              field: "customCharacter",
              value: val,
            })
          }
          isShuffling={isShuffling}
          isVisible={isVisible}
          playPopSound={playPopSound}
          playHoverSound={playHoverSound}
        />
        <OptionCard
          title="2. Pick a Setting"
          options={STORY_DATA.settings}
          selected={setting}
          onSelect={(val) => dispatch({ type: "SET_FIELD", field: "setting", value: val })}
          customValue={customSetting}
          onCustomChange={(val) => dispatch({ type: "SET_FIELD", field: "customSetting", value: val })}
          isShuffling={isShuffling}
          isVisible={isVisible}
          playPopSound={playPopSound}
          playHoverSound={playHoverSound}
        />
        <OptionCard
          title="3. Add a Twist"
          options={STORY_DATA.items}
          selected={item}
          onSelect={(val) => dispatch({ type: "SET_FIELD", field: "item", value: val })}
          customValue={customItem}
          onCustomChange={(val) => dispatch({ type: "SET_FIELD", field: "customItem", value: val })}
          isShuffling={isShuffling}
          isVisible={isVisible}
          playPopSound={playPopSound}
          playHoverSound={playHoverSound}
        />
        <div
          className={`bg-white border-2 border-black rounded-xl p-6 shadow-[6px_6px_0px_rgba(0,0,0,0.1)] transition-opacity duration-500 ${isShuffling ? "animate-shake" : ""} ${isVisible ? "animate-slide-in" : "opacity-0"}`}
        >
          <h3 className="text-2xl font-bold mb-4">4. Select a Theme</h3>
          <div className="flex flex-wrap gap-3">
            {STORY_DATA.themes.map((t) => (
              <button
                key={t}
                onClick={() => {
                  playPopSound();
                  dispatch({ type: "SET_FIELD", field: "theme", value: t });
                }}
                onMouseEnter={playHoverSound}
                className={`font-bold py-3 px-6 border-2 rounded-lg transition-all duration-150 text-lg transform hover:-translate-y-0.5 active:translate-y-0 ${theme === t ? "bg-pink-400 border-black shadow-[2px_2px_0px_#000]" : "bg-gray-100 border-gray-300 hover:bg-gray-200"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div
          className={`bg-white border-2 border-black rounded-xl p-6 shadow-[6px_6px_0px_rgba(0,0,0,0.1)] transition-opacity duration-500 ${isShuffling ? "animate-shake" : ""} ${isVisible ? "animate-slide-in" : "opacity-0"}`}
        >
          <h3 className="text-2xl font-bold mb-4">5. Story Length</h3>
          <div className="flex flex-wrap gap-3">
            {STORY_DATA.length.map((l) => (
              <button
                key={l}
                onClick={() => {
                  playPopSound();
                  dispatch({ type: "SET_FIELD", field: "length", value: l });
                }}
                onMouseEnter={playHoverSound}
                className={`font-bold py-3 px-6 border-2 rounded-lg transition-all duration-150 text-lg transform hover:-translate-y-0.5 active:translate-y-0 ${length === l ? "bg-pink-400 border-black shadow-[2px_2px_0px_#000]" : "bg-gray-100 border-gray-300 hover:bg-gray-200"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <NeoButton
            onClick={generateStory}
            {...{
              className: "w-full sm:w-auto text-xl",
              isLoading,
              disabled: isShuffling || isLoading,
              playHoverSound,
            }}
          >
            Make My Story
          </NeoButton>
          <NeoButton
            onClick={handleSurpriseMe}
            {...{
              variant: "accent",
              className: "w-full sm:w-auto text-xl",
              disabled: isShuffling || isLoading,
              playHoverSound,
            }}
          >
            <Dices size={24} />
            Surprise Me!
          </NeoButton>
          <NeoButton
            onClick={handleReset}
            {...{
              variant: "secondary",
              className: "w-full sm:w-auto text-xl",
              disabled: isLoading,
              playHoverSound,
            }}
          >
            <RefreshCw size={20} />
            Reset
          </NeoButton>
        </div>

        {/* Story Panel (covers screen height, no separate story page) */}
        <div
          ref={storyPanelRef}
          className="mt-8 bg-white border-2 border-black rounded-xl p-8 shadow-[8px_8px_0px_#000] overflow-y-auto animate-slide-in"
        >
          <h3 className="text-3xl font-black mb-6 text-center">Your Story</h3>
          <div
            ref={textContainerRef}
            className="text-2xl leading-relaxed font-serif whitespace-pre-wrap h-[400px] overflow-y-auto"
          >
            {(() => {
              const displayed = displayedText;
              if (!displayed) {
                return "Click “Make My Story” to generate a bedtime story.";
              }
              const pieces: React.ReactNode[] = [];
              let last = 0;
              for (let i = 0; i < ranges.length; i++) {
                const { start, end } = ranges[i];
                if (start > last) {
                  pieces.push(<span key={`n-${i}`}>{displayed.slice(last, start)}</span>);
                }
                pieces.push(
                  <span
                    key={`h-${i}`}
                    ref={(el) => {
                      chunkRefs.current[i] = el;
                    }}
                    className={i === currentChunkIdx ? "bg-yellow-200" : ""}
                  >
                    {displayed.slice(start, end)}
                  </span>,
                );
                last = end;
              }
              if (last < displayed.length) {
                pieces.push(<span key="tail">{displayed.slice(last)}</span>);
              }
              return pieces;
            })()}
          </div>
          {isLoading && (
            <div className="mt-4 text-center text-sm opacity-70">
              {isSpeaking ? "Generating and speaking..." : "Generating..."}
            </div>
          )}
          {generatedStory && !isLoading && isTTSReady && !isSpeaking && (
            <div className="mt-4 flex justify-center">
              <p className="text-sm opacity-70">Story finished.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MainApplication;
