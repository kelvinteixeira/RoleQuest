#!/usr/bin/env node
/**
 * Builds the character/creature GLBs in public/assets/characters from the
 * original CC0 packs (see public/assets/characters/CREDITS.md):
 * keeps only the animations the table uses, then dedups, resamples and
 * compresses textures to WebP and geometry/animation with meshopt
 * (decoded by three.js / drei useGLTF out of the box).
 *
 * Usage: node scripts/build-character-assets.mjs <dir-with-source-glbs>
 * The directory must contain the KayKit GLBs (Knight.glb, Skeleton_Mage.glb, …)
 * and the Blender exports wolf.glb, vampire_bat.glb and frost_bat.glb.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error("Usage: node scripts/build-character-assets.mjs <dir-with-source-glbs>");
  process.exit(1);
}
const outDir = resolve("public/assets/characters");
mkdirSync(outDir, { recursive: true });

/** Animations the room uses (see src/features/virtual-tabletop/model/character-models.ts). */
const KAYKIT_ANIMATIONS = [
  "Idle",
  "2H_Melee_Idle",
  "Walking_A",
  "1H_Melee_Attack_Chop",
  "2H_Melee_Attack_Chop",
  "Dualwield_Melee_Attack_Stab",
  "2H_Ranged_Shoot",
  "Spellcast_Shoot",
  "Spellcast_Raise",
  "Hit_A",
  "Death_A",
  "Death_A_Pose",
  "Cheer",
];
const BAT_ANIMATIONS = ["Bat_Idle", "Bat_Flying", "Bat_Attack", "Bat_Die"];

const FILES = [
  ["Knight.glb", "knight.glb", KAYKIT_ANIMATIONS],
  ["Barbarian.glb", "barbarian.glb", KAYKIT_ANIMATIONS],
  ["Mage.glb", "mage.glb", KAYKIT_ANIMATIONS],
  ["Rogue.glb", "rogue.glb", KAYKIT_ANIMATIONS],
  ["Rogue_Hooded.glb", "rogue-hooded.glb", KAYKIT_ANIMATIONS],
  ["Skeleton_Warrior.glb", "skeleton-warrior.glb", KAYKIT_ANIMATIONS],
  ["Skeleton_Mage.glb", "skeleton-mage.glb", KAYKIT_ANIMATIONS],
  ["Skeleton_Rogue.glb", "skeleton-rogue.glb", KAYKIT_ANIMATIONS],
  ["Skeleton_Minion.glb", "skeleton-minion.glb", KAYKIT_ANIMATIONS],
  ["vampire_bat.glb", "vampire-bat.glb", BAT_ANIMATIONS],
  ["frost_bat.glb", "frost-bat.glb", BAT_ANIMATIONS],
  ["wolf.glb", "wolf.glb", []],
];

/**
 * Drops animation channels whose every keyframe equals the node's rest pose
 * (unanimated bones, scale always 1). They add hundreds of accessors to the
 * JSON chunk without changing the motion.
 */
function dropStaticChannels() {
  return (doc) => {
    const EPS = 1e-4;
    for (const animation of doc.getRoot().listAnimations()) {
      for (const channel of animation.listChannels()) {
        const node = channel.getTargetNode();
        const path = channel.getTargetPath();
        const output = channel.getSampler()?.getOutput();
        if (!node || !output || path === "weights") continue;
        const rest = path === "translation" ? node.getTranslation() : path === "rotation" ? node.getRotation() : node.getScale();
        const el = [];
        let still = true;
        for (let i = 0; i < output.getCount() && still; i++) {
          output.getElement(i, el);
          still = el.every((v, k) => Math.abs(v - rest[k]) < EPS);
        }
        if (still) channel.dispose();
      }
      const used = new Set(animation.listChannels().map((c) => c.getSampler()));
      for (const sampler of animation.listSamplers()) if (!used.has(sampler)) sampler.dispose();
    }
    // Accessors left behind by the disposed samplers are only attached to the root.
    for (const accessor of doc.getRoot().listAccessors()) {
      if (accessor.listParents().every((p) => p.propertyType === "Root")) accessor.dispose();
    }
  };
}

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

for (const [input, output, keep] of FILES) {
  const doc = await io.read(join(source, input));
  const root = doc.getRoot();
  for (const animation of root.listAnimations()) {
    if (!keep.includes(animation.getName())) animation.dispose();
  }
  await doc.transform(
    dedup(),
    resample(),
    dropStaticChannels(),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512] }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
    prune(),
  );
  await io.write(join(outDir, output), doc);
  const kept = root.listAnimations().map((a) => a.getName());
  console.log(`${output}: ${kept.length} animations`);
}
