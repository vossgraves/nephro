"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TEAL = new THREE.Color("#1d8aa5");
const GREEN = new THREE.Color("#3fbf8f");
const RIM = new THREE.Color("#bfe9f0");

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
    // elongate into a kidney-ish form
    vec3 pos = p;
    pos.x *= 1.25;
    pos.y += (fbm(vec3(pos.y * 2.0, 0.3, t)) - 0.5) * 0.35;
    pos += n * d * 0.55;
    return pos;
  }

  void main() {
    float t = uTime * 0.35;
    vec3 pos = displaced(position, normal, t);
    vDisp = fbm(position * 1.1 + vec3(t, t * 0.7, -t));

    // perturbed normal via finite differences along two tangent directions
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
    vec3 col = base + uRim * fresnel * (0.55 + 0.25 * sin(uTime * 1.5));
    float alpha = 0.82 + 0.18 * fresnel;
    gl_FragColor = vec4(col, alpha);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  uniform float uTime;
  attribute float aPhase;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (2.4 + sin(uTime * 2.0 + aPhase) * 1.4) * (6.0 / -mvPosition.z);
    vAlpha = 0.5 + 0.15 * sin(uTime * 2.0 + aPhase * 2.0);
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
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function KidneyBlob() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const reduced = useReducedMotion();
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
    if (mat.current) mat.current.uniforms.uTime.value = reduced ? 0.6 : state.clock.elapsedTime;
    if (mesh.current) {
      if (reduced) return;
      spin.current += delta * 0.18;
      const k = 1 - Math.exp(-4 * delta);
      follow.current.x += (state.pointer.x * 0.35 - follow.current.x) * k;
      follow.current.y += (state.pointer.y * 0.25 - follow.current.y) * k;
      mesh.current.rotation.y = spin.current + follow.current.x;
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.12 + follow.current.y;
      mesh.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.03;
      mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.18;
    }
  });

  return (
    <mesh ref={mesh} scale={2.1}>
      <sphereGeometry args={[1, 96, 96]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function Particles({ count = 900 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const reduced = useReducedMotion();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.6 + Math.random() * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  const phases = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = Math.random() * Math.PI * 2;
    return arr;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: TEAL },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (mat.current) mat.current.uniforms.uTime.value = reduced ? 0.6 : state.clock.elapsedTime;
    if (points.current && !reduced) {
      points.current.rotation.y += delta * 0.02;
      points.current.rotation.x += Math.sin(state.clock.elapsedTime * 0.1) * delta * 0.01;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
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

export default function KidneyScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <Canvas
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 0, 5.6], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        aria-hidden="true"
      >
        <KidneyBlob />
        <Particles />
      </Canvas>
    </div>
  );
}
