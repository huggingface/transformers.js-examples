import { useState, useRef, useCallback } from "react";

type AudioKeys = "pop" | "hover" | "music";
interface AudioPlayer {
  initAudio: () => boolean;
  playPopSound: () => void;
  playHoverSound: () => void;
  toggleMusic: () => void;
  playMusic: () => void;
  isMusicPlaying: boolean;
  isAudioReady: boolean;
}

const useAudioPlayer = (): AudioPlayer => {
  const audioRefs = useRef<Record<AudioKeys, HTMLAudioElement | null>>({
    pop: null,
    hover: null,
    music: null,
  });
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState<boolean>(false);

  const initAudio = useCallback(() => {
    if (isReady) return true;
    try {
      audioRefs.current.pop = new Audio("/bubble.mp3");
      audioRefs.current.hover = new Audio("/hover.mp3");
      audioRefs.current.music = new Audio("/music.mp3");
      audioRefs.current.music.loop = true;
      audioRefs.current.music.volume = 0.1;
      setIsReady(true);
      return true;
    } catch {
      return false;
    }
  }, [isReady]);

  const playMusic = useCallback(() => {
    if (isReady && !isMusicPlaying) {
      audioRefs.current.music?.play().catch(() => {});
      setIsMusicPlaying(true);
    }
  }, [isReady, isMusicPlaying]);

  const toggleMusic = useCallback(
    (force?: boolean) => {
      if (!isReady || !audioRefs.current.music) return;

      const shouldBePlaying = force === undefined ? !isMusicPlaying : force;

      if (shouldBePlaying === isMusicPlaying) return;

      if (shouldBePlaying) {
        audioRefs.current.music?.play().catch(() => {});
      } else {
        audioRefs.current.music?.pause();
      }
      setIsMusicPlaying(shouldBePlaying);
    },
    [isReady, isMusicPlaying],
  );

  const playPopSound = useCallback(() => {
    if (!isReady || !audioRefs.current.pop) return;
    audioRefs.current.pop.currentTime = 0;
    audioRefs.current.pop.play().catch(() => {});
  }, [isReady]);

  const playHoverSound = useCallback(() => {
    if (!isReady || !audioRefs.current.hover) return;
    audioRefs.current.hover.currentTime = 0;
    audioRefs.current.hover.play().catch(() => {});
  }, [isReady]);

  return {
    initAudio,
    playPopSound,
    playHoverSound,
    toggleMusic,
    playMusic,
    isMusicPlaying,
    isAudioReady: isReady,
  };
};

export default useAudioPlayer;
