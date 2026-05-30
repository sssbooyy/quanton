import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import SapphireCrystalGem from "./SapphireCrystalGem.jsx";

const SHARD_ORBITS = [
  { radius: 1.35, y: 0.35, speed: 0.35, phase: 0, scale: 0.07 },
  { radius: 1.5, y: -0.15, speed: -0.28, phase: 1.2, scale: 0.05 },
  { radius: 1.25, y: 0.75, speed: 0.42, phase: 2.4, scale: 0.06 },
  { radius: 1.6, y: 0.1, speed: -0.22, phase: 3.6, scale: 0.055 },
  { radius: 1.4, y: -0.55, speed: 0.3, phase: 4.8, scale: 0.05 },
  { radius: 1.55, y: 0.55, speed: -0.38, phase: 5.5, scale: 0.045 },
];

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

function CrystalCore({ pulsing }) {
  const group = useRef(null);
  const pulseScale = useRef(1);
  const targetScale = useRef(1);

  useEffect(() => {
    if (pulsing) targetScale.current = 1.06;
  }, [pulsing]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y += delta * 0.22;
    group.current.position.y = Math.sin(t * 0.75) * 0.07;

    if (!pulsing && targetScale.current > 1) {
      targetScale.current = THREE.MathUtils.lerp(targetScale.current, 1, 0.12);
    } else if (!pulsing) {
      targetScale.current = 1;
    }

    pulseScale.current = THREE.MathUtils.lerp(pulseScale.current, targetScale.current, 0.18);
    group.current.scale.setScalar(pulseScale.current);
  });

  return (
    <group ref={group}>
      <group scale={[0.88, 1.42, 0.88]}>
        <mesh>
          <octahedronGeometry args={[0.72, 0]} />
          <meshPhysicalMaterial
            color="#1e88ff"
            emissive="#4ab8ff"
            emissiveIntensity={0.35}
            transmission={0.92}
            roughness={0.06}
            metalness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.08}
            thickness={1.4}
            ior={1.76}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh scale={0.82}>
          <octahedronGeometry args={[0.72, 0]} />
          <meshPhysicalMaterial
            color="#76c7ff"
            emissive="#76c7ff"
            emissiveIntensity={0.5}
            transmission={0.7}
            roughness={0.05}
            metalness={0.04}
            clearcoat={1}
            clearcoatRoughness={0.04}
            thickness={0.7}
            ior={1.62}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.16, 10, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.92} />
      </mesh>
      <pointLight position={[0, 0, 0.2]} color="#76c7ff" intensity={2.2} distance={2.2} />
    </group>
  );
}

function EnergyRings() {
  const rings = useRef(null);

  useFrame((_, delta) => {
    if (!rings.current) return;
    rings.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={rings} position={[0, -0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {[1.05, 0.82, 0.62].map((radius, i) => (
        <mesh key={radius} rotation={[0, 0, i * 0.4]}>
          <torusGeometry args={[radius, 0.012, 6, 48]} />
          <meshBasicMaterial color="#4ab8ff" transparent opacity={0.28 - i * 0.06} />
        </mesh>
      ))}
    </group>
  );
}

function FloatingShards() {
  const group = useRef(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const orbit = SHARD_ORBITS[i];
      const angle = t * orbit.speed + orbit.phase;
      child.position.set(Math.cos(angle) * orbit.radius, orbit.y + Math.sin(t + orbit.phase) * 0.05, Math.sin(angle) * orbit.radius * 0.55);
      child.rotation.y = angle;
    });
  });

  return (
    <group ref={group}>
      {SHARD_ORBITS.map((orbit, i) => (
        <mesh key={i} scale={orbit.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color="#76c7ff" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.22} color="#8b97a8" />
      <pointLight position={[2.5, 2.5, 3.5]} color="#1e88ff" intensity={3.2} distance={12} />
      <pointLight position={[-2.8, 0.5, 2]} color="#4ab8ff" intensity={2.4} distance={10} />
      <pointLight position={[0, -1.5, -3]} color="#76c7ff" intensity={1.6} distance={8} />
      <directionalLight position={[0, 4, -5]} intensity={0.45} color="#ffffff" />
    </>
  );
}

function CrystalScene({ pulsing }) {
  return (
    <>
      <SceneLights />
      <CrystalCore pulsing={pulsing} />
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

export default function SapphireCrystal3D({ onTap, disabled = false, pulsing = false }) {
  const webgl = useWebGLSupport();
  const dpr = useMemo(() => {
    if (typeof window === "undefined") return 1;
    return window.devicePixelRatio > 2 ? 1.5 : Math.min(window.devicePixelRatio, 2);
  }, []);

  function handlePointerDown(e) {
    e.preventDefault();
    if (disabled) return;
    onTap?.(e);
  }

  if (webgl === null) {
    return <div className="sapphire-crystal3d sapphire-crystal3d--loading" aria-hidden="true" />;
  }

  if (!webgl) {
    return (
      <div
        className={`sapphire-crystal3d ${disabled ? "sapphire-crystal3d--disabled" : ""}`}
        onPointerDown={handlePointerDown}
        style={{ touchAction: "manipulation" }}
        role="presentation"
      >
        <SvgFallback pulsing={pulsing} />
      </div>
    );
  }

  return (
    <div
      className={`sapphire-crystal3d ${disabled ? "sapphire-crystal3d--disabled" : ""}`}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "manipulation" }}
      role="presentation"
    >
      <Suspense fallback={<SvgFallback pulsing={pulsing} />}>
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
          camera={{ position: [0, 0.15, 3.6], fov: 40, near: 0.1, far: 20 }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <CrystalScene pulsing={pulsing} />
        </Canvas>
      </Suspense>
    </div>
  );
}
