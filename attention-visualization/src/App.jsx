import { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { a, useSpring } from "@react-spring/three";
import * as THREE from "three";

// Input image
const EXAMPLE_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg";
const IMAGE_HEIGHT = 4;
const MAX_IMAGE_WIDTH = 8;
const IMAGE_PADDING = 1.5;

// Attention heads
const ATTENTION_HEAD_HEIGHT = 2.4;
const FONT_SIZE = 0.2;
const X_SPACING = 0.4;
const Y_SPACING = ATTENTION_HEAD_HEIGHT - 0.25;
const Z_SPACING = 2;
const HOVER_PADDING = Y_SPACING + 2;
const LAYER_SPACING = 0.25;

// Scene
const START_PADDING = 0;
const END_PADDING = 1;
const TEXT_PADDING = 2;

// Camera
const ZOOM_DISTANCE = 3.5;
const CAMERA_ANGLE = (Math.PI * 5) / 12;
const CAMERA_DISTANCE = 16;
const DEFAULT_CAMERA_POSITION = [
  -CAMERA_DISTANCE * Math.cos(CAMERA_ANGLE),
  3.5,
  CAMERA_DISTANCE * Math.sin(CAMERA_ANGLE),
];
const TRANSLATE_ZONE_WIDTH = 0.5;
const TRANSLATE_SPEED = 12;

// Misc.
const GRID_SIZE = 400;
const TRANSITION_ALPHA = 0.05;

function AttentionHead({
  position,
  rotation,
  text,
  index,
  activeHead,
  setActiveHead,
  image,
}) {
  const groupRef = useRef();
  const texture = useMemo(() => new THREE.CanvasTexture(image), [image]);
  const width = useMemo(
    () => (ATTENTION_HEAD_HEIGHT * texture.image.width) / texture.image.height,
    [texture],
  );
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
          setActiveHead(null);
        }
        if (!visible) return;
        e.stopPropagation();
        setActiveHead(activeHead === index ? null : index);
      }}
    >
      <Text
        position={[
          -width / 2,
          ATTENTION_HEAD_HEIGHT / 2 + FONT_SIZE,
          2e-3, // Small epsilon to prevent z-fighting
        ]}
        fontSize={FONT_SIZE}
        color="#fff"
        anchorX="left"
        anchorY="top"
        fillOpacity={visible ? 1 : 0}
        raycast={() => null}
        lineHeight={0.5}
      >
        {text}
      </Text>

      <a.mesh position={[0, 0, 0]} raycast={() => null}>
        <planeGeometry args={[width, ATTENTION_HEAD_HEIGHT]} />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      </a.mesh>

      <a.mesh
        position={[
          0,
          -(HOVER_PADDING - ATTENTION_HEAD_HEIGHT) / 2,
          1e-3, // Small epsilon to prevent z-fighting
        ]}
      >
        <planeGeometry
          args={[width, 2 * ATTENTION_HEAD_HEIGHT + HOVER_PADDING]}
        />
        <meshStandardMaterial
          color="white"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </a.mesh>
    </a.group>
  );
}

function AttentionHeads({ attentionData, activeHead, setActiveHead }) {
  return (
    <group position-y={1}>
      {attentionData.map((data, i) => (
        <AttentionHead
          key={i}
          index={i}
          activeHead={activeHead}
          setActiveHead={setActiveHead}
          position={data.position}
          rotation={[0, 0, 0]}
          text={data.label}
          image={data.image}
        />
      ))}
    </group>
  );
}

function SceneImage({ image, onImageChange }) {
  const texture = useLoader(THREE.TextureLoader, image);
  const [image_width, image_height] = useMemo(() => {
    const ar = texture.source.data.width / texture.source.data.height;
    let w = ar * IMAGE_HEIGHT;
    let h = IMAGE_HEIGHT;
    if (w > MAX_IMAGE_WIDTH) {
      w = MAX_IMAGE_WIDTH;
      h = w / ar;
    }
    return [w, h];
  }, [texture]);

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.gif,.bmp,.webp";
    input.onchange = (e) => {
      if (e.target.files?.[0]) {
        onImageChange(URL.createObjectURL(e.target.files[0]));
      }
    };
    input.click();
  };

  return (
    <Suspense fallback={null}>
      <mesh
        position={[0 - image_width / 2 - IMAGE_PADDING, image_height / 2, 0]}
        onClick={handleClick}
      >
        <planeGeometry args={[image_width, image_height]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </Suspense>
  );
}

function CameraAnimator({
  start,
  end,
  attentionData,
  activeHead,
  mouseActive,
  mousePosition,
}) {
  const { camera } = useThree();
  const [sceneCenter, setSceneCenter] = useState([0, 0, 0]);
  const center =
    activeHead !== null
      ? attentionData[activeHead].position.slice()
      : [0, 0, 0];

  center[1] += Y_SPACING;
  let targetPosition;

  if (activeHead !== null) {
    center[1] += 1;
    targetPosition = center.slice();
    targetPosition[2] += ZOOM_DISTANCE;
  } else {
    targetPosition = DEFAULT_CAMERA_POSITION.slice();
    for (let i = 0; i < 3; ++i) {
      center[i] += sceneCenter[i];
      targetPosition[i] += sceneCenter[i];
    }
  }

  useEffect(() => {
    setSceneCenter([end + END_PADDING, 0, 0]);
  }, [end]);

  useFrame((state, delta) => {
    if (!mouseActive) return;
    const a = TRANSLATE_SPEED; // max speed
    const b = TRANSLATE_ZONE_WIDTH; // deadzone
    const c = 2; // acceleration
    const f = (x) => a * ((x ** 2 - b ** 2) / (1 - b ** 2)) ** c;
    if (Math.abs(mousePosition.x) >= b) {
      const value = f(mousePosition.x);
      setSceneCenter((prev) => {
        const newCenter = [...prev];
        newCenter[0] += value * delta * Math.sign(mousePosition.x); // Update x position
        newCenter[0] = Math.max(
          Math.min(newCenter[0], end + END_PADDING),
          start - START_PADDING,
        ); // Clamp x position
        return newCenter;
      });
    }
  });

  const spring = useSpring({
    pos: targetPosition,
    config: { mass: 1, tension: 500, friction: 20 },
  });
  const springLookAt = useSpring({
    lookAt: center,
    config: { mass: 1, tension: 500, friction: 20 },
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

function AttentionVisualization({
  label,
  score,
  attentionData,
  image,
  onImageChange,
}) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    let idx = 1;
    const timer = setInterval(() => {
      idx = (idx % 3) + 1;
      setDots(".".repeat(idx));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const [start, end] = useMemo(
    () =>
      attentionData.length > 0
        ? attentionData.reduce(
            ([min, max], data) => [
              Math.min(min, data.position[0] - data.width / 2),
              Math.max(max, data.position[0] + data.width / 2),
            ],
            [Infinity, -Infinity],
          )
        : [0, 0],
    [attentionData],
  );

  const [activeHead, setActiveHead] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [mouseActive, setMouseActive] = useState(false);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const { clientX, clientY } = event;
      const width = window.innerWidth;
      const height = window.innerHeight;
      setMousePosition({
        x: (clientX / width - 0.5) * 2,
        y: (clientY / height - 0.5) * 2,
      });
    };
    const handleMouseLeave = () => setMouseActive(false);
    const handleMouseEnter = () => setMouseActive(true);

    // NOTE: Certain browsers, like Firefox, require us to attach the event listeners to `document.documentElement`
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);
    document.documentElement.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.documentElement.removeEventListener(
        "mouseleave",
        handleMouseLeave,
      );
      document.documentElement.removeEventListener(
        "mouseenter",
        handleMouseEnter,
      );
      document.documentElement.removeEventListener(
        "mousemove",
        handleMouseMove,
      );
    };
  }, []);

  return (
    <Canvas
      camera={{ fov: 45 }}
      gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
    >
      <CameraAnimator
        start={start}
        end={end}
        attentionData={attentionData}
        activeHead={activeHead}
        mouseActive={mouseActive}
        mousePosition={mousePosition}
      />
      <color attach="background" args={["#040b1b"]} />
      <gridHelper args={[GRID_SIZE, GRID_SIZE, "white", "gray"]} />
      {image && <SceneImage image={image} onImageChange={onImageChange} />}

      <Suspense fallback={null}>
        {!image && (
          <Text
            position={[-1.5, IMAGE_HEIGHT / 2, 0]}
            fontSize={1}
            color="#fff"
            anchorX="left"
            fillOpacity={1}
            raycast={() => null}
          >
            Loading{dots}
          </Text>
        )}
        <AttentionHeads
          attentionData={attentionData}
          activeHead={activeHead}
          setActiveHead={setActiveHead}
        />
      </Suspense>
      {label && (
        <Text
          position={[end + TEXT_PADDING, 1.25 * ATTENTION_HEAD_HEIGHT, 0]}
          fontSize={1}
          color="#fff"
          anchorX="left"
          fillOpacity={1}
          raycast={() => null}
        >
          {label}
        </Text>
      )}
      {score && (
        <Text
          position={[end + TEXT_PADDING, 0.75 * ATTENTION_HEAD_HEIGHT, 0]}
          fontSize={0.8}
          color="#fff"
          anchorX="left"
          fillOpacity={1}
          raycast={() => null}
        >
          {" ".repeat((label?.length || 0) * (2 / 3))}({score.toFixed(2)}%)
        </Text>
      )}
      <EffectComposer>
        <Bloom
          intensity={0.2}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.8}
        />
      </EffectComposer>
      <ambientLight intensity={2} />
    </Canvas>
  );
}

export default function App() {
  const [result, setResult] = useState(null);
  const attentionData = useMemo(() => {
    if (!result) return [];
    return result.attentions.map(({ layer, head, num_heads, image }) => {
      const width = (ATTENTION_HEAD_HEIGHT * image.width) / image.height;
      const depthOffset = (num_heads - 1) * X_SPACING;
      const xOffset =
        width / 2 + depthOffset + layer * (width + depthOffset + LAYER_SPACING);
      const position = [
        xOffset - head * X_SPACING,
        0.5 * ATTENTION_HEAD_HEIGHT - 1,
        ((num_heads + 1) / 2 - head - 1) * Z_SPACING,
      ];
      const label = `Layer ${layer + 1}, Head ${head + 1}`;
      return { position, label, image, width };
    });
  }, [result]);

  const label = useMemo(() => result?.label, [result]);
  const score = useMemo(() => result?.score, [result]);

  const [state, setState] = useState(null);
  const [image, setImage] = useState(null);
  const worker = useRef(null);

  const handleImageChange = (image) => {
    setImage(image);
    worker.current.postMessage({ image });
  };

  useEffect(() => {
    // Initialize worker on mount
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    // NOTE: Certain browsers handle error messages differently, so to ensure
    // compatibility, we need to handle errors in both `message` and `error` events.
    const onMessage = ({ data }) => {
      switch (data.type) {
        case "status":
        case "error":
          setState(data);
          break;
        case "output":
          setResult(data.result);
          break;
      }
    };
    const onError = (e) => setState({ type: "error", error: e.message });

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
    if (
      state &&
      state.type === "status" &&
      state.status === "ready" &&
      image === null
    ) {
      // Run on first load
      handleImageChange(EXAMPLE_URL);
    }
  }, [state, image]);

  return (
    <div className="w-screen supports-[height:100cqh]:h-[100cqh] supports-[height:100svh]:h-[100svh] bg-black">
      {state?.type === "error" ? (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-1 text-red-600 text-3xl px-8 backdrop-blur-lg bg-black/75 text-center">
          {state.error}
        </div>
      ) : (
        <AttentionVisualization
          label={label}
          score={score}
          attentionData={attentionData}
          image={image}
          onImageChange={handleImageChange}
        />
      )}
    </div>
  );
}
