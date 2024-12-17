import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import {
  IcosahedronGeometry,
  ShaderMaterial,
  Clock,
  Vector2,
  Mesh,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { motion } from "motion/react";

const SAMPLE_RATE = 16_000;
const MIN_WAVE_SIZE = 10;
const AUDIO_SCALE = 0.5;
const MAX_WAVE_SIZE = 100;

extend({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass });

const BloomScene = ({ params }) => {
  const { gl, scene, camera, size } = useThree();

  const renderPass = useRef();
  const outputPass = useRef();
  const composer = useRef();
  const bloomPass = useRef();

  useEffect(() => {
    // Runs on resize, etc.
    renderPass.current = new RenderPass(scene, camera);
    outputPass.current = new OutputPass();
    composer.current = new EffectComposer(gl);
    bloomPass.current = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      params.strength,
      params.radius,
      params.threshold,
    );

    composer.current.addPass(renderPass.current);
    composer.current.addPass(bloomPass.current);
    composer.current.addPass(outputPass.current);

    return () => {
      composer.current.removePass(renderPass.current);
      composer.current.removePass(bloomPass.current);
      composer.current.removePass(outputPass.current);
    };
  }, [gl, scene, camera, size]);

  useEffect(() => {
    composer.current.setSize(size.width, size.height);
  }, [size]);

  useEffect(() => {
    bloomPass.current.threshold = params.threshold;
    bloomPass.current.strength = params.strength;
    bloomPass.current.radius = params.radius;
  }, [params]);

  useFrame(() => {
    composer.current.render();
  }, 1);

  return null;
};

const clock = new Clock();

const AnimatedMesh = ({ frequency }) => {
  const colors = {
    red: 1.0,
    green: 1.0,
    blue: 0,
  };
  const meshRef = useRef();
  const geometry = useMemo(() => new IcosahedronGeometry(3, 20), []);
  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_frequency: { value: 0.0 },
        u_red: { value: 0.0 },
        u_green: { value: 0.0 },
        u_blue: { value: 0.0 },
      },
      vertexShader: document.getElementById("vertexshader").textContent,
      fragmentShader: document.getElementById("fragmentshader").textContent,
      wireframe: true,
    });
  }, []);

  const uniforms = material.uniforms;

  useFrame(() => {
    const time = clock.getElapsedTime();
    const scale = Math.min(frequency, MAX_WAVE_SIZE) / MAX_WAVE_SIZE;

    uniforms.u_time.value = time;
    uniforms.u_frequency.value = Math.min(
      MIN_WAVE_SIZE + AUDIO_SCALE * frequency,
      MAX_WAVE_SIZE,
    );
    uniforms.u_red.value = colors.red * (1 - scale);
    uniforms.u_green.value = colors.green;
    uniforms.u_blue.value = colors.blue * (1 - scale);
  });

  return <primitive object={new Mesh(geometry, material)} ref={meshRef} />;
};

const Scene = (props) => {
  const [error, setError] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [frequency, setFrequency] = useState(0);
  const worker = useRef(null);
  const params = {
    threshold: 0,
    strength: 0.2 + frequency / 1000,
    radius: 1,
  };

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
        setOutputs((prev) => [
          ...prev,
          {
            text: data.message,
          },
        ]);
      } else if (data.output) {
        setOutputs((prev) => [...prev, data.output]);
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
    <div {...props}>
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
            {outputs.map((output, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ duration: 0.2 }}
                className="mb-1"
              >
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
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
            <BloomScene params={params} />
            <AnimatedMesh frequency={frequency} />
          </Canvas>
        </>
      )}
    </div>
  );
};

export default Scene;
