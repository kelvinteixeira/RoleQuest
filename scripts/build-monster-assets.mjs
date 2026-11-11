#!/usr/bin/env node
/**
 * Builds the monster GLBs in public/assets/characters/monsters from the
 * Ultimate Monsters Bundle by Quaternius (CC0; see
 * public/assets/characters/CREDITS.md): keeps only the animations the table
 * uses (renamed without the "CharacterArmature|" prefix), then dedups,
 * resamples and compresses geometry/animation with meshopt. Materials are
 * brightened and made matte (see below).
 *
 * Usage: node scripts/build-monster-assets.mjs <dir-with-source-glbs>
 * The directory holds the bundle's GLBs named by slug (dragon.glb, pink-slime.glb, …).
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error("Usage: node scripts/build-monster-assets.mjs <dir-with-source-glbs>");
  process.exit(1);
}
const outDir = resolve("public/assets/characters/monsters");
mkdirSync(outDir, { recursive: true });

/** Animations the room uses, over the bundle's three rigs (see character-models.ts). */
const KEEP = new Set(["Idle", "Walk", "Bite_Front", "HitRecieve", "Death", "Dance", "Flying_Idle", "Fast_Flying", "Headbutt", "Punch", "HitReact", "Wave", "Weapon"]);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

for (const file of readdirSync(source).filter((f) => f.endsWith(".glb")).sort()) {
  const doc = await io.read(join(source, file));
  const root = doc.getRoot();
  for (const animation of root.listAnimations()) {
    const name = animation.getName().split("|").pop();
    if (KEEP.has(name)) animation.setName(name);
    else animation.dispose();
  }
  // The bundle's glTF export stores its flat colours linearised twice and half-metallic,
  // which renders near black without an environment map: undo one gamma step, make them matte.
  for (const material of root.listMaterials()) {
    const [r, g, b, alpha] = material.getBaseColorFactor();
    material.setBaseColorFactor([r ** (1 / 2.2), g ** (1 / 2.2), b ** (1 / 2.2), alpha]);
    material.setMetallicFactor(0);
    material.setRoughnessFactor(0.85);
  }
  await doc.transform(dedup(), resample(), prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }), prune());
  await io.write(join(outDir, file), doc);
  console.log(`${file}: ${root.listAnimations().map((a) => a.getName()).join(", ")}`);
}
