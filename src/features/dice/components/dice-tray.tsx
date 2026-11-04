"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
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

const SHOW_MS = 2800;
const SETTLE_S = 0.9;
const MAX_DICE = 10;

/** Stable 0..1 pseudo-random number per (seed, k): each die tumbles its own way, the same on every render. */
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

function Die({ die, index, count, color, animate, seed }: { die: DieRoll; index: number; count: number; color: string; animate: boolean; seed: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => geometryFor(die.sides), [die.sides]);
  const [settled, setSettled] = useState(!animate);
  // Where it rests and how it spins on the way (fixed per die so re-renders don't jump).
  const plan = useMemo(() => {
    const spacing = Math.min(1.5, 9 / Math.max(count, 1));
    const restX = (index - (count - 1) / 2) * spacing;
    const r = (k: number) => hashRandom(`${seed}:${index}`, k);
    const spin = new THREE.Vector3(8 + r(1) * 6, 6 + r(2) * 6, 4 + r(3) * 4);
    const rest = new THREE.Euler(r(4) * Math.PI, r(5) * Math.PI, r(6) * Math.PI);
    return { restX, spin, rest, delay: index * 0.05 };
  }, [index, count, seed]);
  const t0 = useRef<number | null>(null);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (t0.current === null) t0.current = state.clock.elapsedTime;
    const t = animate ? Math.max(0, state.clock.elapsedTime - t0.current - plan.delay) / SETTLE_S : 1;
    const k = Math.min(1, t);
    const ease = 1 - (1 - k) ** 3;
    // Thrown in from the left, bouncing twice before it rests.
    mesh.position.x = THREE.MathUtils.lerp(plan.restX - 6, plan.restX, ease);
    mesh.position.y = 0.6 + Math.abs(Math.sin(k * Math.PI * 2.5)) * (1 - k) * 1.6;
    const left = 1 - ease;
    mesh.rotation.set(plan.rest.x + plan.spin.x * left, plan.rest.y + plan.spin.y * left, plan.rest.z + plan.spin.z * left);
    if (k >= 1 && !settled) setSettled(true);
  });

  return (
    <mesh ref={ref} geometry={geometry} castShadow position={[plan.restX - 6, 0.6, 0]}>
      <meshStandardMaterial color={die.kept ? color : "#4b4658"} flatShading roughness={0.35} metalness={0.1} transparent={!die.kept} opacity={die.kept ? 1 : 0.55} />
      <Edges color={die.kept ? "#f5ecff" : "#8a8494"} threshold={15} />
      {settled && (
        <Html center position={[0, 0.95, 0]} zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
          <span className={die.kept ? "font-mono text-lg font-bold text-white [text-shadow:0_2px_6px_rgb(0_0_0/0.9)]" : "font-mono text-sm text-fg-subtle line-through"}>{die.value}</span>
        </Html>
      )}
    </mesh>
  );
}

/**
 * Dice tumbling over the table for a moment after each roll, then the total.
 * Purely visual: the result was already decided by the dice engine.
 */
export function DiceTray({ roll, reduceMotion = false }: { roll: TrayRoll | null; reduceMotion?: boolean }) {
  const [shown, setShown] = useState<TrayRoll | null>(null);
  // The last roll already handled: the one in the log when the table opens is never shown,
  // and a roll is shown once even though new chat messages rebuild the same roll object.
  const last = useRef(roll?.id ?? null);

  useEffect(() => {
    if (!roll || roll.id === last.current) return;
    last.current = roll.id;
    const show = setTimeout(() => setShown(roll), 0);
    const hide = setTimeout(() => setShown((s) => (s?.id === roll.id ? null : s)), SHOW_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [roll]);

  const dice = shown?.result.dice.slice(0, MAX_DICE) ?? [];

  return (
    <AnimatePresence>
      {shown && dice.length > 0 && (
        <motion.div
          key={shown.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none absolute inset-x-0 bottom-14 z-10 mx-auto flex w-[min(92%,460px)] flex-col items-center"
          aria-live="polite"
        >
          <div className="h-36 w-full">
            <Canvas shadows camera={{ position: [0, 6, 5], fov: 40 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[3, 8, 4]} intensity={2.2} castShadow />
              <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={[20, 10]} />
                <shadowMaterial opacity={0.35} />
              </mesh>
              {dice.map((d, i) => (
                <Die key={`${shown.id}-${i}`} die={d} index={i} count={dice.length} color={shown.color} animate={!reduceMotion} seed={shown.id} />
              ))}
            </Canvas>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : SETTLE_S + 0.1 }}
            className="rounded-lg bg-canvas/85 px-3 py-1 text-center text-sm shadow-lg backdrop-blur"
          >
            <span className="text-fg-muted">
              {shown.author} · {shown.label}
            </span>{" "}
            <span className="font-mono text-base font-bold text-accent">= {shown.result.total}</span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
