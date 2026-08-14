"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TEAL = new THREE.Color("#a8441c");
const GREEN = new THREE.Color("#d97b45");
const RIM = new THREE.Color("#fbe3cd");

const SIGNALS = [
  { color: "#cf7a44", phase: 0.2 },
  { color: "#d99c6d", phase: 2.28 },
  { color: "#e8c49a", phase: 4.36 },
] as const;

const VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(x); x *= 2.1; a *= 0.5; }
    return v;
  }

  vec3 displaced(vec3 p, vec3 n, float t) {
    float d = fbm(p * 1.1 + vec3(t, t * 0.7, -t));
    vec3 pos = p;
    pos.x *= 1.18;
    pos.y += (fbm(vec3(pos.y * 2.0, 0.3, t)) - 0.5) * 0.35;
    pos += n * d * 0.48;
    return pos;
  }

  void main() {
    float t = uTime * 0.35;
    vec3 pos = displaced(position, normal, t);
    vDisp = fbm(position * 1.1 + vec3(t, t * 0.7, -t));

    vec3 n = normalize(normal);
    vec3 tangent = abs(n.y) < 0.999
      ? normalize(cross(vec3(0.0, 1.0, 0.0), n))
      : normalize(cross(vec3(1.0, 0.0, 0.0), n));
    vec3 bitangent = normalize(cross(n, tangent));
    float eps = 0.01;
    vec3 p0 = displaced(position, n, t);
    vec3 p1 = displaced(position + tangent * eps, n, t);
    vec3 p2 = displaced(position + bitangent * eps, n, t);
    vec3 newNormal = normalize(cross(p1 - p0, p2 - p0));

    vNormal = normalize(normalMatrix * newNormal);
    vPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, normalize(vNormal)), 0.0, 1.0), 2.5);
    vec3 base = mix(uColorA, uColorB, clamp(vDisp * 1.6, 0.0, 1.0));
    vec3 col = base + uRim * fresnel * (0.52 + 0.22 * sin(uTime * 1.5));
    float alpha = 0.8 + 0.18 * fresnel;
    gl_FragColor = vec4(col, alpha);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (2.1 + sin(uTime * 2.0 + aPhase) * 1.2) * (6.0 / -mvPosition.z);
    vAlpha = 0.44 + 0.15 * sin(uTime * 2.0 + aPhase * 2.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.1, d);
    gl_FragColor = vec4(uColor, a);
  }
`;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function KidneyCore({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const follow = useRef({ x: 0, y: 0 });
  const spin = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorA: { value: TEAL },
      uColorB: { value: GREEN },
      uRim: { value: RIM },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (material.current) material.current.uniforms.uTime.value = reduced ? 0.6 : state.clock.elapsedTime;
    if (!mesh.current || reduced) return;

    const smoothing = 1 - Math.exp(-4 * delta);
    spin.current += delta * 0.14;
    follow.current.x += (state.pointer.x * 0.24 - follow.current.x) * smoothing;
    follow.current.y += (state.pointer.y * 0.16 - follow.current.y) * smoothing;

    mesh.current.rotation.y = spin.current + follow.current.x;
    mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1 + follow.current.y;
    mesh.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.025;
    mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.15;
  });

  return (
    <mesh ref={mesh} scale={2.02}>
      <sphereGeometry args={[1, 72, 72]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function SignalNode({ color, phase, reduced }: (typeof SIGNALS)[number] & { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const hovered = useRef(false);

  useFrame((state, delta) => {
    if (!group.current) return;

    const t = reduced ? phase : state.clock.elapsedTime * 0.26 + phase;
    const radius = 3.05;
    group.current.position.set(
      Math.cos(t) * radius,
      Math.sin(t * 1.7 + phase) * 0.56,
      Math.sin(t) * 0.64,
    );

    const target = hovered.current ? 1.45 : 1;
    const next = group.current.scale.x + (target - group.current.scale.x) * (1 - Math.exp(-8 * delta));
    group.current.scale.setScalar(next);
  });

  return (
    <group ref={group}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          hovered.current = true;
        }}
        onPointerOut={() => {
          hovered.current = false;
        }}
      >
        <sphereGeometry args={[0.1, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.98} />
      </mesh>
      <mesh scale={2.5}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
}

function OrbitSystem({ reduced }: { reduced: boolean }) {
  const orbit = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!orbit.current || reduced) return;
    orbit.current.rotation.y += delta * 0.055;
    orbit.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.24) * 0.09;
  });

  return (
    <group ref={orbit} rotation={[0.78, 0.18, -0.34]}>
      <mesh>
        <torusGeometry args={[3.05, 0.014, 8, 160]} />
        <meshBasicMaterial color="#e8965c" transparent opacity={0.42} />
      </mesh>
      <mesh rotation={[Math.PI / 2.65, 0, 0]} scale={[1, 0.64, 1]}>
        <torusGeometry args={[3.05, 0.009, 8, 160]} />
        <meshBasicMaterial color="#ddb183" transparent opacity={0.24} />
      </mesh>
      {SIGNALS.map((signal) => (
        <SignalNode key={signal.phase} {...signal} reduced={reduced} />
      ))}
    </group>
  );
}

function Particles({ count = 280, reduced }: { count?: number; reduced: boolean }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 2.7 + Math.random() * 3.1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      values[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      values[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      values[i * 3 + 2] = radius * Math.cos(phi);
    }
    return values;
  }, [count]);

  const phases = useMemo(() => {
    const values = new Float32Array(count);
    for (let i = 0; i < count; i++) values[i] = Math.random() * Math.PI * 2;
    return values;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: TEAL },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (material.current) material.current.uniforms.uTime.value = reduced ? 0.6 : state.clock.elapsedTime;
    if (!points.current || reduced) return;
    points.current.rotation.y += delta * 0.016;
    points.current.rotation.x += Math.sin(state.clock.elapsedTime * 0.1) * delta * 0.008;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={PARTICLE_VERT}
        fragmentShader={PARTICLE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Scene() {
  const reduced = useReducedMotion();
  const viewport = useThree((state) => state.viewport);
  const wide = viewport.width >= 7.2;

  return (
    <group position={[wide ? 1.42 : 0.08, 0, 0]} scale={wide ? 1 : 0.76}>
      <KidneyCore reduced={reduced} />
      <OrbitSystem reduced={reduced} />
      <Particles reduced={reduced} />
    </group>
  );
}

export default function KidneyScene({ className = "absolute inset-0" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = wrap.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrap} className={className} aria-hidden="true">
      <Canvas
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 0, 5.8], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        style={{ touchAction: "none" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
