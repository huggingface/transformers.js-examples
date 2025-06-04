import { useEffect, useState, useRef } from "react";
import { Mic, PhoneOff, ChevronDown } from "lucide-react";
import { INPUT_SAMPLE_RATE } from "./constants";

import WORKLET from "./play-worklet.js";

export default function App() {
  const [callStartTime, setCallStartTime] = useState(null);
  const [callStarted, setCallStarted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const [voice, setVoice] = useState("af_heart");
  const [voices, setVoices] = useState([]);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [listeningScale, setListeningScale] = useState(1);
  const [speakingScale, setSpeakingScale] = useState(1);
  const [ripples, setRipples] = useState([]);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const worker = useRef(null);

  const micStreamRef = useRef(null);
  const node = useRef(null);

  useEffect(() => {
    worker.current?.postMessage({
      type: "set_voice",
      voice,
    });
  }, [voice]);

  useEffect(() => {
    if (!callStarted) {
      // Reset worker state after call ends
      worker.current?.postMessage({
        type: "end_call",
      });
    }
  }, [callStarted]);

  useEffect(() => {
    if (callStarted && callStartTime) {
      const interval = setInterval(() => {
        const diff = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = String(Math.floor(diff / 60)).padStart(2, "0");
        const seconds = String(diff % 60).padStart(2, "0");
        setElapsedTime(`${minutes}:${seconds}`);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedTime("00:00");
    }
  }, [callStarted, callStartTime]);

  useEffect(() => {
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    const onMessage = ({ data }) => {
      console.log("Worker message:", data);
      if (data.error) {
        return onError(data.error);
      }

      switch (data.type) {
        case "status":
          if (data.status === "recording_start") {
            setIsListening(true);
            setIsSpeaking(false);
          } else if (data.status === "recording_end") {
            setIsListening(false);
          } else if (data.status === "ready") {
            setVoices(data.voices);
            setReady(true);
          }
          break;
        case "output":
          if (!playing) {
            node.current?.port.postMessage(data.result.audio);
            setPlaying(true);
            setIsSpeaking(true);
            setIsListening(false);
          }
          break;
      }
    };
    const onError = (err) => setError(err.message);

    worker.current.addEventListener("message", onMessage);
    worker.current.addEventListener("error", onError);

    return () => {
      worker.current.removeEventListener("message", onMessage);
      worker.current.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    if (!callStarted) return;

    let worklet;
    let inputAudioContext;
    let source;
    let ignore = false;

    let outputAudioContext;
    const audioStreamPromise = Promise.resolve(micStreamRef.current);

    audioStreamPromise
      .then(async (stream) => {
        if (ignore) return;

        inputAudioContext = new (window.AudioContext ||
          window.webkitAudioContext)({
          sampleRate: INPUT_SAMPLE_RATE,
        });

        const analyser = inputAudioContext.createAnalyser();
        analyser.fftSize = 256;
        source = inputAudioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const inputDataArray = new Uint8Array(analyser.frequencyBinCount);

        function calculateRMS(array) {
          let sum = 0;
          for (let i = 0; i < array.length; ++i) {
            const normalized = array[i] / 128 - 1;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / array.length);
          return rms;
        }

        await inputAudioContext.audioWorklet.addModule(
          new URL("./vad-processor.js", import.meta.url),
        );
        worklet = new AudioWorkletNode(inputAudioContext, "vad-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
        });

        source.connect(worklet);
        worklet.port.onmessage = (event) => {
          const { buffer } = event.data;
          worker.current?.postMessage({ type: "audio", buffer });
        };

        outputAudioContext = new AudioContext({
          sampleRate: 24000,
        });
        outputAudioContext.resume();

        const blob = new Blob([`(${WORKLET.toString()})()`], {
          type: "application/javascript",
        });
        const url = URL.createObjectURL(blob);
        await outputAudioContext.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        node.current = new AudioWorkletNode(
          outputAudioContext,
          "buffered-audio-worklet-processor",
        );

        node.current.port.onmessage = (event) => {
          if (event.data.type === "playback_ended") {
            setPlaying(false);
            setIsSpeaking(false);
            worker.current?.postMessage({ type: "playback_ended" });
          }
        };

        const outputAnalyser = outputAudioContext.createAnalyser();
        outputAnalyser.fftSize = 256;

        node.current.connect(outputAnalyser);
        outputAnalyser.connect(outputAudioContext.destination);

        const outputDataArray = new Uint8Array(
          outputAnalyser.frequencyBinCount,
        );

        function updateVisualizers() {
          analyser.getByteTimeDomainData(inputDataArray);
          const rms = calculateRMS(inputDataArray);
          const targetScale = 1 + Math.min(1.25 * rms, 0.25);
          setListeningScale((prev) => prev + (targetScale - prev) * 0.25);

          outputAnalyser.getByteTimeDomainData(outputDataArray);
          const outputRMS = calculateRMS(outputDataArray);
          const targetOutputScale = 1 + Math.min(1.25 * outputRMS, 0.25);
          setSpeakingScale((prev) => prev + (targetOutputScale - prev) * 0.25);

          requestAnimationFrame(updateVisualizers);
        }
        updateVisualizers();
      })
      .catch((err) => {
        setError(err.message);
        console.error(err);
      });

    return () => {
      ignore = true;
      audioStreamPromise.then((s) => s.getTracks().forEach((t) => t.stop()));
      source?.disconnect();
      worklet?.disconnect();
      inputAudioContext?.close();

      outputAudioContext?.close();
    };
  }, [callStarted]);

  useEffect(() => {
    if (!callStarted) return;
    const interval = setInterval(() => {
      const id = Date.now();
      setRipples((prev) => [...prev, id]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r !== id));
      }, 1500);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStarted]);

  const handleStartCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
          sampleRate: INPUT_SAMPLE_RATE,
        },
      });
      micStreamRef.current = stream;

      setCallStartTime(Date.now());
      setCallStarted(true);
      worker.current?.postMessage({ type: "start_call" });
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  };

  return (
    <div className="h-screen min-h-[240px] flex items-center justify-center bg-gray-50 p-4 relative">
      <div className="h-full max-h-[320px] w-[640px] bg-white rounded-xl shadow-lg p-8 flex items-center justify-between space-x-16">
        <div className="text-green-700 w-[140px]">
          <div className="text-xl font-bold flex justify-between">
            {voices?.[voice]?.name}
            <span className="font-normal text-gray-500">{elapsedTime}</span>
          </div>
          <div className="text-base relative">
            <button
              type="button"
              disabled={!ready}
              className={`w-full flex items-center justify-between border border-gray-300 rounded-md transition-colors ${
                ready
                  ? "bg-transparent hover:border-gray-400"
                  : "bg-gray-100 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="px-2 py-1">Select voice</span>
              <ChevronDown className="absolute right-2" />
            </button>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={!ready}
            >
              {Object.entries(voices).map(([key, v]) => (
                <option key={key} value={key}>
                  {`${v.name} (${
                    v.language === "en-us" ? "American" : v.language
                  } ${v.gender})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative flex items-center justify-center w-32 h-32 flex-shrink-0 aspect-square">
          {callStarted &&
            ripples.map((id) => (
              <div
                key={id}
                className="absolute inset-0 rounded-full border-2 border-green-200 pointer-events-none"
                style={{ animation: "ripple 1.5s ease-out forwards" }}
              />
            ))}
          {/* Pulsing loader while initializing */}
          <div
            className={`absolute w-32 h-32 rounded-full ${
              error ? "bg-red-200" : "bg-green-200"
            } ${!ready ? "animate-ping opacity-75" : ""}`}
            style={{ animationDuration: "1.5s" }}
          />
          {/* Main rings */}
          <div
            className={`absolute w-32 h-32 rounded-full shadow-inner transition-transform duration-300 ease-out ${
              error ? "bg-red-300" : "bg-green-300"
            } ${!ready ? "opacity-0" : ""}`}
            style={{ transform: `scale(${speakingScale})` }}
          />
          <div
            className={`absolute w-32 h-32 rounded-full shadow-inner transition-transform duration-300 ease-out ${
              error ? "bg-red-200" : "bg-green-200"
            } ${!ready ? "opacity-0" : ""}`}
            style={{ transform: `scale(${listeningScale})` }}
          />
          {/* Center text: show error if present, else existing statuses */}
          <div
            className={`absolute z-10 text-lg text-center ${
              error ? "text-red-700" : "text-gray-700"
            }`}
          >
            {error ? (
              error
            ) : (
              <>
                {!ready && "Loading..."}
                {isListening && "Listening..."}
                {isSpeaking && "Speaking..."}
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 w-[140px]">
          {callStarted ? (
            <button
              className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              onClick={() => {
                setCallStarted(false);
                setCallStartTime(null);
                setPlaying(false);
                setIsListening(false);
                setIsSpeaking(false);
              }}
            >
              <PhoneOff className="w-5 h-5" />
              <span>End call</span>
            </button>
          ) : (
            <button
              className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                ready
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-blue-100 text-blue-700 opacity-50 cursor-not-allowed"
              }`}
              onClick={handleStartCall}
              disabled={!ready}
            >
              <span>Start call</span>
            </button>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 text-sm">
        Built with{" "}
        <a
          href="https://github.com/huggingface/transformers.js"
          rel="noopener noreferrer"
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          🤗 Transformers.js
        </a>
      </div>
    </div>
  );
}
