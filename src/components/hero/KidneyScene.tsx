"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
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

  void main() {
    float t = uTime * 0.35;
    float d = fbm(position * 1.1 + vec3(t, t * 0.7, -t));
    // elongate into a kidney-ish form
    vec3 pos = position;
    pos.x *= 1.25;
    pos.y += (fbm(vec3(pos.y * 2.0, 0.3, t)) - 0.5) * 0.35;
    pos += normal * d * 0.55;
    vDisp = d;
    vNormal = normalize(normalMatrix * normal);
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

function KidneyBlob() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);

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
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.18;
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.12;
      mesh.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.18;
      mesh.current.rotation.z += Math.sin(state.clock.elapsedTime * 0.3) * delta * 0.05;
      mesh.current.rotation.y += state.pointer.x * delta * 0.25;
      mesh.current.rotation.x += state.pointer.y * delta * 0.2;
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

  useFrame((state, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.02;
      points.current.rotation.x += Math.sin(state.clock.elapsedTime * 0.1) * delta * 0.01;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.016}
        color={TEAL}
        transparent
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

export default function KidneyScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.6], fov: 45 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <KidneyBlob />
      <Particles />
    </Canvas>
  );
}
