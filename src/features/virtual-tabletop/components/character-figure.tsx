"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AnimationRole, CharacterModel } from "../model/character-models";
import type { TokenCue } from "../store/room.store";

/**
 * Animated 3D figure for a token. Base state (idle / walk / death) is picked
 * every frame from refs, so movement never re-renders React; one-shot cues
 * (attack, cast, hit) play over it and fade back.
 */
export function CharacterFigure({
  model,
  movingRef,
  down,
  cue,
}: {
  model: CharacterModel;
  movingRef: RefObject<boolean>;
  down: boolean;
  cue: TokenCue | undefined;
}) {
  const { scene, animations } = useGLTF(model.file);
  const root = useRef<THREE.Group>(null);

  const { object, scale, offset } = useMemo(() => {
    const object = cloneSkinned(scene) as THREE.Group;
    const hidden = new Set(model.hide);
    const tint = model.tint ? new THREE.Color(model.tint) : null;
    object.traverse((o) => {
      if (hidden.has(o.name)) o.visible = false;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // skinned bounds don't follow animation
      if (tint) {
        const tinted = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
          const c = m.clone() as THREE.MeshStandardMaterial;
          c.color?.multiply(tint);
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0];
      }
    });
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = Math.min(model.height / Math.max(size.y, 1e-3), (model.maxWidth ?? Infinity) / Math.max(size.x, size.z, 1e-3));
    return { object, scale, offset: new THREE.Vector3(-center.x * scale, -bounds.min.y * scale + (model.hover ?? 0), -center.z * scale) };
  }, [scene, model]);

  const { actions, mixer } = useAnimations(animations, root);
  const current = useRef<{ role: AnimationRole | null; action: THREE.AnimationAction | null }>({ role: null, action: null });
  const oneShot = useRef(false);

  const actionFor = (role: AnimationRole) => {
    const name = model.animations[role];
    return name ? (actions[name] ?? null) : null;
  };

  function play(role: AnimationRole, once: boolean) {
    const next = actionFor(role);
    if (!next) return false;
    const prev = current.current.action;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.18).play();
    if (prev && prev !== next) prev.fadeOut(0.18);
    current.current = { role, action: next };
    return true;
  }

  // One-shot cues from the table (attack roll, heal, damage taken).
  useEffect(() => {
    if (!cue || down) return;
    const role: AnimationRole = cue.kind === "attack" ? "attack" : cue.kind === "cast" ? "cast" : "hit";
    if (!play(role, true)) return;
    oneShot.current = true;
    const onFinished = () => {
      oneShot.current = false;
      current.current.role = null; // let the frame loop pick the base state again
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to each new cue only
  }, [cue?.id]);

  useFrame(() => {
    if (oneShot.current && !down) return;
    const base: AnimationRole = down ? "death" : movingRef.current ? "walk" : "idle";
    if (current.current.role !== base) {
      oneShot.current = false;
      // Models without this clip (e.g. the wolf) just keep their pose.
      if (!play(base, base === "death")) current.current.role = base;
    }
  });

  return (
    <group ref={root} scale={scale} position={offset}>
      <primitive object={object} />
    </group>
  );
}

export function preloadCharacterModel(file: string) {
  useGLTF.preload(file);
}
