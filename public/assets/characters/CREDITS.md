# Character asset credits

All models here are CC0 (public domain). Attribution is not required, but given gladly.

| Files | Source | License |
| --- | --- | --- |
| `knight`, `barbarian`, `mage`, `rogue`, `rogue-hooded` | **KayKit Character Pack: Adventurers 1.0** by Kay Lousberg — https://kaylousberg.com · https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | CC0 1.0 |
| `skeleton-warrior`, `skeleton-mage`, `skeleton-rogue`, `skeleton-minion` | **KayKit Character Pack: Skeletons 1.0** by Kay Lousberg — https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 | CC0 1.0 |
| `vampire-bat`, `frost-bat` | **Vampire Bat (Animated)** by rubberduck — https://opengameart.org/content/vampire-bat-animated | CC0 1.0 |
| `wolf` | **Wolf (low poly, rigged)** — https://opengameart.org/content/wolf-low-poly-rigged | CC0 1.0 |
| everything in `monsters/` (slimes, mushrooms, orcs, golems, yetis, demons, dragons…) | **Ultimate Monsters Bundle** by Quaternius — https://quaternius.com · files from https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6 | CC0 1.0 |

The bat and wolf were exported from their `.blend` sources with Blender 5.2.
All files were processed by `scripts/build-character-assets.mjs` (kept animations,
static channels removed, WebP textures, meshopt compression).

The monsters were processed by `scripts/build-monster-assets.mjs` (kept animations
renamed without the armature prefix, colours brightened and made matte, meshopt compression).
