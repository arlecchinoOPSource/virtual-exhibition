# Architecture

The site runs entirely in the browser. Vite emits a static bundle and copies the public assets. HTML and CSS provide the interface and status region. TypeScript owns application behavior and exhibit data validation. Three.js owns the scene graph, camera, and renderer.

## Rendering lifecycle

The app fetches and validates the exhibit manifest, creates the greybox scene, and starts the renderer. The perspective camera faces forward at a standing eye height of 1.65 m. ResizeObserver updates the drawing buffer and camera projection when layout changes. Device pixel ratio is capped at 2.

The Three.js animation loop renders at the browser’s frame cadence. Tab visibility and WebGL context events stop and resume rendering without rebuilding the camera or changing its pose. Vite hot disposal stops the loop and releases listeners, observers, geometries, materials, and the renderer. When movement is added, bound elapsed time after backgrounding the tab and keep simulation updates independent of frame rate. Pause input when an overlay has focus, pointer lock is lost, or the tab loses focus.

## Player, collision, and interaction

A player controller will own movement, camera orientation, gravity, and grounded state. The controller will consume keyboard and pointer-lock input, with touch input added when supported. Collision proxies authored alongside the scenery will provide walls, island boundaries, doors, floors, and stair ramps or steps. Use a player volume and test corners and stairs at multiple frame rates.

A center-camera ray and distance limit will select the nearest visible interactable. Left click and E will invoke the same action when the visitor is exploring. Walls must occlude targets. Escape will release pointer lock and pause input. The crosshair and contextual prompts are interface elements.

## Exhibit data and PDF state

The manifest pairs each exhibit with a named scene anchor and supplies its title, description, publication status, optional image, and optional PDF. The runtime validates all 12 anchors, statuses, and local asset paths. Load display content independently of the Blender geometry. Render manifest text as text in DOM elements.

The future PDF viewer will be a modal overlay loaded on demand with a PDF.js worker. Opening it disables movement, clears held input, and releases pointer lock. Leave the player transform and camera orientation intact. Trap and restore focus, offer keyboard-accessible scroll and zoom, and require a visitor gesture to resume pointer lock. Handle failed document requests and cancel active rendering when the viewer closes. Keep the 2D directory usable without WebGL.

## Environment loading and ownership

The initial visit will load the gallery and its essential assets. Load basement geometry, textures, and audio on demand when the visitor chooses to enter. Keep the entrance usable if that request fails. Enable audio through a deliberate visitor gesture.

Blender defines static meshes, visual materials, collision proxies, named transforms, and door pivots. TypeScript interprets markers, instantiates frames, manages player and UI state, controls animation, and owns asset loading. Planned modules have reserved paths in the design. Source folders without code are deferred until their feature lands.
