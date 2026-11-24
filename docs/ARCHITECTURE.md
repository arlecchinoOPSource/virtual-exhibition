# Architecture

The site runs entirely in the browser. Vite emits a static bundle and copies the public assets. HTML and CSS provide the interface and status region. TypeScript owns application behavior and exhibit data validation. Three.js owns the scene graph, camera, and renderer.

## Rendering lifecycle

The app fetches and validates the exhibit manifest, loads the gallery GLB, and starts the renderer. The `?env=greybox` query loads the greybox test room instead. The perspective camera starts at the environment spawn position and heading at a standing eye height of 1.65 m. ResizeObserver updates the drawing buffer and camera projection when layout changes. Device pixel ratio is capped at 2.

The Three.js animation loop renders at the browser’s frame cadence. Tab visibility and WebGL context events stop and resume rendering without rebuilding the camera or changing its pose. Vite hot disposal stops the loop and releases listeners, observers, geometries, materials, and the renderer. Simulation advances in 120 Hz steps with a capped frame delta. Pausing clears accumulated time and held keys.

## Player, collision, and interaction

The player controls use pointer lock for yaw and pitch and normalized, yaw-relative WASD input. The player body uses axis-aligned collision proxies, a standing volume, gravity and a step-height limit. The gallery uses its exported `COL_` proxies and hides them. The greybox test room derives its proxies from visible primitives and includes stairs and a display obstacle.

A center-camera ray checks the first surface within three meters. Left click and E share the same action for the greybox display light, and intervening geometry blocks the ray. The DOM crosshair and prompt reflect the current capture and targeting state. Escape releases pointer lock, clears input and returns focus to Resume walk.

## Exhibit data and PDF state

The manifest pairs each exhibit with a named scene anchor and supplies its title, description, publication status, optional image, and optional PDF. The runtime validates all 15 anchors, statuses, and local asset paths. Load display content independently of the Blender geometry: each entry paints the `Frame_Canvas` of the frame at its anchor, and every anchor must receive exactly one entry. Ready entries load their image. Placeholder and awaiting entries show a numbered, typeset reservation card. Canvas textures use glTF UV orientation, so they are not flipped. Render manifest text as text in DOM elements: the center ray shows the targeted display title and description in a polite live region.

E or left click on a targeted display pauses the walk, releasing pointer lock and clearing held keys without changing the pose, and opens a modal `<dialog>` with the title, image, description, and a Read the essay action. Closing it returns focus to Resume walk, so resuming needs a visitor gesture.

Read the essay opens a second modal `<dialog>` over the details. It dynamically imports PDF.js and its worker on first use, so the initial gallery load fetches neither. The viewer renders every page to a canvas sized to the pane and the device pixel ratio. The focused page region scrolls with the arrow and page keys, and plus, minus, and zero change the zoom between 50% and 300% while keeping the reading position. Closing the viewer cancels active render tasks, destroys the loading task, and returns focus to Read the essay. A failed request shows a status message and the Open PDF file link, which is also the alternative for screen readers because canvas pages carry no text layer. `directory.html` is a second Vite page that lists all fifteen manifest entries as articles with headings, images, descriptions, and essay actions. It never creates a WebGL context. Its Read the essay button opens the same viewer, and Open PDF file stays the screen-reader route to the text.

## Environment loading and ownership

The initial visit will load the gallery and its essential assets. Load basement geometry, textures, and audio on demand when the visitor chooses to enter. The door in the right end wall is the choice: E or click on it loads `basement.glb`, adds its meshes and `COL_` proxies to the world, then swings the door 90 degrees into the stairwell over 0.8 s. `src/environments/door.ts` keeps `COL_Door_Basement` solid while the door is closed, loading, or closing, ignores input mid-swing, and refuses to close on a visitor in the doorway. A failed basement request leaves the door shut and solid, the prompt offers a retry, and the rest of the gallery is unaffected. The initial gallery visit never requests `basement.glb`. The stairwell drops 17 steps of 0.18 m to the lower landing, within the 0.22 m step limit. Keep the entrance usable if that request fails. Enable audio through a deliberate visitor gesture.

Blender defines static meshes, visual materials, collision proxies, named transforms, and door pivots. TypeScript interprets markers, instantiates frames, manages player and UI state, controls animation, and owns asset loading. Planned modules have reserved paths in the design. Source folders without code are deferred until their feature lands.
