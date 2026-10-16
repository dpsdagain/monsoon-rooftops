# Stormline courier — Blender source

An original stylized courier made with the locally installed Blender 5.2.1 LTS. The cream weather shell, open hood, smoked goggles, coat pockets, safety tape, boots, gloves, delivery bag and orange cloth scarf are modelled geometry. No downloaded meshes or AI-generated textures are used in this character. The earlier Nano Banana city image informed the palette and costume direction.

## Files

- `courier.blend`: editable native source. `Courier_Asset` contains the neutral character at the origin. `Courier_Studio` contains front and back copies, lights and the inspection camera.
- `build_courier.py`: reproducible source generator for Blender. It also saves the native file, exports the GLB, records statistics and renders the studio image.
- `courier-stats.json`: measured export statistics.
- `../../public/models/courier/courier.glb`: self-contained binary model loaded by the game.
- `../../public/models/courier/courier-preview.png`: front/back studio render.

The final export is 226,748 bytes, 5,534 triangles and 21 mesh objects attached to 21 named pivots. It uses material colours, with no image textures or external binary dependencies. Size is below the 512 KiB asset check; this is a content budget, not a measured Android performance guarantee.

## Rig and game integration

This is a rigid articulated object hierarchy, not a deforming skin/armature character. The game animates its named hip, knee, foot, shoulder, elbow, hand, head, coat-hem and scarf pivots. Animation is generated at runtime, rather than baked animation clips. Exported coordinates are +Y up, +Z forward, with the foot plane at Y=0. The existing 1.18 display scale is applied by the game wrapper.

`src/stormline-model.js` loads and validates the asset, installs independent player and ghost hierarchies and binds the hand used as the visible tether origin. Ghost material replacement does not change the live model's materials. The procedural courier remains while loading and is retained if asset validation or loading fails. Classic and `?art=plain` continue to use their previous characters.

## Rebuild

With Blender available on PATH, run this from the repository root:

```
blender --background --factory-startup --python assets/blender/build_courier.py -- --output tmp/courier-build
```

Review the render, copy `courier.blend` and `courier-stats.json` into `assets/blender/`, and copy `courier.glb` and `courier-preview.png` into `public/models/courier/`. Keep the generator version with the corresponding model.

Run `npm run test:assets` to check file integrity, dimensions, origin, triangle budget, required joints, independent player/ghost poses and materials, invalid-model fallback and valid grapple positions throughout a complete delivery. `npm run build` creates the playable site.

The integrated model was observed loading successfully in the browser with no console errors. The full animated route is also checked against the exported GLB in Node. A separate close-up Blender render verifies front/back appearance. Real Android performance and APK packaging remain separate work.
