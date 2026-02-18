import { useEffect, useRef } from "react";

const BackgroundMusic = () => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      // Browsers may prevent autoplay until user interaction.
      // We'll attempt to play, and if it fails, wait for a user gesture.
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          const playOnClick = () => {
            audio
              .play()
              .catch((e) => console.error("Could not play audio on click.", e));
            document.removeEventListener("click", playOnClick);
          };
          document.addEventListener("click", playOnClick);
        });
      }
    }
  }, []);

  return <audio ref={audioRef} src="/music.mp3" loop />;
};

export default BackgroundMusic;
