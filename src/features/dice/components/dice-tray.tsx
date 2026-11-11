"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import * as THREE from "three";
import { playSfx } from "@/features/audio-engine/sfx";
import { usePreferencesStore } from "@/stores/preferences.store";
import type { DieRoll, RollResult } from "../dice-engine";
import { dieGeometry, faceLabels, facesOf, NUMBERED_SIDES, restQuaternion, throwPath, type DieFace, type ThrowPath } from "../dice-faces";

/** A roll to show: id changes for every new roll. */
export interface TrayRoll {
  id: string;
  label: string;
  author: string;
  color: string;
  result: RollResult;
}

const MAX_DICE = 10;
const GOLD = new THREE.Color("#fbbf24");
const RED = new THREE.Color("#ef4444");
/** The camera over the table (the throw is framed from here on every screen). */
const CAMERA = new THREE.Vector3(0, 10.5, 7.2);
const LOOK = new THREE.Vector3(0, 0, 0.5);
const SCREEN_UP = new THREE.Vector3().subVectors(LOOK, CAMERA).normalize().cross(new THREE.Vector3(1, 0, 0)).negate().normalize();
/** A lone d20 slows down at the end of its throw: everyone holds their breath. */
const SUSPENSE_RATE = 0.4;
/** Seconds the overlay takes to fade away. */
const LEAVE_S = 0.35;

/** Stable 0..1 pseudo-random number per (seed, k): each die tumbles its own way, the same on every screen. */
function hashRandom(seed: string, k: number): number {
  let h = 2166136261 ^ k;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

type Glow = "crit" | "fumble" | null;

/** A natural 20 or 1 on a single d20 (not a 1 on a d6). */
function glowOf(result: RollResult): Glow {
  if (!result.dice.some((d) => d.kept && d.sides === 20)) return null;
  return result.natural === 20 ? "crit" : result.natural === 1 ? "fumble" : null;
}

/* ---------- The throw, planned up front (pure: same roll id, same throw everywhere) ---------- */

interface DiePlan {
  die: DieRoll;
  start: THREE.Vector3;
  rest: THREE.Vector3;
  /** Released this long after the first die. */
  delay: number;
  path: ThrowPath;
  axis: THREE.Vector3;
  turns: number;
  restQ: THREE.Quaternion;
  faces: DieFace[];
  labels: string[];
  resultFace: number;
  radius: number;
}

interface ThrowPlan {
  dice: DiePlan[];
  /** Animation time (s) when the last die stops. */
  landAt: number;
  /** Real time (s) when the last die stops (later than `landAt` with suspense). */
  settleAt: number;
  suspense: boolean;
  /** Animation time when the slow motion starts. */
  slowFrom: number;
  impacts: { t: number; x: number; z: number; die: number }[];
}

function planThrow(roll: TrayRoll, dice: DieRoll[]): ThrowPlan {
  const seed = roll.id;
  const count = dice.length;
  const fromLeft = hashRandom(seed, 7) < 0.5;
  const spacing = Math.min(1.75, 11 / Math.max(count, 1));
  const plans = dice.map((die, index): DiePlan => {
    const r = (k: number) => hashRandom(`${seed}:${index}`, k);
    const geometry = dieGeometry(die.sides);
    const numbered = NUMBERED_SIDES.has(die.sides);
    const faces = numbered ? facesOf(geometry) : [];
    geometry.dispose();
    const { labels, resultFace } = numbered ? faceLabels(die.sides, faces.length, die.value) : { labels: [], resultFace: 0 };
    const rest = new THREE.Vector3((index - (count - 1) / 2) * spacing, 0, 0.3 + (r(8) - 0.5) * 0.9);
    const toViewer = new THREE.Vector3().subVectors(CAMERA, rest).normalize();
    const restQ = numbered ? restQuaternion(faces[resultFace], toViewer, SCREEN_UP, (r(11) - 0.5) * 0.5) : new THREE.Quaternion().setFromEuler(new THREE.Euler(r(4) * 6, r(5) * 6, r(6) * 6));
    return {
      die,
      // Each die leaves the hand from its own spot and a beat apart, so they do not pass through each other.
      start: new THREE.Vector3((fromLeft ? -1 : 1) * (9 + index * 0.7 + r(1) * 1.5), 0, rest.z - 1.5 + (index % 3) * 0.9 + (r(9) - 0.5) * 0.6),
      rest,
      delay: index * 0.09 + r(12) * 0.05,
      path: throwPath(2.4 + r(2) * 0.9, 0.38 + r(3) * 0.1),
      axis: new THREE.Vector3(r(13) - 0.5, r(14) - 0.5, r(15) - 0.5).normalize(),
      turns: (3 + r(10) * 2.5) * Math.PI * 2,
      restQ,
      faces,
      labels,
      resultFace,
      radius: die.sides === 6 ? 0.39 : die.sides === 4 ? 0.3 : 0.5,
    };
  });
  const landAt = Math.max(...plans.map((p) => p.delay + p.path.landAt));
  const suspense = count === 1 && dice[0].sides === 20;
  const slowFrom = landAt * 0.74;
  const settleAt = suspense ? slowFrom + (landAt - slowFrom) / SUSPENSE_RATE : landAt;
  const impacts = plans
    .flatMap((p, die) =>
      p.path.impacts.map((t) => {
        const at = p.delay + t;
        const pos = poseAt(p, at).position;
        return { t: at, x: pos.x, z: pos.z, die };
      }),
    )
    .sort((a, b) => a.t - b.t);
  return { dice: plans, landAt, settleAt, suspense, slowFrom, impacts };
}

/** Animation time for a real time: a lone d20 plays the end of its throw in slow motion. */
function animTime(plan: ThrowPlan, real: number): number {
  if (!plan.suspense || real <= plan.slowFrom) return real;
  if (real <= plan.settleAt) return plan.slowFrom + (real - plan.slowFrom) * SUSPENSE_RATE;
  return plan.landAt + (real - plan.settleAt);
}

const pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
const spin = new THREE.Quaternion();

/** Where a die is and how it is turned at animation time `t`. */
function poseAt(p: DiePlan, t: number) {
  const local = Math.max(0, t - p.delay);
  const k = Math.min(1, local / p.path.landAt);
  // Slides in fast and loses speed with every bounce.
  const slide = (1 - Math.exp(-3.4 * k)) / (1 - Math.exp(-3.4));
  pose.position.set(
    THREE.MathUtils.lerp(p.start.x, p.rest.x, slide),
    p.radius + p.path.heightAt(local),
    THREE.MathUtils.lerp(p.start.z, p.rest.z, slide),
  );
  // Spins down onto the face it rolled.
  spin.setFromAxisAngle(p.axis, p.turns * (1 - k) ** 1.8);
  pose.quaternion.copy(p.restQ).multiply(spin);
  return pose;
}

/* ---------- Numbers on the faces ---------- */

function labelTexture(text: string, result: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const size = text.length > 2 ? 52 : text.length > 1 ? 64 : 80;
  g.font = `900 ${size}px ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 10;
  g.strokeStyle = "rgba(10,6,20,0.75)";
  g.strokeText(text, 64, 66);
  g.fillStyle = result ? "#fff8e1" : "#f5ecff";
  g.fillText(text, 64, 66);
  // 6 and 9 read the same upside down: the classic underline.
  if (text === "6" || text === "9") g.fillRect(44, 104, 40, 7);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function FaceLabel({ face, text, result, glow, glowRef }: { face: DieFace; text: string; result: boolean; glow?: THREE.Color; glowRef?: React.RefObject<THREE.MeshStandardMaterial | null> }) {
  const texture = useMemo(() => labelTexture(text, result), [text, result]);
  useEffect(() => () => texture.dispose(), [texture]);
  const { position, quaternion } = useMemo(() => {
    const right = new THREE.Vector3().crossVectors(face.up, face.normal);
    return {
      position: face.center.clone().addScaledVector(face.normal, 0.004),
      quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, face.up, face.normal)),
    };
  }, [face]);
  return (
    <mesh position={position} quaternion={quaternion} raycast={() => null}>
      <planeGeometry args={[face.size, face.size]} />
      <meshStandardMaterial ref={glowRef} map={texture} emissiveMap={texture} emissive={glow ?? "#ffffff"} emissiveIntensity={0} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={0.4} />
    </mesh>
  );
}

/* ---------- Effects ---------- */

/** A dusty ring where a die hits the table. */
function ImpactRings({ plan, clock }: { plan: ThrowPlan; clock: React.RefObject<number> }) {
  const rings = plan.impacts.slice(0, 30);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const t = animTime(plan, clock.current);
    rings.forEach((ring, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const age = t - ring.t;
      const live = age >= 0 && age < 0.45;
      mesh.visible = live;
      if (!live) return;
      mesh.scale.setScalar(0.4 + age * 4.2);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - age / 0.45);
    });
  });
  return (
    <>
      {rings.map((ring, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} position={[ring.x, 0.02, ring.z]} rotation-x={-Math.PI / 2} visible={false} raycast={() => null}>
          <ringGeometry args={[0.35, 0.5, 32]} />
          <meshBasicMaterial color="#e9d5ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** Sparks bursting out of a critical die (or embers falling from a fumble). */
function Sparks({ color, seed, at, count, fall }: { color: THREE.Color; seed: string; at: THREE.Vector3; count: number; fall?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, k) => {
        const a = hashRandom(seed, 100 + k) * Math.PI * 2;
        const up = 0.5 + hashRandom(seed, 200 + k) * 1.6;
        const speed = (fall ? 1 : 2.2) + hashRandom(seed, 300 + k) * (fall ? 1.5 : 3);
        return new THREE.Vector3(Math.cos(a) * speed, up * speed * (fall ? 0.5 : 0.9), Math.sin(a) * speed * 0.7);
      }),
    [seed, count, fall],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0.current;
    g.children.forEach((child, i) => {
      const v = sparks[i];
      child.position.set(v.x * t, v.y * t - (fall ? 1.2 : 3) * t * t, v.z * t);
      child.rotation.set(t * 9, t * 7, 0);
      child.scale.setScalar(Math.max(0, 1 - t / (fall ? 1.6 : 1.3)));
    });
  });
  return (
    <group ref={group} position={at}>
      {sparks.map((_, i) => (
        <mesh key={i} raycast={() => null}>
          <octahedronGeometry args={[i % 3 === 0 ? 0.1 : 0.06]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** The natural 20: a column of light, a shockwave across the table and a flash of light. */
function CritBurst({ at, seed }: { at: THREE.Vector3; seed: string }) {
  const pillar = useRef<THREE.Mesh>(null);
  const wave = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const t0 = useRef<number | null>(null);
  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0.current;
    if (pillar.current) {
      const m = pillar.current.material as THREE.MeshBasicMaterial;
      m.opacity = Math.min(1, t * 6) * Math.max(0, 1 - t / 2.2) * 0.32;
      pillar.current.scale.set(0.5 + t * 0.7, 1, 0.5 + t * 0.7);
    }
    if (wave.current) {
      wave.current.scale.setScalar(0.5 + t * 9);
      (wave.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 - t * 0.9);
    }
    if (light.current) light.current.intensity = 26 * Math.max(0, 1 - t / 1.4) + 5;
  });
  return (
    <group position={[at.x, 0, at.z]}>
      <mesh ref={pillar} position-y={4.6} raycast={() => null}>
        <cylinderGeometry args={[0.55, 1.1, 7, 32, 1, true]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={wave} position-y={0.03} rotation-x={-Math.PI / 2} raycast={() => null}>
        <ringGeometry args={[0.5, 0.62, 64]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 3, 0.6]} color={GOLD} intensity={0} distance={14} />
      <Sparks color={GOLD} seed={seed} at={new THREE.Vector3(0, 0.8, 0)} count={56} />
    </group>
  );
}

/** The natural 1: red smoke rising from the die, a dull red wave, embers dropping. */
function FumbleBurst({ at, seed }: { at: THREE.Vector3; seed: string }) {
  const smoke = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const t0 = useRef<number | null>(null);
  // Puffs start around the die (never over it, so its 1 stays in sight) and drift out and up.
  const puffs = useMemo(
    () =>
      Array.from({ length: 14 }, (_, k) => {
        const a = hashRandom(seed, 500 + k) * Math.PI * 2;
        const r = 0.9 + hashRandom(seed, 700 + k) * 0.5;
        return new THREE.Vector3(Math.cos(a) * r, hashRandom(seed, 600 + k), Math.sin(a) * r * 0.7 - 0.25);
      }),
    [seed],
  );
  useFrame((state) => {
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0.current;
    smoke.current?.children.forEach((child, i) => {
      const p = puffs[i];
      const age = Math.max(0, t - p.y * 0.4);
      child.position.set(p.x * (1 + age * 0.6), 0.2 + age * (1.4 + p.y), p.z * (1 + age * 0.6));
      child.scale.setScalar(0.2 + age * 0.7);
      ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.42 - age * 0.26);
    });
    if (wave.current) {
      wave.current.scale.setScalar(0.5 + t * 4);
      (wave.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - t * 0.8);
    }
  });
  return (
    <group position={[at.x, 0, at.z]}>
      <group ref={smoke}>
        {puffs.map((_, i) => (
          <mesh key={i} raycast={() => null}>
            <sphereGeometry args={[0.5, 10, 8]} />
            <meshBasicMaterial color={i % 2 ? "#7f1d1d" : "#450a0a"} transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={wave} position-y={0.03} rotation-x={-Math.PI / 2} raycast={() => null}>
        <ringGeometry args={[0.5, 0.7, 48]} />
        <meshBasicMaterial color={RED} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <Sparks color={RED} seed={seed} at={new THREE.Vector3(0, 0.8, 0)} count={20} fall />
    </group>
  );
}

/* ---------- A die ---------- */

function Die({ plan, throwPlan, color, clock, glow }: { plan: DiePlan; throwPlan: ThrowPlan; color: string; clock: React.RefObject<number>; glow: Glow }) {
  const ref = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshPhysicalMaterial>(null);
  const resultGlow = useRef<THREE.MeshStandardMaterial>(null);
  const geometry = useMemo(() => dieGeometry(plan.die.sides), [plan.die.sides]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const [settled, setSettled] = useState(false);
  const kept = plan.die.kept;
  const special = !!glow && kept && plan.die.sides === 20;
  const glowColor = glow === "crit" ? GOLD : RED;
  const numbered = plan.faces.length > 0;

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = animTime(throwPlan, clock.current);
    const { position, quaternion } = poseAt(plan, t);
    g.position.copy(position);
    g.quaternion.copy(quaternion);
    const landed = t >= plan.delay + plan.path.landAt;
    // The lone d20 teeters on an edge before it decides.
    if (throwPlan.suspense && !landed) {
      const k = (t - plan.delay) / plan.path.landAt;
      if (k > 0.82) g.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.sin(k * 90) * 0.12 * (1 - k) * 5);
    }
    if (landed && !settled) setSettled(true);
    const after = t - (plan.delay + plan.path.landAt);
    // The rolled number lights up once the die stops; a natural 20 or 1 pulses.
    if (resultGlow.current && landed && kept) resultGlow.current.emissiveIntensity = special ? 1.4 + Math.sin(state.clock.elapsedTime * 7) * 0.6 : Math.max(0.35, 1.2 - after * 1.5);
    // A soft inner glow: the die keeps its colour and its number stays readable.
    if (body.current && special && landed) body.current.emissiveIntensity = 0.16 + Math.sin(state.clock.elapsedTime * 6) * 0.08;
    // Pops a little when it lands.
    g.scale.setScalar(landed ? 1 + Math.max(0, 0.18 - after) * (special ? 2.2 : 1) : 1);
  });

  return (
    <group ref={ref} position={plan.start}>
      <mesh geometry={geometry} castShadow raycast={() => null}>
        <meshPhysicalMaterial
          ref={body}
          color={kept ? color : "#4b4658"}
          emissive={special ? glowColor : "#000000"}
          emissiveIntensity={0}
          flatShading
          roughness={0.32}
          metalness={0.08}
          clearcoat={1}
          clearcoatRoughness={0.12}
          transparent={!kept}
          opacity={kept ? 1 : 0.45}
        />
        <Edges color={kept ? (special ? glowColor.getStyle() : "#f5ecff") : "#8a8494"} threshold={15} />
      </mesh>
      {numbered &&
        plan.faces.map((face, i) => (
          <FaceLabel key={i} face={face} text={plan.labels[i]} result={i === plan.resultFace} glow={i === plan.resultFace && special ? glowColor : undefined} glowRef={i === plan.resultFace ? resultGlow : undefined} />
        ))}
      {!numbered && settled && (
        <Html center position={[0, 0.9, 0]} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
          <motion.span
            initial={{ scale: 0.2, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 16 }}
            className={kept ? "block font-mono text-lg font-bold text-white [text-shadow:0_2px_6px_rgb(0_0_0/0.9)]" : "block font-mono text-sm text-fg-subtle line-through"}
          >
            {plan.die.value}
          </motion.span>
        </Html>
      )}
    </group>
  );
}

/* ---------- The stage ---------- */

function Stage({ roll, plan, glow, reduceMotion, sound }: { roll: TrayRoll; plan: ThrowPlan; glow: Glow; reduceMotion: boolean; sound: boolean }) {
  const { camera, size } = useThree();
  const clock = useRef(reduceMotion ? plan.settleAt + 10 : 0);
  const started = useRef<number | null>(null);
  const played = useRef(0);
  const [settled, setSettled] = useState(reduceMotion);
  // Narrow screens see the table from a little further back, so the whole throw fits.
  const aspect = size.width / Math.max(size.height, 1);
  const back = Math.max(1, 1.45 / Math.max(aspect, 0.5));
  const special = plan.dice.find((d) => d.die.kept && d.die.sides === 20);

  useFrame((state) => {
    if (started.current === null) started.current = state.clock.elapsedTime;
    if (!reduceMotion) clock.current = state.clock.elapsedTime - started.current;
    const real = clock.current;
    const t = animTime(plan, real);
    // Clacks as the dice hit the table (a handful, not one per bounce of ten dice).
    while (played.current < plan.impacts.length && plan.impacts[played.current].t <= t) {
      if (sound && !reduceMotion && played.current < 9) playSfx("dice-hit");
      played.current += 1;
    }
    if (!settled && real >= plan.settleAt) {
      setSettled(true);
      if (sound && glow) playSfx(glow);
    }
    // Camera: a jolt on each impact, then it leans in on the result (closer still on a natural 20).
    const shake = new THREE.Vector3();
    if (!reduceMotion) {
      for (const hit of plan.impacts) {
        const age = t - hit.t;
        if (age < 0 || age > 0.22) continue;
        const a = 0.07 * (1 - age / 0.22);
        shake.x += Math.sin(hit.t * 911) * a;
        shake.y += Math.cos(hit.t * 577) * a;
      }
      const after = real - plan.settleAt;
      if (glow === "fumble" && after > 0 && after < 0.6) {
        const a = 0.22 * (1 - after / 0.6);
        shake.x += Math.sin(after * 70) * a;
        shake.y += Math.cos(after * 53) * a * 0.6;
      }
    }
    const lean = reduceMotion ? 1 : THREE.MathUtils.smoothstep(real, plan.settleAt - 0.2, plan.settleAt + 0.7);
    const focus = glow && special ? special.rest : LOOK;
    const target = new THREE.Vector3().lerpVectors(LOOK, focus, lean * 0.6);
    const distance = 1 - lean * (glow === "crit" ? 0.3 : glow === "fumble" ? 0.18 : 0.1);
    camera.position.copy(CAMERA).sub(LOOK).multiplyScalar(back * distance).add(target).add(shake);
    camera.lookAt(target);
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 10, 5]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <pointLight position={[-4, 4, 3]} intensity={10} color={roll.color} distance={14} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow raycast={() => null}>
        <planeGeometry args={[40, 24]} />
        <shadowMaterial opacity={0.42} />
      </mesh>
      {!reduceMotion && <ImpactRings plan={plan} clock={clock} />}
      {plan.dice.map((p, i) => (
        <Die key={`${roll.id}-${i}`} plan={p} throwPlan={plan} color={roll.color} clock={clock} glow={glow} />
      ))}
      {settled && !reduceMotion && special && glow === "crit" && <CritBurst at={special.rest} seed={roll.id} />}
      {settled && !reduceMotion && special && glow === "fumble" && <FumbleBurst at={special.rest} seed={roll.id} />}
    </>
  );
}

/** The total counts up to its value as the dice settle. */
function CountUp({ value, delay }: { value: number; delay: number }) {
  const n = useMotionValue(0);
  const shown = useTransform(n, (v) => (Number.isInteger(value) ? String(Math.round(v)) : v.toFixed(1)));
  useEffect(() => {
    const controls = animate(n, value, { duration: 0.6, delay, ease: "easeOut" });
    return () => controls.stop();
  }, [n, value, delay]);
  return <motion.span>{shown}</motion.span>;
}

/**
 * Dice thrown across the table after each roll: numbered faces, bounces with
 * dust and clacks, the rolled face turned to the camera, and a show for a
 * natural 20 or 1. Purely visual: the result was decided by the dice engine
 * (by the host, at a shared table), and the throw comes from the roll id, so
 * everyone sees the same tumble.
 */
export function DiceTray({ roll, reduceMotion = false }: { roll: TrayRoll | null; reduceMotion?: boolean }) {
  const [shown, setShown] = useState<TrayRoll | null>(null);
  const [leaving, setLeaving] = useState(false);
  // The last roll already handled: the one in the log when the table opens is never shown,
  // and a roll is shown once even though new chat messages rebuild the same roll object.
  const last = useRef(roll?.id ?? null);
  // Timers live outside the effect: a chat message rebuilding the roll object must not cancel the hide.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const soundOn = usePreferencesStore((s) => s.diceSounds && s.effectsVolume > 0);

  const plan = useMemo(() => (shown ? planThrow(shown, shown.result.dice.slice(0, MAX_DICE)) : null), [shown]);

  useEffect(() => {
    if (!roll || roll.id === last.current) return;
    last.current = roll.id;
    const glow = glowOf(roll.result);
    const settle = reduceMotion ? 0 : planThrow(roll, roll.result.dice.slice(0, MAX_DICE)).settleAt;
    const linger = glow === "crit" ? 3.4 : glow === "fumble" ? 3 : 2.3;
    timers.current.forEach(clearTimeout);
    // The overlay leaves on timers, never on an exit animation: in a background tab animations do not run,
    // and every overlay left behind would keep a WebGL context until the browser drops the map's.
    timers.current = [
      setTimeout(() => {
        setLeaving(false);
        setShown(roll);
      }, 0),
      setTimeout(() => setLeaving(true), (settle + linger) * 1000),
      setTimeout(() => setShown(null), (settle + linger + LEAVE_S) * 1000),
    ];
  }, [roll, reduceMotion]);

  const glow: Glow = shown ? glowOf(shown.result) : null;
  const settleDelay = reduceMotion || !plan ? 0 : plan.settleAt;

  return (
    <>
      {shown && plan && plan.dice.length > 0 && (
        <div
          key={shown.id}
          className={`pointer-events-none absolute inset-0 z-10 overflow-hidden transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
          aria-live="polite"
        >
          {/* The table dims a little under the throw. */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,transparent_30%,rgb(0_0_0/0.45))]" />
          <Canvas shadows camera={{ position: CAMERA.toArray(), fov: 38 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]} style={{ pointerEvents: "none" }}>
            <Stage roll={shown} plan={plan} glow={glow} reduceMotion={reduceMotion} sound={soundOn} />
          </Canvas>

          {/* Natural 20: a golden flash. Natural 1: the screen bleeds red at the edges. */}
          {glow && !reduceMotion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: glow === "crit" ? [0, 0.75, 0] : [0, 0.8, 0.45] }}
              transition={{ delay: settleDelay, duration: glow === "crit" ? 0.9 : 1.4, times: [0, 0.15, 1] }}
              className={
                glow === "crit"
                  ? "absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgb(253_230_138/0.9),rgb(251_191_36/0.35)_40%,transparent_75%)] mix-blend-screen"
                  : "absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,transparent_35%,rgb(127_29_29/0.85))]"
              }
            />
          )}

          <div className="absolute inset-x-0 bottom-14 flex flex-col items-center gap-2 px-4">
            <AnimatePresence>
              {glow && (
                <motion.span
                  initial={{ opacity: 0, scale: 3.4, rotate: -14, y: -40 }}
                  animate={glow === "crit" ? { opacity: 1, scale: 1, rotate: -4, y: 0 } : { opacity: 1, scale: 1, rotate: 3, y: [0, 0, 6, 0] }}
                  transition={{ delay: settleDelay + 0.05, type: "spring", stiffness: 420, damping: 13 }}
                  className={
                    glow === "crit"
                      ? "rounded-xl bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 px-5 py-1 font-display text-3xl font-black uppercase tracking-[0.2em] text-amber-950 shadow-[0_0_48px_rgb(251_191_36/0.9)] sm:text-4xl"
                      : "rounded-xl bg-gradient-to-r from-red-700 via-rose-600 to-red-800 px-5 py-1 font-display text-3xl font-black uppercase tracking-[0.15em] text-white shadow-[0_0_40px_rgb(239_68_68/0.75)] sm:text-4xl"
                  }
                >
                  {glow === "crit" ? "Crítico!" : "Falha crítica"}
                </motion.span>
              )}
            </AnimatePresence>

            <motion.p
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : Math.max(0, settleDelay - 0.25), type: "spring", stiffness: 300, damping: 20 }}
              className="flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-canvas/90 px-3 py-1.5 text-sm shadow-xl backdrop-blur"
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: shown.color }} />
              <span className="min-w-0 truncate text-fg-muted">
                <span className="font-medium text-fg">{shown.author}</span> · {shown.label}
              </span>
              <span className={`font-mono text-2xl font-black tabular-nums ${glow === "crit" ? "text-amber-300 [text-shadow:0_0_12px_rgb(251_191_36/0.8)]" : glow === "fumble" ? "text-red-400" : "text-accent"}`}>
                = <CountUp value={shown.result.total} delay={reduceMotion ? 0 : settleDelay} />
              </span>
            </motion.p>
          </div>
        </div>
      )}
    </>
  );
}
