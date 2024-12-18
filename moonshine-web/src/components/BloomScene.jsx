import { useRef, useEffect } from "react";
import { useFrame, extend, useThree } from "@react-three/fiber";
import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

extend({ EffectComposer, RenderPass, UnrealBloomPass, OutputPass });

function BloomScene({ frequency }) {
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
      0.2,
      1,
      0,
    );

    composer.current.addPass(renderPass.current);
    composer.current.addPass(bloomPass.current);
    composer.current.addPass(outputPass.current);

    return () => {
      composer.current.removePass(renderPass.current);
      composer.current.removePass(bloomPass.current);
      composer.current.removePass(outputPass.current);
      renderPass.current.dispose();
      outputPass.current.dispose();
      bloomPass.current.dispose();
    };
  }, [gl, scene, camera, size]);

  useEffect(() => {
    composer.current.setSize(size.width, size.height);
  }, [size]);

  useEffect(() => {
    bloomPass.current.strength = 0.2 + frequency / 1000;
  }, [frequency]);

  useFrame(() => {
    composer.current.render();
  }, 1);

  return null;
}

export default BloomScene;
