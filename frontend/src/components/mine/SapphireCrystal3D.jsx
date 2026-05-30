import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import SapphireCrystalGem from "./SapphireCrystalGem.jsx";

const SEGMENTS = 16;
const CYAN = "#76c7ff";
const SAPPHIRE = "#1e88ff";
const DEEP = "#0a3060";

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

/** Tall faceted sapphire profile — top apex, crown, girdle, pavilion, bottom apex */
const CRYSTAL_RINGS = [
  { y: 0.74, r: 0.18 },
  { y: 0.42, r: 0.42 },
  { y: 0.02, r: 0.58 },
  { y: -0.42, r: 0.38 },
  { y: -0.78, r: 0.15 },
];

const TOP_APEX_Y = 1.16;
const BOTTOM_APEX_Y = -1.14;

function ringVertices(y, radius, segments) {
  return Array.from({ length: segments }, (_, i) => {
    const a = (i / segments) * Math.PI * 2;
    return new THREE.Vector3(Math.sin(a) * radius, y, Math.cos(a) * radius);
  });
}

function pushTriangle(a, b, c, positions, indices) {
  const base = positions.length / 3;
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  indices.push(base, base + 1, base + 2);
}

function createSapphireCrystalGeometry(segments = SEGMENTS) {
  const topApex = new THREE.Vector3(0, TOP_APEX_Y, 0);
  const bottomApex = new THREE.Vector3(0, BOTTOM_APEX_Y, 0);
  const rings = CRYSTAL_RINGS.map(({ y, r }) => ringVertices(y, r, segments));

  const positions = [];
  const indices = [];

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    pushTriangle(topApex, rings[0][i], rings[0][j], positions, indices);
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      pushTriangle(rings[r][i], rings[r + 1][i], rings[r][j], positions, indices);
      pushTriangle(rings[r][j], rings[r + 1][i], rings[r + 1][j], positions, indices);
    }
  }

  const last = rings.length - 1;
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    pushTriangle(rings[last][i], bottomApex, rings[last][j], positions, indices);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFacetHighlightGeometry(segments = SEGMENTS) {
  const topApex = new THREE.Vector3(0, TOP_APEX_Y, 0);
  const rings = CRYSTAL_RINGS.map(({ y, r }) => ringVertices(y, r, segments));
  const positions = [];
  const offset = 0.012;

  function addHighlightTriangle(a, b, c) {
    const normal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a))
      .normalize();
    if (normal.x + normal.y * 0.6 + normal.z * 0.4 < 0.15) return;

    const centroid = new THREE.Vector3()
      .add(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const shrink = 0.68;
    const lift = normal.clone().multiplyScalar(offset);
    const p1 = a.clone().lerp(centroid, 1 - shrink).add(lift);
    const p2 = b.clone().lerp(centroid, 1 - shrink).add(lift);
    const p3 = c.clone().lerp(centroid, 1 - shrink).add(lift);

    positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
  }

  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    addHighlightTriangle(topApex, rings[0][i], rings[0][j]);
  }

  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      addHighlightTriangle(rings[r][i], rings[r + 1][i], rings[r][j]);
      addHighlightTriangle(rings[r][j], rings[r + 1][i], rings[r + 1][j]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createFacetEdgeLines(segments = SEGMENTS) {
  const topApex = new THREE.Vector3(0, TOP_APEX_Y, 0);
  const rings = CRYSTAL_RINGS.map(({ y, r }) => ringVertices(y, r, segments));
  const positions = [];
  const pushEdge = (a, b) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };

  for (let i = 0; i < segments; i += 2) {
    const j = (i + 1) % segments;
    pushEdge(topApex, rings[0][i]);
    pushEdge(rings[0][i], rings[1][i]);
    pushEdge(rings[1][i], rings[2][i]);
  }

  for (let i = 1; i < segments; i += 2) {
    pushEdge(rings[2][i], rings[3][i]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
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
    const faces = [
      makeEnvFaceCanvas(true),
      makeEnvFaceCanvas(false),
      makeEnvFaceCanvas(true),
      makeEnvFaceCanvas(false),
      makeEnvFaceCanvas(true),
      makeEnvFaceCanvas(false),
    ];
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

const shellMaterialProps = {
  color: SAPPHIRE,
  emissive: "#4ab8ff",
  emissiveIntensity: 0.18,
  transmission: 0.6,
  roughness: 0.05,
  metalness: 0.02,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  ior: 1.8,
  thickness: 2.5,
  envMapIntensity: 2,
  transparent: true,
  side: THREE.DoubleSide,
};

const innerMaterialProps = {
  color: DEEP,
  emissive: "#1568cc",
  emissiveIntensity: 0.35,
  transmission: 0.35,
  roughness: 0.08,
  metalness: 0.03,
  clearcoat: 0.85,
  clearcoatRoughness: 0.06,
  ior: 1.72,
  thickness: 1.6,
  envMapIntensity: 1.2,
  transparent: true,
  opacity: 0.88,
};

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

function CrystalGem({ geometry, innerGeometry, highlightGeometry, edgeGeometry, pulsing }) {
  const group = useRef(null);
  const pulseScale = useRef(1);
  const targetScale = useRef(1);

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
      <mesh geometry={geometry} castShadow={false} receiveShadow={false}>
        <meshPhysicalMaterial {...shellMaterialProps} />
      </mesh>

      <mesh geometry={innerGeometry} scale={0.86}>
        <meshPhysicalMaterial {...innerMaterialProps} />
      </mesh>

      <mesh geometry={highlightGeometry}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial color="#b8e8ff" transparent opacity={0.55} blending={THREE.AdditiveBlending} />
      </lineSegments>

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

function FloatingShards({ shardGeometry }) {
  const group = useRef(null);

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
  const geometry = useMemo(() => createSapphireCrystalGeometry(SEGMENTS), []);
  const innerGeometry = useMemo(() => createSapphireCrystalGeometry(SEGMENTS), []);
  const highlightGeometry = useMemo(() => createFacetHighlightGeometry(SEGMENTS), []);
  const edgeGeometry = useMemo(() => createFacetEdgeLines(SEGMENTS), []);
  const shardGeometry = useMemo(() => createSapphireCrystalGeometry(8), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      innerGeometry.dispose();
      highlightGeometry.dispose();
      edgeGeometry.dispose();
      shardGeometry.dispose();
    };
  }, [geometry, innerGeometry, highlightGeometry, edgeGeometry, shardGeometry]);

  return (
    <>
      <SapphireEnvironment />
      <SceneLights />
      <CrystalGem
        geometry={geometry}
        innerGeometry={innerGeometry}
        highlightGeometry={highlightGeometry}
        edgeGeometry={edgeGeometry}
        pulsing={pulsing}
      />
      <EnergyRings />
      <FloatingShards shardGeometry={shardGeometry} />
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
          camera={{ position: [0, 0.08, 3.85], fov: 38, near: 0.1, far: 20 }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.12;
          }}
        >
          <CrystalScene pulsing={pulsing} />
        </Canvas>
      </Suspense>
    </div>
  );
}
