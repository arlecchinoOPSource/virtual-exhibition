# Asset pipeline

## Blender scene conventions

- Use metric units and a scale of 1 Blender unit per meter. Model at real scale and apply rotation and scale before export where appropriate. Validate the Blender Z-up to glTF Y-up conversion in Three.js.
- Use descriptive, stable names such as `Wall_North`, `Island_Left`, or `Light_Gallery_01`. Use empty nodes named exactly `Exhibit_01` through `Exhibit_12` with a consistent facing direction. Point each marker's local +Y axis the way a visitor looks. The glTF export turns it into local −Z, the Three.js camera forward axis. Verify alignment with a test artwork. Keep artwork geometry and content independent of the room export.
- Name the starting transform `Spawn_Gallery`. Set a documented forward axis and verify spawn orientation and floor clearance after import. Name the basement entry target `Spawn_Basement` if it is loaded separately.
- Place the door pivot at the hinge and use a stable name such as `Door_Basement_Hinge`. Parent the door mesh to that pivot and export the swing as an animation or rotate the hinge by code.
- Prefix simplified collision proxies with `COL_`. Include floors, walls, displays, and stair proxies. Inspect collision and visibility separately and preserve collider names through export.

## Export and validate

1. Keep editable scenes under `assets-source/blender/` and export browser assets to `public/models/`. Use GLB as the default browser delivery format and glTF when separate asset inspection is useful. Generate the gallery blockout with `blender --background --factory-startup --python assets-source/blender/gallery_blockout.py -- public/models/gallery.glb`.
2. Export the gallery and basement independently. Inspect dimensions, pivots, names, textures, and animations in Three.js after every structural export.
3. Remove unused geometry and materials. Instance repeats where supported, merge compatible static meshes selectively, and test Meshopt or Draco only when transfer savings justify decoder overhead.
4. Prefer WebP or JPEG for suitable display images and PNG where lossless alpha or precision is needed. Evaluate KTX2/Basis for model textures and confirm color-space handling for base color versus roughness and normal data. Resize textures according to viewing distance and test compression visually.
5. Bake static lighting or ambient detail where it reduces runtime cost. Keep baked maps in suitable UV channels and check their appearance in the renderer. Use runtime lights sparingly for moving objects or effects.

## Rights and storage

Record source, creator, permission or license, attribution text, and modifications for every external asset next to its approved delivery location. Keep unapproved photos and coursework outside the public repository. The default ignore rules exclude references and essays. An approved essay can be explicitly allowlisted after verifying permission and removing student or file metadata that should stay private.

Keep large editable binaries outside ordinary Git history, in private shared storage or Git LFS if the team approves the account limits and workflow. Commit optimized public exports only after rights and size checks. Cloudflare Pages must receive actual content files rather than LFS pointer text. Split or compress oversized production assets before considering separate asset storage.
