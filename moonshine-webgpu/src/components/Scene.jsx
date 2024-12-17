import React, { useRef, useEffect, useState } from "react";
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

import { motion } from "motion/react"

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

const AnimatedMesh = ({ frequency, colors }) => {
  const meshRef = useRef();
  const geometry = useRef();
  const material = useRef();
  const uniforms = useRef();

  useEffect(() => {
    uniforms.current = {
      u_time: { value: 0.0 },
      u_frequency: { value: 0.0 },
      u_red: { value: colors.red },
      u_green: { value: colors.green },
      u_blue: { value: colors.blue },
    };
    geometry.current = new IcosahedronGeometry(3, 20)
    material.current =
      new ShaderMaterial({
        uniforms: uniforms.current,
        vertexShader: document.getElementById("vertexshader").textContent,
        fragmentShader: document.getElementById("fragmentshader").textContent,
        wireframe: true,
      });

  }, []);

  const scale = Math.min(frequency, MAX_WAVE_SIZE) / MAX_WAVE_SIZE;

  useFrame(() => {
    const time = clock.getElapsedTime();
    uniforms.current.u_time.value = time;
    uniforms.current.u_frequency.value = Math.min(
      MIN_WAVE_SIZE + AUDIO_SCALE * frequency,
      MAX_WAVE_SIZE,
    );
    uniforms.current.u_red.value = colors.red * (1 - scale);
    uniforms.current.u_green.value = colors.green;
    uniforms.current.u_blue.value = colors.blue * (1 - scale);
  });

  return <primitive object={new Mesh(geometry.current, material.current)} ref={meshRef} />;
};

const Scene = (props) => {
  const [outputs, setOutputs] = useState([]);
  const [frequency, setFrequency] = useState(0);
  const worker = useRef(null);
  const params = {
    threshold: 0,
    strength: 0.2 + frequency / 1000,
    radius: 1,
  };
  const colors = {
    red: 1.0,
    green: 1.0,
    blue: 0,
  };

  useEffect(() => {
    // Allocate memory for audio buffer and initialize worker on mount
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    const onMessageReceived = ({data}) => {
      const { buffer, output } = data;
      setOutputs((prev) => [...prev, output]);

      // Useful for debugging: play the audio buffer
      // const audioContext = new (window.AudioContext || window.webkitAudioContext)({
      //   sampleRate: SAMPLE_RATE,
      //   latencyHint: "interactive",
      // });
      // const source = audioContext.createBufferSource();
      // const audioBuffer = audioContext.createBuffer(1, buffer.length, SAMPLE_RATE);
      // audioBuffer.getChannelData(0).set(buffer);
      // source.buffer = audioBuffer;
      // source.connect(audioContext.destination);
      // source.start();
    }

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current.removeEventListener("message", onMessageReceived);
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

        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const getAverageFrequency = () => {
          analyser.getByteFrequencyData(dataArray);
          return dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        };

        const updateFrequency = () => {
          const frequency = getAverageFrequency();
          setFrequency(frequency);
          requestAnimationFrame(updateFrequency);
        };
        updateFrequency();

        await audioContext.audioWorklet.addModule(
          new URL("./processor.js", import.meta.url)
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
        console.error(err);
      });

    return () => {
      ignore = true; // Mark the effect as cleaned up
      audioStream.then((stream) => stream.getTracks().forEach((track) => track.stop()));
      source?.disconnect();
      worklet?.disconnect();
      audioContext?.close();
    };
  }, []);
  
  return (
    <div {...props}>
      <div
        className="bottom-0 text-5xl absolute text-center w-full z-10 text-white overflow-hidden pb-8"
      >
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
              transition={{ delay: 1 + output.text.length / 20, duration: 1 }}
            >
              {output.text}
            </motion.div>
          </motion.div>
        ))}
      </div>
      <Canvas camera={{ position: [0, 0, 8] }}>
        <ambientLight intensity={0.5} />
        <BloomScene params={params} />
        <AnimatedMesh frequency={frequency} colors={colors} />
      </Canvas>
    </div>
  );
};

export default Scene;
