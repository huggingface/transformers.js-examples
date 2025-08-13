import type React from "react";

interface ProgressScreenProps {
  progress: number;
  isVisible: boolean;
}

const ProgressScreen: React.FC<ProgressScreenProps> = ({ progress, isVisible }) => {
  const transitionClass = isVisible ? "opacity-100" : "opacity-0 pointer-events-none";
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${transitionClass}`}
    >
      <div className="w-full max-w-md text-center">
        <h2 className="text-3xl font-bold mb-4">Warming up the magic...</h2>
        <div className="w-full bg-white border-2 border-black rounded-full p-1 shadow-[4px_4px_0px_#000]">
          <div className="bg-pink-400 h-6 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-lg font-semibold">{progress.toFixed(2)}%</p>
      </div>
    </div>
  );
};

export default ProgressScreen;
