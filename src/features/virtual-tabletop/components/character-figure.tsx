"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { AnimationRole, BodyPart, CharacterModel } from "../model/character-models";
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

  const { object, scale, offset, collapsed } = useMemo(() => {
    const object = cloneSkinned(scene) as THREE.Group;
    const hidden = new Set(model.hide);
    const hiddenMaterials = new Set(model.hideMaterials);
    const tint = model.tint ? new THREE.Color(model.tint) : null;
    const restyle = !!(tint || model.recolor || model.glow || model.faceted);
    object.traverse((o) => {
      if (hidden.has(o.name)) o.visible = false;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // skinned bounds don't follow animation
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some((m) => hiddenMaterials.has(m.name))) mesh.visible = false;
      if (!restyle) return;
      // Clones share the GLB's materials: restyle copies so other bodies made from this file keep theirs.
      const styled = materials.map((m) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        const recolor = model.recolor?.[m.name];
        const glow = model.glow?.[m.name];
        if (recolor) c.color?.set(recolor);
        if (glow) {
          c.color?.set(glow);
          c.emissive?.set(glow);
          c.emissiveIntensity = 0.8;
        }
        if (tint && !recolor && !glow) c.color?.multiply(tint);
        if (model.faceted) c.flatShading = true;
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? styled : styled[0];
    });
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = Math.min(model.height / Math.max(size.y, 1e-3), (model.maxWidth ?? Infinity) / Math.max(size.x, size.z, 1e-3));
    if (model.parts?.length) addParts(object, model.parts, bounds, size.y);
    // GLTFLoader strips dots from node names ("Wing1.L" becomes "Wing1L").
    const collapse = new Set(model.collapse?.map((n) => THREE.PropertyBinding.sanitizeNodeName(n)));
    const collapsed: THREE.Object3D[] = [];
    if (collapse.size) object.traverse((o) => collapse.has(o.name) && collapsed.push(o));
    return { object, scale, offset: new THREE.Vector3(-center.x * scale, -bounds.min.y * scale + (model.hover ?? 0), -center.z * scale), collapsed };
  }, [scene, model]);

  const { actions, mixer } = useAnimations(animations, root);
  const body = useRef<THREE.Group>(null);
  // Each figure moves on its own beat, so a pack of slimes does not wobble in unison.
  const phase = useRef(0);
  useEffect(() => {
    phase.current = Math.random() * 10;
  }, []);
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

  // Runs after useAnimations' own frame callback, so it overrides what the clips just posed.
  useFrame((state) => {
    for (const bone of collapsed) bone.scale.setScalar(0.001);
    if (body.current) applyMotion(body.current, model, state.clock.elapsedTime + phase.current, down ? "down" : movingRef.current ? "walk" : "idle");
    if (oneShot.current && !down) return;
    const base: AnimationRole = down ? "death" : movingRef.current ? "walk" : "idle";
    if (current.current.role !== base) {
      oneShot.current = false;
      // Models without this clip (e.g. the wolf) just keep their pose.
      if (!play(base, base === "death")) current.current.role = base;
    }
  });

  // The outer group is the feet: procedural squash and hops pivot on the ground.
  return (
    <group ref={body}>
      <group ref={root} scale={scale} position={offset}>
        <primitive object={object} />
      </group>
    </group>
  );
}

/**
 * Procedural motion for bodies whose clips barely move: slimes wobble and
 * bounce, mushrooms hop, small blobs breathe, the wolf trots. `t` is seconds.
 */
function applyMotion(g: THREE.Group, model: CharacterModel, t: number, state: "idle" | "walk" | "down") {
  const h = model.height;
  let y = 0;
  let sy = 1;
  let tilt = 0;
  if (state !== "down")
    switch (model.motion) {
      case "jelly": {
        if (state === "walk") {
          // Bounce along: squashed on landing, stretched in the air.
          const s = Math.abs(Math.sin(t * 7));
          y = s * h * 0.3;
          sy = 0.82 + s * 0.3;
        } else {
          const s = Math.sin(t * 3.2);
          sy = 1 + s * 0.08;
          y = Math.max(0, Math.sin(t * 1.1)) ** 12 * h * 0.18; // now and then a little hop
        }
        break;
      }
      case "hop": {
        // Hops: a crouch, a jump, a squashed landing. Faster and higher when walking.
        const period = state === "walk" ? 0.45 : 1.7;
        const p = (t % period) / period;
        const air = state === "walk" ? 0.75 : 0.32;
        if (p < air) {
          const k = p / air;
          y = Math.sin(k * Math.PI) * h * (state === "walk" ? 0.32 : 0.22);
          sy = 1.1 - Math.abs(k - 0.5) * 0.2;
        } else {
          const k = (p - air) / (1 - air);
          sy = 1 - Math.sin(k * Math.PI) * 0.16;
        }
        break;
      }
      case "bob": {
        if (state === "walk") {
          y = Math.abs(Math.sin(t * 8)) * h * 0.08;
          tilt = Math.sin(t * 8) * 0.08;
        } else sy = 1 + Math.sin(t * 2.4) * 0.035;
        break;
      }
      case "trot": {
        if (state === "walk") {
          y = Math.abs(Math.sin(t * 11)) * h * 0.1;
          tilt = Math.sin(t * 11) * 0.06;
        } else sy = 1 + Math.sin(t * 2) * 0.025;
        break;
      }
    }
  // Keep the volume: taller means thinner.
  const sxz = 1 / Math.sqrt(sy);
  g.position.y += (y - g.position.y) * 0.5;
  g.scale.set(g.scale.x + (sxz - g.scale.x) * 0.35, g.scale.y + (sy - g.scale.y) * 0.35, g.scale.z + (sxz - g.scale.z) * 0.35);
  g.rotation.z += (tilt - g.rotation.z) * 0.3;
}

const ROCK_MATERIAL = new THREE.MeshStandardMaterial({ color: "#6f6a62", roughness: 0.95, flatShading: true });
const NOSE_MATERIAL = new THREE.MeshStandardMaterial({ color: "#15110f", roughness: 0.4 });

function partMesh(part: BodyPart, index: number): THREE.Object3D {
  const material = part.color ? new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85 }) : ROCK_MATERIAL;
  if (part.shape === "rock") {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), ROCK_MATERIAL);
    rock.scale.set(1.1, 0.8, 1);
    rock.rotation.set(index * 1.3, index * 0.7, index * 2.1);
    return rock;
  }
  if (part.shape === "muzzle") {
    // A tapered snout pointing forward (+z) with a dark nose at the tip.
    const group = new THREE.Group();
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 1, 7), material);
    snout.rotation.x = Math.PI / 2;
    snout.scale.set(1, 1.15, 0.85);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), NOSE_MATERIAL);
    nose.position.set(0, 0.12, 0.5);
    group.add(snout, nose);
    return group;
  }
  // Tail: a bushy cone sweeping back and down.
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 7), material);
  tail.rotation.x = -Math.PI / 2 - 0.7;
  tail.position.set(0, -0.3, -0.4);
  const group = new THREE.Group();
  group.add(tail);
  return group;
}

/**
 * Pieces fixed to bones, placed and oriented in the body's own space (fractions of its height)
 * and parented to the bone so they follow every clip.
 */
function addParts(object: THREE.Object3D, parts: BodyPart[], bounds: THREE.Box3, height: number) {
  object.updateMatrixWorld(true);
  const centre = bounds.getCenter(new THREE.Vector3());
  const rootQuat = object.getWorldQuaternion(new THREE.Quaternion());
  parts.forEach((part, i) => {
    const bone = object.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(part.bone));
    if (!bone) return;
    const mesh = partMesh(part, i);
    mesh.traverse((o) => (o.castShadow = true));
    const world = new THREE.Vector3(centre.x + part.at[0] * height, bounds.min.y + part.at[1] * height, centre.z + part.at[2] * height);
    mesh.position.copy(bone.worldToLocal(world));
    // Undo the bone's rotation and scale so the piece keeps the body's orientation and the asked size.
    const boneQuat = bone.getWorldQuaternion(new THREE.Quaternion());
    mesh.quaternion.copy(boneQuat.invert().multiply(rootQuat).multiply(mesh.quaternion));
    const boneScale = bone.getWorldScale(new THREE.Vector3());
    mesh.scale.multiplyScalar((part.size * height) / boneScale.x);
    bone.add(mesh);
  });
}

export function preloadCharacterModel(file: string) {
  useGLTF.preload(file);
}
