"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import * as THREE from "three";
import type { DieRoll, RollResult } from "../dice-engine";

/** A roll to show: id changes for every new roll. */
export interface TrayRoll {
  id: string;
  label: string;
  author: string;
  color: string;
  result: RollResult;
}

const SHOW_MS = 3400;
const CRIT_SHOW_MS = 4200;
const SETTLE_S = 1.15;
const MAX_DICE = 10;
const GOLD = new THREE.Color("#fbbf24");
const RED = new THREE.Color("#ef4444");

/** Stable 0..1 pseudo-random number per (seed, k): each die tumbles its own way, the same on every screen. */
function hashRandom(seed: string, k: number): number {
  let h = 2166136261 ^ k;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

/** d10 / d100: pentagonal bipyramid; d2/d3 and odd sizes: a short cylinder. */
function geometryFor(sides: number): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(0.62);
    case 6:
      return new THREE.BoxGeometry(0.72, 0.72, 0.72);
    case 8:
      return new THREE.OctahedronGeometry(0.6);
    case 10:
    case 100:
      return new THREE.LatheGeometry([new THREE.Vector2(0, 0.62), new THREE.Vector2(0.55, 0), new THREE.Vector2(0, -0.62)], 5);
    case 12:
      return new THREE.DodecahedronGeometry(0.58);
    case 20:
      return new THREE.IcosahedronGeometry(0.62);
    default:
      return new THREE.CylinderGeometry(0.5, 0.5, 0.25, 16);
  }
}

type Glow = "crit" | "fumble" | null;

/** A natural 20 or 1 on a single d20 (not a 1 on a d6). */
function glowOf(result: RollResult): Glow {
  if (!result.dice.some((d) => d.kept && d.sides === 20)) return null;
  return result.natural === 20 ? "crit" : result.natural === 1 ? "fumble" : null;
}

/** Sparks bursting out of a critical die. */
function Sparks({ color, seed }: { color: THREE.Color; seed: string }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const sparks = useMemo(
    () =>
      Array.from({ length: 22 }, (_, k) => {
        const a = hashRandom(seed, 100 + k) * Math.PI * 2;
        const up = 0.6 + hashRandom(seed, 200 + k) * 1.4;
        const speed = 1.6 + hashRandom(seed, 300 + k) * 2.2;
        return new THREE.Vector3(Math.cos(a) * speed, up * speed * 0.8, Math.sin(a) * speed * 0.6);
      }),
    [seed],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - t0.current;
    g.children.forEach((child, i) => {
      const v = sparks[i];
      child.position.set(v.x * t, v.y * t - 2.4 * t * t, v.z * t);
      child.rotation.set(t * 8, t * 6, 0);
      const s = Math.max(0, 1 - t / 1.1);
      child.scale.setScalar(s);
    });
  });
  return (
    <group ref={group}>
      {sparks.map((_, i) => (
        <mesh key={i}>
          <octahedronGeometry args={[0.07]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Die({ die, index, count, color, animate: tumble, seed, glow }: { die: DieRoll; index: number; count: number; color: string; animate: boolean; seed: string; glow: Glow }) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const geometry = useMemo(() => geometryFor(die.sides), [die.sides]);
  const [settled, setSettled] = useState(!tumble);
  // Where it rests and how it flies in (fixed per die and roll, so every screen sees the same throw).
  const plan = useMemo(() => {
    const spacing = Math.min(1.5, 9 / Math.max(count, 1));
    const restX = (index - (count - 1) / 2) * spacing;
    const r = (k: number) => hashRandom(`${seed}:${index}`, k);
    const fromLeft = hashRandom(seed, 7) < 0.5;
    const spin = new THREE.Vector3(10 + r(1) * 8, 7 + r(2) * 8, 5 + r(3) * 6);
    const rest = new THREE.Euler(r(4) * Math.PI, r(5) * Math.PI, r(6) * Math.PI);
    return { restX, restZ: (r(8) - 0.5) * 0.9, startX: restX + (fromLeft ? -7 : 7), startZ: (r(9) - 0.5) * 3, spin, rest, delay: index * 0.06, bounces: 2.6 + r(10) * 0.8 };
  }, [index, count, seed]);
  const t0 = useRef<number | null>(null);
  const glowColor = glow === "crit" ? GOLD : glow === "fumble" ? RED : null;
  const special = !!glowColor && die.kept && die.sides === 20;

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const elapsed = Math.max(0, state.clock.elapsedTime - t0.current - plan.delay);
    const k = tumble ? Math.min(1, elapsed / SETTLE_S) : 1;
    const ease = 1 - (1 - k) ** 3;
    // Thrown in from one side, bouncing a few times lower each time, then sliding to rest.
    mesh.position.x = THREE.MathUtils.lerp(plan.startX, plan.restX, ease);
    mesh.position.z = THREE.MathUtils.lerp(plan.startZ, plan.restZ, ease);
    mesh.position.y = 0.6 + Math.abs(Math.sin(k * Math.PI * plan.bounces)) * (1 - k) ** 1.6 * 2.4;
    const left = (1 - ease) ** 1.4;
    mesh.rotation.set(plan.rest.x + plan.spin.x * left, plan.rest.y + plan.spin.y * left, plan.rest.z + plan.spin.z * left);
    // A short wobble as it settles.
    const after = elapsed - SETTLE_S;
    if (tumble && after > 0 && after < 0.45) mesh.rotation.z += Math.sin(after * 38) * 0.06 * (1 - after / 0.45);
    if (k >= 1 && !settled) setSettled(true);
    // A critical die keeps glowing.
    if (material.current && special && k >= 1) {
      material.current.emissiveIntensity = 0.9 + Math.sin(state.clock.elapsedTime * 6) * 0.45;
      mesh.scale.setScalar(1 + Math.max(0, 0.25 - after) * 0.8);
    }
  });

  return (
    <mesh ref={ref} geometry={geometry} castShadow position={[plan.startX, 0.6, plan.startZ]}>
      <meshStandardMaterial
        ref={material}
        color={die.kept ? color : "#4b4658"}
        emissive={special ? glowColor! : "#000000"}
        emissiveIntensity={special ? 1 : 0}
        flatShading
        roughness={0.3}
        metalness={0.15}
        transparent={!die.kept}
        opacity={die.kept ? 1 : 0.5}
      />
      <Edges color={die.kept ? (special ? glowColor!.getStyle() : "#f5ecff") : "#8a8494"} threshold={15} />
      {settled && special && <Sparks color={glowColor!} seed={seed} />}
      {settled && (
        <Html center position={[0, 0.95, 0]} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
          <motion.span
            initial={{ scale: 0.2, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 16 }}
            className={
              die.kept
                ? special
                  ? `block font-mono text-2xl font-black [text-shadow:0_2px_10px_rgb(0_0_0/0.9)] ${glow === "crit" ? "text-amber-300" : "text-red-400"}`
                  : "block font-mono text-lg font-bold text-white [text-shadow:0_2px_6px_rgb(0_0_0/0.9)]"
                : "block font-mono text-sm text-fg-subtle line-through"
            }
          >
            {die.value}
          </motion.span>
        </Html>
      )}
    </mesh>
  );
}

/** The total counts up to its value as the dice settle. */
function CountUp({ value, delay }: { value: number; delay: number }) {
  const n = useMotionValue(0);
  const shown = useTransform(n, (v) => (Number.isInteger(value) ? String(Math.round(v)) : v.toFixed(1)));
  useEffect(() => {
    const controls = animate(n, value, { duration: 0.55, delay, ease: "easeOut" });
    return () => controls.stop();
  }, [n, value, delay]);
  return <motion.span>{shown}</motion.span>;
}

/**
 * Dice thrown over the table after each roll, then the total. Purely visual:
 * the result was decided by the dice engine (by the host, at a shared table),
 * and the throw comes from the roll id, so everyone sees the same tumble.
 */
export function DiceTray({ roll, reduceMotion = false }: { roll: TrayRoll | null; reduceMotion?: boolean }) {
  const [shown, setShown] = useState<TrayRoll | null>(null);
  // The last roll already handled: the one in the log when the table opens is never shown,
  // and a roll is shown once even though new chat messages rebuild the same roll object.
  const last = useRef(roll?.id ?? null);

  useEffect(() => {
    if (!roll || roll.id === last.current) return;
    last.current = roll.id;
    const special = glowOf(roll.result) !== null;
    const show = setTimeout(() => setShown(roll), 0);
    const hide = setTimeout(() => setShown((s) => (s?.id === roll.id ? null : s)), special ? CRIT_SHOW_MS : SHOW_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [roll]);

  const dice = shown?.result.dice.slice(0, MAX_DICE) ?? [];
  const glow: Glow = shown ? glowOf(shown.result) : null;
  const settleDelay = reduceMotion ? 0 : SETTLE_S + dice.length * 0.06;

  return (
    <AnimatePresence>
      {shown && dice.length > 0 && (
        <motion.div
          key={shown.id}
          initial={{ opacity: 0, y: 16 }}
          animate={glow === "fumble" && !reduceMotion ? { opacity: 1, y: 0, x: [0, 0, -8, 8, -6, 6, -3, 0] } : { opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10, transition: { duration: 0.25 } }}
          transition={glow === "fumble" ? { x: { delay: settleDelay, duration: 0.5 }, default: { duration: 0.3 } } : { duration: 0.3 }}
          className="pointer-events-none absolute inset-x-0 bottom-12 z-10 mx-auto flex w-[min(94%,560px)] flex-col items-center"
          aria-live="polite"
        >
          {/* A soft spotlight on the tray. */}
          <div className="absolute inset-x-8 bottom-6 top-6 rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.45),transparent)]" />
          <div className="relative h-44 w-full">
            <Canvas shadows camera={{ position: [0, 6.5, 5.2], fov: 40 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
              <ambientLight intensity={0.65} />
              <directionalLight position={[3, 8, 4]} intensity={2.4} castShadow shadow-mapSize={[1024, 1024]} />
              <pointLight position={[-3, 3, 2]} intensity={6} color={shown.color} distance={10} />
              <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[24, 12]} />
                <shadowMaterial opacity={0.4} />
              </mesh>
              {dice.map((d, i) => (
                <Die key={`${shown.id}-${i}`} die={d} index={i} count={dice.length} color={shown.color} animate={!reduceMotion} seed={shown.id} glow={glow} />
              ))}
            </Canvas>
          </div>

          <AnimatePresence>
            {glow && (
              <motion.span
                initial={{ opacity: 0, scale: 2.2, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: -4 }}
                transition={{ delay: settleDelay, type: "spring", stiffness: 300, damping: 14 }}
                className={
                  glow === "crit"
                    ? "relative -mt-3 mb-1 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-3 py-0.5 font-display text-lg font-black uppercase tracking-widest text-amber-950 shadow-[0_0_24px_rgb(251_191_36/0.7)]"
                    : "relative -mt-3 mb-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-500 px-3 py-0.5 font-display text-lg font-black uppercase tracking-widest text-white shadow-[0_0_24px_rgb(239_68_68/0.6)]"
                }
              >
                {glow === "crit" ? "Crítico!" : "Falha crítica"}
              </motion.span>
            )}
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : SETTLE_S * 0.7 }}
            className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-canvas/85 px-3 py-1.5 text-sm shadow-xl backdrop-blur"
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: shown.color }} />
            <span className="min-w-0 truncate text-fg-muted">
              <span className="font-medium text-fg">{shown.author}</span> · {shown.label}
            </span>
            <span className={`font-mono text-xl font-bold tabular-nums ${glow === "crit" ? "text-amber-300" : glow === "fumble" ? "text-red-400" : "text-accent"}`}>
              = <CountUp value={shown.result.total} delay={reduceMotion ? 0 : SETTLE_S * 0.8} />
            </span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
