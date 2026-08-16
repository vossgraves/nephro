"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { getPerfConfig, PARTICLE_CAP, type PerfConfig } from "@/components/hero/perf-tier";

const POSTER_SRC = "/media/nephro-kidney-tablet-desktop-poster.png";

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
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fresnel = pow(1.0 - clamp(dot(viewDir, normalize(vNormal)), 0.0, 1.0), 2.5);
    vec3 base = mix(uColorA, uColorB, clamp(vDisp * 1.6, 0.0, 1.0));
    vec3 col = base + uRim * fresnel * (0.52 + uPulse * sin(uTime * 1.5));
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

const RIPPLE_RADIUS = 1.5;
const RIPPLE_STRENGTH = 3.0;
const RIPPLE_SPRING = 12;
const RIPPLE_DAMPING = 2.5;

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

/**
 * three r163+ is WebGL2-only, so the probe requires a WebGL2 context. Any
 * failure (GPU blocklist, disabled hardware acceleration, headless embed)
 * routes to the poster fallback instead of a blank canvas.
 */
function supportsWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof WebGL2RenderingContext === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/**
 * Catches any render-time error from the R3F tree (shader compile, context
 * creation, driver fallout) so the page can never be blanked by the scene.
 */
class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state: { failed: boolean } = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PosterFrame() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static emergency fallback rendered only when WebGL is unavailable; next/image optimization is irrelevant here
    <img
      src={POSTER_SRC}
      alt=""
      className="h-full w-full object-cover object-[62%_center] md:object-center"
      loading="eager"
      decoding="async"
    />
  );
}

function KidneyCore({ reduced, animateFresnel }: { reduced: boolean; animateFresnel: boolean }) {
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
      uPulse: { value: 0 },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (material.current) {
      material.current.uniforms.uTime.value = reduced ? 0.6 : state.clock.elapsedTime;
      material.current.uniforms.uPulse.value = animateFresnel && !reduced ? 0.22 : 0;
    }
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
  const geometry = useRef<THREE.BufferGeometry>(null);

  // Interaction state: the ripple is active while the pointer is pressed.
  const pointer = useRef({ down: false, world: new THREE.Vector3() });
  const scratch = useRef({ inv: new THREE.Matrix4(), local: new THREE.Vector3() });

  const effectiveCount = useMemo(
    () => Math.min(PARTICLE_CAP, Math.max(0, Math.round(count))),
    [count],
  );

  const arrays = useMemo(() => {
    const n = effectiveCount;
    const base = new Float32Array(n * 3);
    const live = new Float32Array(n * 3);
    const velocity = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const radius = 2.7 + Math.random() * 3.1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const i3 = i * 3;
      base[i3] = radius * Math.sin(phi) * Math.cos(theta);
      base[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      base[i3 + 2] = radius * Math.cos(phi);
      live[i3] = base[i3];
      live[i3 + 1] = base[i3 + 1];
      live[i3 + 2] = base[i3 + 2];
    }
    return { base, live, velocity };
  }, [effectiveCount]);

  const phases = useMemo(() => {
    const values = new Float32Array(effectiveCount);
    for (let i = 0; i < effectiveCount; i++) values[i] = Math.random() * Math.PI * 2;
    return values;
  }, [effectiveCount]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: TEAL },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (material.current) {
      material.current.uniforms.uTime.value = reduced ? 0.6 : state.clock.elapsedTime;
    }
    const pts = points.current;
    const geom = geometry.current;
    if (!pts || !geom || reduced) return;

    pts.rotation.y += delta * 0.016;
    pts.rotation.x += Math.sin(state.clock.elapsedTime * 0.1) * delta * 0.008;
    // Keep matrixWorld current so the pointer position maps into local space.
    pts.updateMatrixWorld();

    const { base, live, velocity } = arrays;
    const damp = Math.exp(-RIPPLE_DAMPING * delta);
    const spring = RIPPLE_SPRING * delta;

    if (pointer.current.down) {
      const { inv, local } = scratch.current;
      inv.copy(pts.matrixWorld).invert();
      local.copy(pointer.current.world).applyMatrix4(inv);
      const px = local.x;
      const py = local.y;
      const pz = local.z;
      for (let i = 0; i < effectiveCount; i++) {
        const i3 = i * 3;
        const dx = live[i3] - px;
        const dy = live[i3 + 1] - py;
        const dz = live[i3 + 2] - pz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist >= RIPPLE_RADIUS || dist === 0) continue;
        const falloff = 1 - dist / RIPPLE_RADIUS;
        const push = RIPPLE_STRENGTH * falloff * falloff * delta;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        velocity[i3] += nx * push;
        velocity[i3 + 1] += ny * push;
        velocity[i3 + 2] += nz * push;
      }
    }

    // Damped spring-back toward the resting positions for every particle.
    for (let i = 0; i < effectiveCount; i++) {
      const i3 = i * 3;
      for (let c = 0; c < 3; c++) {
        const k = i3 + c;
        velocity[k] += (base[k] - live[k]) * spring;
        velocity[k] *= damp;
        live[k] += velocity[k] * delta;
      }
    }

    geom.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[arrays.live, 3]} />
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
      {/* Invisible capture surface so the pointer-repel ripple works anywhere
          over the hero canvas, including drags across empty space. */}
      <mesh
        onPointerDown={(event) => {
          pointer.current.down = true;
          pointer.current.world.copy(event.point);
        }}
        onPointerMove={(event) => {
          if (pointer.current.down) pointer.current.world.copy(event.point);
        }}
        onPointerUp={() => {
          pointer.current.down = false;
        }}
        onPointerLeave={() => {
          pointer.current.down = false;
        }}
      >
        <sphereGeometry args={[5.4, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </points>
  );
}

function Scene({ config }: { config: PerfConfig }) {
  const reduced = useReducedMotion();
  const viewport = useThree((state) => state.viewport);
  const wide = viewport.width >= 7.2;

  return (
    <group position={[wide ? 1.42 : 0.08, 0, 0]} scale={wide ? 1 : 0.76}>
      <KidneyCore reduced={reduced} animateFresnel={config.animateFresnel} />
      <OrbitSystem reduced={reduced} />
      <Particles count={config.particles} reduced={reduced} />
    </group>
  );
}

export default function KidneyScene({ className = "absolute inset-0" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [webgl] = useState<boolean>(() => supportsWebGL());
  const [contextLost, setContextLost] = useState(false);
  const config = useMemo(() => getPerfConfig(), []);

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
      {webgl && !contextLost ? (
        <SceneErrorBoundary fallback={<PosterFrame />}>
          <Canvas
            frameloop={visible ? "always" : "never"}
            camera={{ position: [0, 0, 5.8], fov: 45 }}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            dpr={[1, config.maxDpr]}
            style={{ touchAction: "none" }}
            onCreated={({ gl }) => {
              const onLost = () => setContextLost(true);
              gl.domElement.addEventListener("webglcontextlost", onLost);
            }}
          >
            <Scene config={config} />
          </Canvas>
        </SceneErrorBoundary>
      ) : (
        <PosterFrame />
      )}
    </div>
  );
}
