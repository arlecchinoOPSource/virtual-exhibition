# Asset pipeline

## Blender scene conventions

- Use metric units and a scale of 1 Blender unit per meter. Model at real scale and apply rotation and scale before export where appropriate. Validate the Blender Z-up to glTF Y-up conversion in Three.js.
- Use descriptive, stable names such as `Wall_North`, `Island_Left`, or `Light_Gallery_01`. Use empty nodes named exactly `Exhibit_01` through `Exhibit_15` with a consistent facing direction. Point each marker's local +Y axis the way a visitor looks. The glTF export turns it into local −Z, the Three.js camera forward axis. Verify alignment with a test artwork. Keep artwork geometry and content independent of the room export.
- Name the starting transform `Spawn_Gallery`. Set a documented forward axis and verify spawn orientation and floor clearance after import. Name the basement entry target `Spawn_Basement` if it is loaded separately.
- Place the door pivot at the hinge and use a stable name such as `Door_Basement_Hinge`. Parent the door mesh to that pivot and export the swing as an animation or rotate the hinge by code.
- Prefix simplified collision proxies with `COL_`. Include floors, walls, displays, and stair proxies. Inspect collision and visibility separately and preserve collider names through export.

## Export and validate

1. Keep editable scenes under `assets-source/blender/` and export browser assets to `public/models/`. Use GLB as the default browser delivery format and glTF when separate asset inspection is useful. Generate the gallery blockout with `blender --background --factory-startup --python assets-source/blender/gallery_blockout.py -- public/models`. It writes `gallery.glb`, the reusable `frame.glb`, and the on-demand `basement.glb`. The gallery's walls, partitions, spawn, lectern position and anchors come from the accepted layout in `assets-source/layout/redesign.json`; change the plan there, run `npm test` (the layout, gallery and route tests check it), and re-export. Spot light energy exports raw, so a Blender energy of 6.5 becomes a Three.js intensity of 6.5 cd.
2. Export the gallery and basement independently. Inspect dimensions, pivots, names, textures, and animations in Three.js after every structural export.
3. Remove unused geometry and materials. Instance repeats where supported, merge compatible static meshes selectively, and test Meshopt or Draco only when transfer savings justify decoder overhead. The gallery script merges same-material render boxes and keeps `COL_` proxies separate. Unit tests hold the gallery and frame exports under 5 MB combined, 56 draw calls, and 2048 px textures. The arrival elevator's car is one mesh with three materials, and its two door leaves stay separate meshes so they can slide. The basement plaster and concrete are baked by `basement_surfaces.py` into unique atlases at 80 px/m: each visible face gets its own region, and damage is placed by world position, so nothing tiles. Each atlas is a 2048 × 1024 base colour map (with baked ambient occlusion) plus 1024 × 512 roughness and normal maps. They export as JPEG (quality 82) inside `basement.glb`, so the initial gallery load requests none of them. The white BLACK METAL graffiti, whose T is an inverted cross, is a decal 3 mm off the east wall with its own 966 × 630 alpha texture at 420 px/m, exported as PNG. Its strokes are rasterised from hand-drawn stroke data, and the paint is left out wherever the plaster atlas shows a loss, so the wall reads through the mark. The throne (`throne.py`) is chamfered oak joinery on a raised base, with carved branches and a draped cloth. Its oak bakes through the same atlas path at 300 px/m (1024 × 1024 colour), with the grain running along each member and wear on its arrises and arm fronts. `COL_Throne` covers the base, so visitors cannot climb it. The candle stand (`candle_stand.py`) is one shared weathered-iron mesh: rods are at least 14 mm thick with 6–8 sides, and the rust and rubbed spots are in vertex colour. One point light serves all five candles. Two historical prints hang on the side walls (`posters.py`): Kittelsen's _Op under Fjeldet toner en Lur_ on the north wall and Doré's _Death on the Pale Horse_ on the south wall. Each is a paper sheet with its own material and image slot, sized from the image so the artwork keeps its proportions. The sheet stands 5 mm off the plaster, bows slightly, and lifts at one corner. A narrow margin and light ageing are baked at export, and an optional crop drops scan edges and printed captions; the source files stay as downloaded. Together the prints add about 280 KB as JPEG; their rights record is `public/models/CREDITS.md`. A vintage valve radio (`radio.py`, #60) stands on a side table in the south-east corner, clear of the route, the throne, the graffiti and the Doré print. Its arched walnut cabinet, fretwork grille, brass-framed dial with an invented scale, fluted knobs and chicken-head switch are original and generic. Dust and rubbed wear are vertex colour; the only texture is the 512 × 116 dial scale. Bevels are cut only on the cabinet body, table top and switch, so the radio costs about 90 KB. The playback contract for #61 is in the module docstring: root `Radio_Basement`, click/E target `Radio_Basement_Power`, the `Radio_Basement_Emitter` empty at the grille, and status meshes `Radio_Basement_Status` and `Radio_Basement_Dial`, each with its own material and exported unlit. The knobs and switch pivot on their shafts. `COL_Radio_Table` blocks the corner. The whole basement export stays under the 1.5 MB that a unit test enforces.
4. Prefer WebP or JPEG for suitable display images and PNG where lossless alpha or precision is needed. Evaluate KTX2/Basis for model textures and confirm color-space handling for base color versus roughness and normal data. Resize textures according to viewing distance and test compression visually.
5. Bake static lighting or ambient detail where it reduces runtime cost. Keep baked maps in suitable UV channels and check their appearance in the renderer. Use runtime lights sparingly for moving objects or effects.

## Rights and storage

Record source, creator, permission or license, attribution text, and modifications for every external asset next to its approved delivery location. Keep unapproved photos and coursework outside the public repository. The default ignore rules exclude references and essays. An approved essay can be explicitly allowlisted after verifying permission and removing student or file metadata that should stay private.

Keep large editable binaries outside ordinary Git history, in private shared storage or Git LFS if the team approves the account limits and workflow. Commit optimized public exports only after rights and size checks. Cloudflare Pages must receive actual content files rather than LFS pointer text. Split or compress oversized production assets before considering separate asset storage.

## Third-party asset intake

Every external model or texture goes through these steps, in order, and its row in the [asset register](ASSET_REGISTER.md) records each one. A page that exists, or an export that succeeds, does not count as an import.

1. **Register it.** Record the source URL and ID, the page's real title, the creator, the exact licence and version with its link, the attribution the licence needs, its intended room, and a status: selected, candidate, deferred or rejected. Correct the board's label when the page shows something else.
2. **Download only what is selected, from the source.**
   - Keep the untouched original outside `public/`, in `assets-source/third-party/<id>/`. Record the download date, the original file name and its SHA-256.
   - Inspect archive contents and any licence files before importing.
   - Never commit credentials, unlicensed references or reference photos.
3. **Import and measure.**
   - Import the glTF/GLB, or convert a supplied OBJ/FBX, into Blender.
   - Record triangles, vertices, objects, materials, textures and their dimensions, its real-world size and the original file size.
   - Keep the vertex colours, UVs and textures it needs. Check normals, alpha and dependencies.
4. **Normalize.**
   - Scale it to metric real-world size and apply its transforms.
   - Set a useful origin, usually its base on the floor, and stable descriptive names.
   - Check Blender Z-up against glTF Y-up.
   - Remove cameras, lights, animation and unused pieces unless they are deliberately kept. Don't carry stock lights into a room.
5. **Fit it to the exhibition.**
   - Harmonize the palette, roughness and detail with the room. Keep base-colour and emissive maps in sRGB and data maps linear, and bake procedural materials glTF can't carry.
   - Reuse materials and geometry, and simplify detail nobody sees.
   - Add an axis-aligned `COL_` proxy only where navigation needs it, inside the plan's furniture envelope (`assets-source/layout/redesign.json`).
   - Decoration must not block the frames' ray targeting.
6. **Keep it reproducible.**
   - Put the import and adaptation script in `assets-source/blender/`, with the command that regenerates it.
   - Commit optimized exports to `public/models/`, never raw downloads.
   - Keep large originals out of Git history unless they are small and their licence allows redistribution. Don't add Git LFS without checking hosting support.
7. **Export and validate.** Export a self-contained GLB, then:
   - check it with a glTF validator and the actual Three.js `GLTFLoader`;
   - confirm the materials, transforms, pivots, node names and collision in the browser;
   - record the optimized size, triangles, materials and draws, and texture memory against the original.
8. **Credit it.** Update `public/models/CREDITS.md` and the register with the title, creator, source, licence and a note of changes; CC BY requires all of these. Make sure visitors can reach the credits. Check that every referenced file exists with the right case, with no machine-local paths or external fetches at runtime.
9. **Review it.** Open a focused pull request:
   - provenance and licence evidence;
   - source and export locations, and regeneration commands;
   - before/after measurements;
   - browser screenshots at normal and reduced resolution;
   - check results and known limits.

   Reject or replace any asset whose redistribution rights are unclear.
