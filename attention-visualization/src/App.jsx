import { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { a, useSpring } from "@react-spring/three";
import * as THREE from "three";

const TRANSITION_ALPHA = 0.05;
const BOUNDING_BOX_OPACITY = 0; // For debug purposes
const WIDTH = 2;
const HEIGHT = 2;
const WIDTH_SEGMENTS = 32;
const HEIGHT_SEGMENTS = 32;
const LAYER_SPACING = 1;
const X_SPACING = 0.25;
const Y_SPACING = HEIGHT - 0.25;
const Z_SPACING = 1;
const HOVER_PADDING = Y_SPACING + 2;
const ZOOM_DISTANCE = 3.5;

const CAMERA_ANGLE = (Math.PI * 5) / 12;
const CAMERA_DISTANCE = 16;
const DEFAULT_CAMERA_POSITION = [
  -CAMERA_DISTANCE * Math.cos(CAMERA_ANGLE),
  3.5,
  CAMERA_DISTANCE * Math.sin(CAMERA_ANGLE),
];

const TRANSLATE_ZONE_WIDTH = 0.1; // 10%
const TRANSLATE_SPEED = 4;

function useColorTexture(color) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return new THREE.CanvasTexture(canvas);
  }, [color]);
}

const NUM_LAYERS = 12; // ADD THIS
const NUM_HEADS = 6;

const COLORS = [
  "#ff4444",
  "#4444ff",
  "#44ff44",
  "#8888ff",
  "#ff44ff",
  "#44ffff",
  "#ffff44",
  "#ff8888",
  "#88ff88",
  "#8844ff",
  "#ff7f0e",
  "#ffffff",
];
const ATTENTION_DATA = Array.from(
  { length: NUM_HEADS * NUM_LAYERS },
  (_, i) => {
    const [layerIndex, headIndex] = [Math.floor(i / NUM_HEADS), i % NUM_HEADS];

    // Base color for the layer
    const baseColor = new THREE.Color(COLORS[layerIndex % COLORS.length]);

    // Slightly darken the color for each head
    baseColor.offsetHSL(0, 0, -0.05 * headIndex);

    const xOffset =
      (layerIndex - NUM_LAYERS / 2) * (WIDTH + LAYER_SPACING + X_SPACING);
    const zOffset = (headIndex - NUM_HEADS / 2) * Z_SPACING;
    const data = {
      color: `#${baseColor.getHexString()}`,
      label: `Layer ${layerIndex + 1} Head ${headIndex + 1}`,
      position: [
        xOffset + (headIndex - NUM_HEADS / 2 - 1) * X_SPACING - WIDTH / 2,
        0.5 * HEIGHT - 1,
        zOffset + (headIndex - NUM_HEADS / 2) * Z_SPACING,
      ],
    };

    return data;
  },
);

function AttentionHead({
  position,
  rotation,
  color,
  text,
  index,
  activeHead,
  setActiveHead,
}) {
  const groupRef = useRef();
  const texture = useColorTexture(color);
  const [hovered, setHovered] = useState(false);

  const active = useMemo(
    () => hovered || activeHead === index,
    [hovered, activeHead, index],
  );
  const { positionY } = useSpring({
    positionY: active ? position[1] + Y_SPACING : position[1],
    config: { mass: 1, tension: 280, friction: 60 },
  });

  useEffect(() => {
    if (!groupRef.current) return;
    active
      ? groupRef.current.traverse((o) => o.isMesh && o.layers.enable(1))
      : groupRef.current.traverse((o) => o.isMesh && o.layers.disable(1));
  }, [active]);

  const visible = activeHead === null || activeHead === index;
  return (
    <a.group
      ref={groupRef}
      position-x={position[0]}
      position-y={positionY}
      position-z={position[2]}
      rotation={rotation}
      visible={visible}
      onPointerOver={(e) => {
        if (!visible) return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        if (!visible) return;
        e.stopPropagation();
        setHovered(false);
      }}
      onClick={(e) => {
        if (activeHead !== index) {
          // Clicking on a different head/background
          setActiveHead(null);
        }
        if (!visible) return;

        e.stopPropagation();
        setActiveHead(activeHead === index ? null : index);
      }}
    >
      <Html
        position={[-WIDTH / 2, HEIGHT / 2, 0]}
        transform
        pointerEvents="none"
      >
        <div
          style={{
            color: "#fff",
            fontSize: "8px",
            transform: "translateX(50%) translateY(-50%)",
            opacity: visible ? 1 : 0,
          }}
        >
          {text}
        </div>
      </Html>

      <a.mesh position={[0, 0, 0]} pointerEvents="none">
        <planeGeometry
          args={[WIDTH, HEIGHT, WIDTH_SEGMENTS, HEIGHT_SEGMENTS]}
        />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      </a.mesh>
      <a.mesh
        position={[
          0,
          -(HOVER_PADDING - HEIGHT) / 2,
          /* Small epsilon to prevent z-fighting */ 1e-3,
        ]}
      >
        <planeGeometry
          args={[
            WIDTH,
            HEIGHT + HOVER_PADDING + HEIGHT,
            WIDTH_SEGMENTS,
            HEIGHT_SEGMENTS,
          ]}
        />
        <meshStandardMaterial
          color="white"
          transparent
          opacity={BOUNDING_BOX_OPACITY}
          side={THREE.DoubleSide}
        />
      </a.mesh>
    </a.group>
  );
}

function AttentionHeads({ activeHead, setActiveHead }) {
  return (
    <group position-y={1}>
      {ATTENTION_DATA.map((data, i) => (
        <AttentionHead
          key={i}
          index={i}
          activeHead={activeHead}
          setActiveHead={setActiveHead}
          position={data.position}
          rotation={[0, 0, 0]}
          color={data.color}
          text={data.label}
        />
      ))}
    </group>
  );
}

function CameraAnimator({ activeHead, mouseActive, mousePosition }) {
  const { camera } = useThree();
  const [sceneCenter, setSceneCenter] = useState([0, 0, 0]);
  const center =
    activeHead !== null
      ? ATTENTION_DATA[activeHead].position.slice()
      : [0, 0, 0];

  center[1] += Y_SPACING;
  let targetPosition;
  if (activeHead !== null) {
    center[1] += 1;
    targetPosition = center.slice();
    targetPosition[2] += ZOOM_DISTANCE;
  } else {
    targetPosition = DEFAULT_CAMERA_POSITION.slice();

    for (let i = 0; i < 3; i++) {
      center[i] += sceneCenter[i];
      targetPosition[i] += sceneCenter[i];
    }
  }

  useFrame((state, delta) => {
    if (!mouseActive) return;
    if (mousePosition.x < TRANSLATE_ZONE_WIDTH) {
      setSceneCenter((prev) => {
        const val = [...prev];
        val[0] = Math.max(
          val[0] - TRANSLATE_SPEED * delta,
          ATTENTION_DATA.at(0).position[0],
        );
        return val;
      });
    } else if (mousePosition.x > 1 - TRANSLATE_ZONE_WIDTH) {
      setSceneCenter((prev) => {
        const val = [...prev];
        val[0] = Math.min(
          val[0] + TRANSLATE_SPEED * delta,
          ATTENTION_DATA.at(-1).position[0],
        );
        return val;
      });
    }
  });

  const spring = useSpring({
    pos: targetPosition,
    config: { mass: 1, tension: 280, friction: 60 },
  });
  const springLookAt = useSpring({
    lookAt: center,
    config: { mass: 1, tension: 280, friction: 60 },
  });

  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    camera.position.lerp(
      new THREE.Vector3(...spring.pos.get()),
      TRANSITION_ALPHA,
    );
    targetLookAt.current.lerp(
      new THREE.Vector3(...springLookAt.lookAt.get()),
      TRANSITION_ALPHA,
    );
    camera.lookAt(targetLookAt.current);
  });
  return null;
}

function AttentionVisualization() {
  const [activeHead, setActiveHead] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [mouseActive, setMouseActive] = useState(false);

  useEffect(() => {
    // Added event listener

    const handleMouseMove = (event) => {
      const { clientX, clientY } = event;
      const width = window.innerWidth;
      const height = window.innerHeight;
      setMousePosition({
        x: clientX / width,
        y: clientY / height,
        active: true,
      });
    };
    const handleMouseLeave = () => setMouseActive(false);
    const handleMouseEnter = () => setMouseActive(true);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, []);

  return (
    <Canvas camera={{ fov: 45 }} gl={{ antialias: true }}>
      <CameraAnimator
        activeHead={activeHead}
        mouseActive={mouseActive}
        mousePosition={mousePosition}
      />
      <color attach="background" args={["#040b1b"]} />
      <gridHelper args={[100, 100, "white", "gray"]} />
      <Suspense fallback={null}>
        <AttentionHeads activeHead={activeHead} setActiveHead={setActiveHead} />
        <Environment preset="forest" />
        <EffectComposer>
          <Bloom
            intensity={1.2}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.8}
          />
        </EffectComposer>
        <ambientLight intensity={1} />
      </Suspense>
      <OrbitControls enablePan={true} enableZoom={false} />
    </Canvas>
  );
}

export default function App() {
  return (
    <div className="w-screen h-screen bg-black">
      <AttentionVisualization />
    </div>
  );
}