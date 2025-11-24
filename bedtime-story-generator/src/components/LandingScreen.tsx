import type React from "react";
import { Sparkles } from "lucide-react";
import NeoButton from "./NeoButton";

interface LandingScreenProps {
  isVisible: boolean;
  onLoad: () => void;
  playHoverSound?: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ isVisible, onLoad, playHoverSound }) => {
  const transitionClass = isVisible ? "opacity-100" : "opacity-0 -translate-y-10 pointer-events-none";
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${transitionClass}`}
    >
      <div className="text-center p-4">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 animate-sway">
          ✨ Bedtime Story ✨<br />
          Generator
        </h1>
        <p className="text-2xl md:text-3xl mb-10">Craft magical tales in seconds.</p>
        <NeoButton
          onClick={onLoad}
          className="text-2xl px-8 py-4 mb-4 animate-pulse-grow"
          playHoverSound={playHoverSound}
        >
          <Sparkles className="mr-1" /> Start Creating
        </NeoButton>
      </div>

      <footer className="absolute bottom-5 left-0 right-0">
        <div className="flex items-center justify-center text-gray-500 text-sm">
          <span>Built with </span>
          <a
            href="https://github.com/huggingface/transformers.js"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 font-semibold text-gray-600 hover:text-black transition-colors flex items-center"
          >
            🤗 Transformers.js
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingScreen;
