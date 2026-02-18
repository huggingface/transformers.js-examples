import { useState } from "react";
import type React from "react";
import { Pencil } from "lucide-react";

interface OptionCardProps {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  isShuffling: boolean;
  isVisible: boolean;
  playPopSound: () => void;
  playHoverSound: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
  title,
  options,
  selected,
  onSelect,
  customValue,
  onCustomChange,
  isShuffling,
  isVisible,
  playPopSound,
  playHoverSound,
}) => {
  const [isCustom, setIsCustom] = useState(false);

  const handleSelect = (option: string) => {
    playPopSound();
    setIsCustom(false);
    onSelect(option);
    onCustomChange("");
  };
  const handleCustomClick = () => {
    playPopSound();
    setIsCustom(true);
    onSelect("");
  };

  const shuffleClass = isShuffling ? "animate-shake" : "";
  const visibilityClass = isVisible ? "animate-slide-in opacity-100" : "opacity-0 pointer-events-none";

  return (
    <div
      className={`bg-white border-2 border-black rounded-xl p-6 shadow-[6px_6px_0px_rgba(0,0,0,0.1)] transition-opacity duration-500 ${shuffleClass} ${visibilityClass}`}
    >
      <h3 className="text-2xl font-bold mb-4">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            onMouseEnter={playHoverSound}
            className={`font-semibold py-2 px-4 border-2 rounded-md transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 ${selected === option && !isCustom ? "bg-black text-white border-black" : "bg-gray-100 hover:bg-gray-200 border-gray-300"}`}
          >
            {option}
          </button>
        ))}
        <button
          onClick={handleCustomClick}
          onMouseEnter={playHoverSound}
          className={`font-semibold py-2 px-4 border-2 rounded-md transition-all duration-150 flex items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 ${isCustom ? "bg-black text-white border-black" : "bg-gray-100 hover:bg-gray-200 border-gray-300"}`}
        >
          <Pencil size={16} />
          Write your own
        </button>
      </div>
      {isCustom && (
        <input
          type="text"
          value={customValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onCustomChange(e.target.value);
            onSelect("");
          }}
          placeholder="Enter your own option..."
          className="mt-4 w-full p-3 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      )}
    </div>
  );
};

export default OptionCard;
