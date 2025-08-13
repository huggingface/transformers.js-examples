import type React from "react";
import { AlertTriangle } from "lucide-react";
import NeoButton from "./NeoButton";

interface ErrorScreenProps {
  isVisible: boolean;
  error: string | null;
  onRetry: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ isVisible, error, onRetry }) => {
  const transitionClass = isVisible ? "opacity-100" : "opacity-0 -translate-y-10 pointer-events-none";
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${transitionClass}`}
    >
      <div className="text-center p-4 max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 animate-sway text-red-500">
          <AlertTriangle className="inline-block h-16 w-16 md:h-24 md:w-24 mb-4" />
          <br />
          An Error Occurred
        </h1>
        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-8 text-left">
            <strong className="font-bold">Details:</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}
        <NeoButton onClick={onRetry} className="text-2xl px-8 py-4" variant="secondary">
          Try Again
        </NeoButton>
      </div>
    </div>
  );
};

export default ErrorScreen;
