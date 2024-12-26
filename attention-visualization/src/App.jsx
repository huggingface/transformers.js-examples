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
const X_SPACING = 0.25;
const Y_SPACING = HEIGHT - 0.25;
const Z_SPACING = 1;
const HOVER_PADDING = Y_SPACING + 2;
const ZOOM_DISTANCE = 3.5;

const CAMERA_ANGLE = (Math.PI * 5) / 12;
const CAMERA_DISTANCE = 12;
const DEFAULT_CAMERA_POSITION = [
  -CAMERA_DISTANCE * Math.cos(CAMERA_ANGLE),
  3.5,
  CAMERA_DISTANCE * Math.sin(CAMERA_ANGLE),
];

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

const NUM_LAYERS = 12;

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

const ATTENTION_DATA = Array.from({ length: NUM_LAYERS }, (_, i) => ({
  color: COLORS[i % COLORS.length],
  label: `Layer ${i + 1}`,
  position: [
    (i - NUM_LAYERS / 2 - 1) * X_SPACING - WIDTH / 2,
    0.5 * HEIGHT - 1,
    (i - NUM_LAYERS / 2) * Z_SPACING,
  ],
}));

function AttentionLayer({
  position,
  rotation,
  color,
  text,
  index,
  activeLayer,
  setActiveLayer,
}) {
  const groupRef = useRef();
  const texture = useColorTexture(color);
  const [hovered, setHovered] = useState(false);

  const active = useMemo(
    () => hovered || activeLayer === index,
    [hovered, activeLayer, index],
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

  const visible = activeLayer === null || activeLayer === index;
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
        console.log("activeLayer === index", activeLayer === index);
        if (activeLayer !== index) {
          // Clicking on a different layer/background
          setActiveLayer(null);
        }
        if (!visible) return;

        e.stopPropagation();
        setActiveLayer(activeLayer === index ? null : index);
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

function AttentionLayers({ activeLayer, setActiveLayer }) {
  return (
    <group position-y={1}>
      {ATTENTION_DATA.map((data, i) => (
        <AttentionLayer
          key={i}
          index={i}
          activeLayer={activeLayer}
          setActiveLayer={setActiveLayer}
          position={data.position}
          rotation={[0, 0, 0]}
          color={data.color}
          text={data.label}
        />
      ))}
    </group>
  );
}

function CameraAnimator({ activeLayer }) {
  const { camera } = useThree();
  console.log({ activeLayer });

  const center =
    activeLayer !== null
      ? ATTENTION_DATA[activeLayer].position.slice()
      : [0, 0, 0];
  center[1] += Y_SPACING;
  let targetPosition;
  if (activeLayer !== null) {
    center[1] += 1;
    targetPosition = center.slice();
    targetPosition[2] += ZOOM_DISTANCE;
  } else {
    targetPosition = DEFAULT_CAMERA_POSITION;
  }
  const spring = useSpring({
    pos: targetPosition,
    config: { mass: 1, tension: 280, friction: 60 },
  });
  targetPosition = new THREE.Vector3(...targetPosition);

  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    camera.position.lerp(
      new THREE.Vector3(...spring.pos.get()),
      TRANSITION_ALPHA,
    );
    const desiredLookAt = new THREE.Vector3(...center);
    targetLookAt.current.lerp(desiredLookAt, TRANSITION_ALPHA);
    camera.lookAt(targetLookAt.current);
  });
  return null;
}

function AttentionVisualization() {
  const [activeLayer, setActiveLayer] = useState(null);

  return (
    <Canvas camera={{ fov: 45 }} gl={{ antialias: true }}>
      <CameraAnimator activeLayer={activeLayer} />
      <color attach="background" args={["#040b1b"]} />
      <gridHelper args={[100, 100, "white", "gray"]} />
      <Suspense fallback={null}>
        <AttentionLayers
          activeLayer={activeLayer}
          setActiveLayer={setActiveLayer}
        />
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
