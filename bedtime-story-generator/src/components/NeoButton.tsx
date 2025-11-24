import type React from "react";
import { Loader } from "lucide-react";

interface NeoButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  playPopSound?: () => void;
  playHoverSound?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "accent";
  isLoading?: boolean;
  disabled?: boolean;
}

const NeoButtonComponent: React.FC<NeoButtonProps> = ({
  children,
  onClick,
  playHoverSound,
  className = "",
  variant = "primary",
  isLoading = false,
  disabled = false,
}) => {
  const colorClasses = {
    primary: "bg-yellow-300 hover:bg-yellow-400 border-black",
    secondary: "bg-pink-400 hover:bg-pink-500 border-black",
    accent: "bg-cyan-400 hover:bg-cyan-500 border-black",
  };
  const primaryShine = variant === "primary" ? "animate-shine" : "";

  return (
    <button
      onClick={onClick}
      onMouseEnter={playHoverSound}
      disabled={isLoading || disabled}
      className={`relative font-bold py-3 px-6 border-2 rounded-lg shadow-[4px_4px_0px_#000] transition-all duration-150 transform hover:-translate-y-1 active:shadow-[1px_1px_0px_#000] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[4px_4px_0px_#000] overflow-hidden ${colorClasses[variant]} ${className}`}
    >
      <span className={`absolute top-0 left-0 w-full h-full ${primaryShine}`} />
      <span className="relative z-10 flex items-center justify-center gap-3">
        {isLoading && <Loader className="animate-spin" />}
        {children}
      </span>
    </button>
  );
};

export default NeoButtonComponent;
