import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { IcosahedronGeometry, ShaderMaterial, Clock, Mesh } from "three";

const MIN_WAVE_SIZE = 10;
const AUDIO_SCALE = 0.5;
const MAX_WAVE_SIZE = 100;

const clock = new Clock();

function AnimatedMesh({ frequency }) {
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
}

export default AnimatedMesh;
