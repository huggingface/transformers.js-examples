import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, extend, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import {
  IcosahedronGeometry,
  ShaderMaterial,
  Clock,
  Vector2,
  Mesh,
} from "three";
import { OrbitControls } from "@react-three/drei";

const MIN_WAVE_SIZE = 15;
const AUDIO_SCALE = 0.5;
const MAX_WAVE_SIZE = 75;

extend({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass });

const BloomScene = ({ params }) => {
  const composer = useRef();
  const bloomPass = useRef();
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    if (composer.current) {
      composer.current.setSize(size.width, size.height);
    }
    if (bloomPass.current) {
      bloomPass.current.threshold = params.threshold;
      bloomPass.current.strength = params.strength;
      bloomPass.current.radius = params.radius;
    }
  }, [size, params]);

  useEffect(() => {
    composer.current = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    bloomPass.current = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      params.strength,
      params.radius,
      params.threshold,
    );
    const outputPass = new OutputPass();

    composer.current.addPass(renderPass);
    composer.current.addPass(bloomPass.current);
    composer.current.addPass(outputPass);
  }, [gl, scene, camera, size, params]);

  useFrame(() => {
    composer.current.render();
  }, 1);

  return null;
};

const clock = new Clock();

const AnimatedMesh = ({ frequency, colors }) => {
  const meshRef = useRef();

  const uniforms = useRef({
    u_time: { value: 0.0 },
    u_frequency: { value: 0.0 },
    u_red: { value: colors.red },
    u_green: { value: colors.green },
    u_blue: { value: colors.blue },
  });

  const scale = Math.min(frequency, MAX_WAVE_SIZE) / MAX_WAVE_SIZE;

  useFrame(() => {
    const time = clock.getElapsedTime();
    uniforms.current.u_time.value = time;
    uniforms.current.u_frequency.value = Math.min(
      MIN_WAVE_SIZE + AUDIO_SCALE * frequency,
      MAX_WAVE_SIZE,
    );
    uniforms.current.u_red.value = colors.red;
    uniforms.current.u_green.value = colors.green * (1 - scale);
    uniforms.current.u_blue.value = colors.blue * scale;
  });

  const geometry = useRef(new IcosahedronGeometry(3, 25)).current;
  const material = useRef(
    new ShaderMaterial({
      uniforms: uniforms.current,
      vertexShader: document.getElementById("vertexshader").textContent,
      fragmentShader: document.getElementById("fragmentshader").textContent,
      wireframe: true,
    }),
  ).current;

  return <primitive object={new Mesh(geometry, material)} ref={meshRef} />;
};

const App = (props) => {
  const [frequency, setFrequency] = useState(0);

  useEffect(() => {
    const audioStream = navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream
      .then((stream) => {
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;
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
      })
      .catch((err) => {
        console.error("Error accessing microphone:", err);
      });

    return () => {
      audioStream.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
    };
  }, []);

  const [params, setParams] = useState({
    threshold: 0,
    strength: 0.2,
    radius: 1,
  });
  const [colors, setColors] = useState({
    red: 1.0,
    green: 1.0,
    blue: 1.0,
  });

  return (
    <div {...props}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          padding: "10px",
          color: "#fff",
          zIndex: 10,
        }}
      >
        <div>
          <label>Threshold: </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.threshold}
            onChange={(e) =>
              setParams({ ...params, threshold: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <label>Strength: </label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.01"
            value={params.strength}
            onChange={(e) =>
              setParams({ ...params, strength: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <label>Radius: </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.radius}
            onChange={(e) =>
              setParams({ ...params, radius: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <label>Red: </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={colors.red}
            onChange={(e) =>
              setColors({ ...colors, red: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <label>Green: </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={colors.green}
            onChange={(e) =>
              setColors({ ...colors, green: parseFloat(e.target.value) })
            }
          />
        </div>
        <div>
          <label>Blue: </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={colors.blue}
            onChange={(e) =>
              setColors({ ...colors, blue: parseFloat(e.target.value) })
            }
          />
        </div>
      </div>
      <Canvas camera={{ position: [0, 0, 6] }}>
        <OrbitControls />
        <ambientLight intensity={0.5} />
        <BloomScene params={params} />
        <AnimatedMesh frequency={frequency} colors={colors} />
      </Canvas>
    </div>
  );
};

export default App;
