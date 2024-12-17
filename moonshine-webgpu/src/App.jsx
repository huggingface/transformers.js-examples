import { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { motion } from "motion/react";

import BloomScene from "./components/BloomScene";
import AnimatedMesh from "./components/AnimatedMesh";

import { SAMPLE_RATE } from "./constants";

function App() {
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [frequency, setFrequency] = useState(0);
  const worker = useRef(null);

  useEffect(() => {
    // Initialize worker on mount
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    // NOTE: Certain browsers handle error messages differently, so to ensure
    // compatibility, we need to handle errors in both `message` and `error` events.
    const onMessage = ({ data }) => {
      if (data.error) {
        return onError(data.error);
      }

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            text: data.message,
          },
        ]);
      } else if (data.output) {
        setMessages((prev) => [...prev, data.output]);
      }
    };
    const onError = (error) => setError(error.message);

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessage);
    worker.current.addEventListener("error", onError);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current.removeEventListener("message", onMessage);
      worker.current.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    // https://react.dev/learn/synchronizing-with-effects#fetching-data
    let ignore = false; // Flag to track if the effect is active
    const audioStream = navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
        sampleRate: SAMPLE_RATE,
      },
    });

    let worklet;
    let audioContext;
    let source;
    audioStream
      .then(async (stream) => {
        if (ignore) return; // Exit if the effect has been cleaned up

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: SAMPLE_RATE,
          latencyHint: "interactive",
        });

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;

        // NOTE: In Firefox, the following line may throw an error:
        // "AudioContext.createMediaStreamSource: Connecting AudioNodes from AudioContexts with different sample-rate is currently not supported."
        // See the following bug reports for more information:
        //  - https://bugzilla.mozilla.org/show_bug.cgi?id=1674892
        //  - https://bugzilla.mozilla.org/show_bug.cgi?id=1674892
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const getAverageFrequency = () => {
          analyser.getByteFrequencyData(dataArray);
          return (
            dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
          );
        };

        const updateFrequency = () => {
          const frequency = getAverageFrequency();
          setFrequency(frequency);
          requestAnimationFrame(updateFrequency);
        };
        updateFrequency();

        await audioContext.audioWorklet.addModule(
          new URL("./processor.js", import.meta.url),
        );

        worklet = new AudioWorkletNode(audioContext, "vad-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
        });

        source.connect(worklet);

        worklet.port.onmessage = (event) => {
          const { buffer } = event.data;

          // Dispatch buffer for voice activity detection
          worker.current?.postMessage({ buffer });
        };
      })
      .catch((err) => {
        setError(err.message);
        console.error(err);
      });

    return () => {
      ignore = true; // Mark the effect as cleaned up
      audioStream.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      source?.disconnect();
      worklet?.disconnect();
      audioContext?.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-screen supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh] bg-gray-900">
      {error ? (
        <div className="text-center p-2">
          <div className="text-white text-4xl mb-1 font-semibold">
            An error has occurred
          </div>
          <div className="text-red-300 text-xl">{error}</div>
        </div>
      ) : (
        <>
          <div className="bottom-0 text-5xl absolute text-center w-full z-10 text-white overflow-hidden pb-8">
            {messages.map((output, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-1"
              >
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{
                    opacity: 0,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                  transition={{
                    delay: 1 + output.text.length / 20,
                    duration: 1,
                  }}
                >
                  {output.text}
                </motion.div>
              </motion.div>
            ))}
          </div>
          <Canvas camera={{ position: [0, 0, 8] }}>
            <ambientLight intensity={0.5} />
            <BloomScene frequency={frequency} />
            <AnimatedMesh frequency={frequency} />
          </Canvas>
        </>
      )}
    </div>
  );
}

export default App;
