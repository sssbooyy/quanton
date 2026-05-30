import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import SapphireCrystalGem from "./SapphireCrystalGem.jsx";
import sapphireCrystalGlb from "../../assets/models/sapphire-crystal.glb?url";

const CYAN = "#76c7ff";
const SAPPHIRE = "#1e88ff";
const TARGET_HEIGHT = 2.15;

const SHARD_ORBITS = [
  { radius: 1.05, y: 0.55, speed: 0.26, phase: 0, scale: 0.11 },
  { radius: 1.22, y: 0.15, speed: -0.22, phase: 0.9, scale: 0.09 },
  { radius: 0.95, y: -0.25, speed: 0.3, phase: 1.8, scale: 0.1 },
  { radius: 1.35, y: 0.35, speed: -0.18, phase: 2.7, scale: 0.08 },
  { radius: 1.15, y: -0.55, speed: 0.24, phase: 3.5, scale: 0.085 },
  { radius: 1.42, y: 0.05, speed: -0.28, phase: 4.2, scale: 0.075 },
  { radius: 1.08, y: 0.78, speed: 0.2, phase: 5.1, scale: 0.07 },
  { radius: 1.28, y: -0.15, speed: -0.25, phase: 5.9, scale: 0.095 },
  { radius: 1.38, y: 0.62, speed: 0.16, phase: 6.7, scale: 0.065 },
  { radius: 1.18, y: -0.68, speed: -0.21, phase: 7.4, scale: 0.08 },
];

const RING_CONFIG = [
  { radius: 0.95, opacity: 0.42, speed: 0.06 },
  { radius: 0.78, opacity: 0.34, speed: -0.08 },
  { radius: 0.62, opacity: 0.28, speed: 0.05 },
  { radius: 0.48, opacity: 0.22, speed: -0.07 },
  { radius: 0.34, opacity: 0.16, speed: 0.09 },
];

useGLTF.preload(sapphireCrystalGlb);

function makeSapphireMaterial(source) {
  const src = Array.isArray(source) ? source[0] : source;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(SAPPHIRE),
    emissive: new THREE.Color("#4ab8ff"),
    emissiveIntensity: 0.14,
    transmission: 0.62,
    roughness: 0.05,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.8,
    thickness: 2.2,
    envMapIntensity: 1.6,
    transparent: true,
    side: THREE.DoubleSide,
    map: src?.map ?? null,
    normalMap: src?.normalMap ?? null,
    aoMap: src?.aoMap ?? null,
  });
}

function prepareCrystalModel(scene) {
  const model = scene.clone(true);

  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) => {
        const next = makeSapphireMaterial(mat);
        mat?.dispose?.();
        return next;
      });
    } else {
      const next = makeSapphireMaterial(child.material);
      child.material?.dispose?.();
      child.material = next;
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  model.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  model.scale.setScalar(TARGET_HEIGHT / maxDim);

  return model;
}

function makeEnvFaceCanvas(bright) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bright ? "#1a3d6e" : "#050810";
  ctx.fillRect(0, 0, 32, 32);
  const g = ctx.createRadialGradient(16, bright ? 6 : 16, 0, 16, 16, 22);
  g.addColorStop(0, bright ? "rgba(255,255,255,0.85)" : "rgba(30,136,255,0.35)");
  g.addColorStop(1, "rgba(5,10,20,0.05)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvas;
}

function useWebGLSupport() {
  const [supported, setSupported] = useState(null);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const ok = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
      setSupported(ok);
    } catch {
      setSupported(false);
    }
  }, []);

  return supported;
}

function SapphireEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const faces = Array.from({ length: 6 }, (_, i) => makeEnvFaceCanvas(i % 2 === 0));
    const cube = new THREE.CubeTexture(faces);
    cube.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileCubemapShader();
    const envMap = pmrem.fromCubemap(cube).texture;
    scene.environment = envMap;

    return () => {
      scene.environment = null;
      pmrem.dispose();
      cube.dispose();
      envMap.dispose();
    };
  }, [gl, scene]);

  return null;
}

function GlowCore({ pulsing }) {
  const mesh = useRef(null);
  const light = useRef(null);
  const tapBoost = useRef(0);

  useEffect(() => {
    if (pulsing) tapBoost.current = 1;
  }, [pulsing]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    tapBoost.current = THREE.MathUtils.lerp(tapBoost.current, 0, delta * 3.5);
    const pulse = 1 + Math.sin(t * 1.15) * 0.1 + tapBoost.current * 0.22;
    const intensity = 1.4 + Math.sin(t * 1.15) * 0.35 + tapBoost.current * 1.8;

    if (mesh.current) {
      mesh.current.scale.setScalar(0.14 * pulse);
      mesh.current.material.opacity = 0.75 + Math.sin(t * 1.15) * 0.12 + tapBoost.current * 0.2;
    }
    if (light.current) {
      light.current.intensity = intensity;
    }
  });

  return (
    <>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={2.2}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={light} color={CYAN} intensity={2.2} distance={2.8} decay={2} />
    </>
  );
}

function GlbCrystal({ pulsing }) {
  const group = useRef(null);
  const pulseScale = useRef(1);
  const targetScale = useRef(1);
  const { scene } = useGLTF(sapphireCrystalGlb);
  const model = useMemo(() => prepareCrystalModel(scene), [scene]);

  useEffect(() => {
    if (pulsing) targetScale.current = 1.06;
  }, [pulsing]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y += delta * 0.18;
    group.current.position.y = Math.sin(t * 0.65) * 0.06;

    if (!pulsing && targetScale.current > 1) {
      targetScale.current = THREE.MathUtils.lerp(targetScale.current, 1, 0.1);
    } else if (!pulsing) {
      targetScale.current = 1;
    }

    pulseScale.current = THREE.MathUtils.lerp(pulseScale.current, targetScale.current, 0.16);
    group.current.scale.setScalar(pulseScale.current);
  });

  return (
    <group ref={group}>
      <primitive object={model} />
      <GlowCore pulsing={pulsing} />
    </group>
  );
}

function EnergyRings() {
  const group = useRef(null);
  const ringRefs = useRef([]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.04;
    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.rotation.z += delta * RING_CONFIG[i].speed;
    });
  });

  return (
    <group ref={group} position={[0, -1.22, 0]} rotation={[Math.PI / 2.15, 0, 0]} scale={[1, 0.32, 1]}>
      {RING_CONFIG.map((cfg, i) => (
        <mesh
          key={cfg.radius}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          rotation={[0, 0, i * 0.55]}
        >
          <torusGeometry args={[cfg.radius, 0.014, 6, 40]} />
          <meshStandardMaterial
            color={SAPPHIRE}
            emissive={CYAN}
            emissiveIntensity={1.6}
            transparent
            opacity={cfg.opacity}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function FloatingShards() {
  const group = useRef(null);
  const shardGeometry = useMemo(() => {
    const geo = new THREE.OctahedronGeometry(0.45, 0);
    geo.scale(0.85, 1.35, 0.85);
    return geo;
  }, []);

  useEffect(() => () => shardGeometry.dispose(), [shardGeometry]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const orbit = SHARD_ORBITS[i];
      const angle = t * orbit.speed + orbit.phase;
      child.position.set(
        Math.cos(angle) * orbit.radius,
        orbit.y + Math.sin(t * 0.9 + orbit.phase) * 0.07,
        Math.sin(angle) * orbit.radius * 0.5
      );
      child.rotation.set(Math.sin(angle) * 0.4, angle, Math.cos(angle) * 0.3);
    });
  });

  return (
    <group ref={group}>
      {SHARD_ORBITS.map((orbit, i) => (
        <mesh key={i} geometry={shardGeometry} scale={orbit.scale}>
          <meshPhysicalMaterial
            color={SAPPHIRE}
            emissive="#4ab8ff"
            emissiveIntensity={0.45}
            transmission={0.55}
            roughness={0.06}
            metalness={0.02}
            clearcoat={1}
            ior={1.76}
            thickness={1.2}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.14} color="#1e88ff" />
      <pointLight position={[0, -2.2, 0.4]} color="#1e88ff" intensity={2.8} distance={10} decay={2} />
      <directionalLight position={[-2.5, 4.5, 2.5]} intensity={0.85} color="#ffffff" />
      <pointLight position={[1.8, 1.2, 2.2]} color="#4ab8ff" intensity={1.2} distance={8} decay={2} />
    </>
  );
}

function CrystalScene({ pulsing }) {
  return (
    <>
      <SapphireEnvironment />
      <SceneLights />
      <GlbCrystal pulsing={pulsing} />
      <EnergyRings />
      <FloatingShards />
    </>
  );
}

function SvgFallback({ pulsing }) {
  return (
    <div className={`sapphire-crystal3d__fallback ${pulsing ? "sapphire-crystal3d__fallback--tap" : ""}`}>
      <SapphireCrystalGem />
    </div>
  );
}

class GlbErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function CrystalCanvas({ pulsing }) {
  const dpr = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return window.devicePixelRatio > 2 ? 1.5 : Math.min(window.devicePixelRatio, 2);
  }, []);

  return (
    <Canvas
      className="sapphire-crystal3d__canvas"
      dpr={dpr}
      frameloop="always"
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0, 0.08, 3.85], fov: 38, near: 0.1, far: 20 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
    >
      <CrystalScene pulsing={pulsing} />
    </Canvas>
  );
}

export default function SapphireCrystal3D({ onTap, disabled = false, pulsing = false }) {
  const webgl = useWebGLSupport();
  const [glbFailed, setGlbFailed] = useState(false);

  function handlePointerDown(e) {
    e.preventDefault();
    if (disabled) return;
    onTap?.(e);
  }

  if (webgl === null) {
    return <div className="sapphire-crystal3d sapphire-crystal3d--loading" aria-hidden="true" />;
  }

  const useFallback = !webgl || glbFailed;

  return (
    <div
      className={`sapphire-crystal3d ${disabled ? "sapphire-crystal3d--disabled" : ""}`}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "manipulation" }}
      role="presentation"
    >
      {useFallback ? (
        <SvgFallback pulsing={pulsing} />
      ) : (
        <GlbErrorBoundary onError={() => setGlbFailed(true)} fallback={<SvgFallback pulsing={pulsing} />}>
          <Suspense fallback={<SvgFallback pulsing={pulsing} />}>
            <CrystalCanvas pulsing={pulsing} />
          </Suspense>
        </GlbErrorBoundary>
      )}
    </div>
  );
}
