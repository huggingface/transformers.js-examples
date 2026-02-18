import { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { useLLM } from "./hooks/useLLM";
import { useTTS } from "./hooks/useTTS";
import useAudioPlayer from "./hooks/useAudioPlayer";

import LandingScreen from "./components/LandingScreen";
import ProgressScreen from "./components/ProgressScreen";
import ErrorScreen from "./components/ErrorScreen";

import WORKLET from "./play-worklet.js?raw";
import MainApplication from "./components/MainApplication";

export default function App() {
  const llm = useLLM();
  const tts = useTTS();

  const { initAudio, playPopSound, playHoverSound, toggleMusic, playMusic, isMusicPlaying, isAudioReady } =
    useAudioPlayer();
  const [appState, setAppState] = useState<"landing" | "loading" | "main" | "error">(
    navigator.gpu ? "landing" : "error",
  );
  const [error, setError] = useState<string | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const audioGlobal = (globalThis as any).__AUDIO__ || {
    ctx: null as AudioContext | null,
    node: null as AudioWorkletNode | null,
    loaded: false as boolean,
  };
  (globalThis as any).__AUDIO__ = audioGlobal;

  const allowAutoplayRef = useRef(true);
  const handleToggleMusic = useCallback(() => {
    if (isMusicPlaying) allowAutoplayRef.current = false;
    toggleMusic();
  }, [isMusicPlaying, toggleMusic]);

  const handleLoadApp = async () => {
    setAppState("loading");
    initAudio();

    if (audioGlobal.ctx && audioGlobal.node) {
      audioContextRef.current = audioGlobal.ctx;
      audioWorkletNodeRef.current = audioGlobal.node;
      await audioContextRef.current?.resume();
    } else {
      try {
        const audioContext = new AudioContext({ sampleRate: 24000 });
        audioContextRef.current = audioContext;
        await audioContext.resume();

        if (!audioGlobal.loaded) {
          const blob = new Blob([WORKLET], { type: "application/javascript" });
          const url = URL.createObjectURL(blob);
          await audioContext.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);
          audioGlobal.loaded = true;
        }

        const workletNode = new AudioWorkletNode(audioContext, "buffered-audio-worklet-processor");
        workletNode.connect(audioContext.destination);

        audioWorkletNodeRef.current = workletNode;
        audioGlobal.ctx = audioContext;
        audioGlobal.node = workletNode;
      } catch {}
    }

    await audioContextRef.current?.resume();
    llm.load();
    tts.load();
  };

  const handleLoadingComplete = useCallback(() => {
    setAppState("main");
    if (allowAutoplayRef.current && !isMusicPlaying) playMusic();
  }, [playMusic, isMusicPlaying]);

  const handleRetry = () => {
    setError(null);
    handleLoadApp();
  };

  useEffect(() => {
    if (llm.error) {
      setError(`LLM Error: ${llm.error}`);
      setAppState("error");
    } else if (tts.error) {
      setError(`TTS Error: ${tts.error}`);
      setAppState("error");
    } else if (llm.isReady && tts.isReady) {
      handleLoadingComplete();
    }
  }, [llm.isReady, tts.isReady, llm.error, tts.error, handleLoadingComplete]);

  useEffect(() => {
    if (!navigator.gpu) {
      setError("WebGPU is not supported in this browser.");
      setAppState("error");
      return;
    }
    return () => {
      audioWorkletNodeRef.current?.disconnect();
    };
  }, []);

  return (
    <>
      <div className="bg-pattern h-screen text-black relative overflow-hidden">
        {isAudioReady && (
          <button
            onClick={handleToggleMusic}
            className="absolute top-4 right-4 z-20 p-2 bg-white/50 border-2 border-black rounded-full shadow-[2px_2px_0px_#000] hover:bg-white/80 transition-colors"
          >
            {isMusicPlaying ? <Volume2 /> : <VolumeX />}
          </button>
        )}
        <LandingScreen isVisible={appState === "landing"} onLoad={handleLoadApp} playHoverSound={playHoverSound} />
        <ProgressScreen isVisible={appState === "loading"} progress={(llm.progress + tts.progress) / 2} />
        <ErrorScreen isVisible={appState === "error"} error={error} onRetry={handleRetry} />
        <MainApplication
          isVisible={appState === "main"}
          playPopSound={playPopSound}
          playHoverSound={playHoverSound}
          generate={llm.generate}
          streamTTS={tts.stream}
          isTTSReady={tts.isReady}
          audioWorkletNode={audioWorkletNodeRef.current}
          toggleMusic={handleToggleMusic}
          isMusicPlaying={isMusicPlaying}
        />
      </div>
    </>
  );
}
