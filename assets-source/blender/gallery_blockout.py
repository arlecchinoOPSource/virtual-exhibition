"""Build the approved main gallery blockout and its display frame as GLBs.

Run from the repository root:

    blender --background --factory-startup \
        --python assets-source/blender/gallery_blockout.py -- public/models

This writes gallery.glb (room, collision proxies, markers, and lights) and
frame.glb (the reusable display frame). Artwork stays out of both exports.

Units are meters with Z up. The room spans x -10..10 and y -5..5 with a
3.6 m ceiling. The visitor spawns at the left end (-X) and the basement
opening is in the right end wall (+X).

Every marker's local +Y axis points the way a visitor looks: forward at the
spawn and into the display surface at an exhibit anchor. After the glTF Y-up
conversion that axis becomes the node's local -Z, matching a Three.js camera.
The frame is modeled with its back at the origin and its front facing -Y, so
it faces the walkway when attached to an anchor.

Light energy is exported raw: each spot's Blender energy becomes the
Three.js intensity in candela.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

HEIGHT = 3.6
WALL = 0.2
ANCHOR_HEIGHT = 1.5
ANCHOR_OFFSET = 0.02
FRAME_WIDTH = 1.3
FRAME_HEIGHT = 1.0
FRAME_DEPTH = 0.05
FRAME_BORDER = 0.06
LIGHT_HEIGHT = 3.3
LIGHT_THROW = 1.3
LIGHT_INTENSITY = 18

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0

collections = {}
for name in (
    "Gallery_Render",
    "Gallery_Collision",
    "Gallery_Markers",
    "Gallery_Lights",
    "Frame_Display",
):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    collections[name] = collection


def material(name, rgb, roughness=0.85):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1.0)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


FLOOR = material("Blockout_Floor", (0.08, 0.085, 0.095))
WALLS = material("Blockout_Wall", (0.33, 0.34, 0.36))
DISPLAY = material("Blockout_Display", (0.14, 0.17, 0.2))
CEILING = material("Blockout_Ceiling", (0.25, 0.25, 0.26))
DOORWAY = material("Blockout_Doorway", (0.02, 0.02, 0.02))
FIXTURE = material("Fixture_Housing", (0.03, 0.03, 0.035), 0.5)
FRAME = material("Frame_Moulding", (0.04, 0.035, 0.03), 0.6)
CANVAS = material("Frame_TestCanvas", (0.75, 0.73, 0.68))
MARK = material("Frame_TestMark", (0.6, 0.08, 0.05))


def box_mesh(name, size):
    sx, sy, sz = (value / 2 for value in size)
    verts = [(x, y, z) for x in (-sx, sx) for y in (-sy, sy) for z in (-sz, sz)]
    faces = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    return mesh


def box(name, x0, x1, y0, y1, z0, z1, mat, collide=True, collection="Gallery_Render"):
    """Add a visible box and, unless disabled, a matching COL_ proxy."""
    size = (x1 - x0, y1 - y0, z1 - z0)
    center = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    obj = bpy.data.objects.new(name, box_mesh(name, size))
    obj.location = center
    obj.data.materials.append(mat)
    collections[collection].objects.link(obj)
    if collide:
        proxy = bpy.data.objects.new(f"COL_{name}", box_mesh(f"COL_{name}", size))
        proxy.location = center
        proxy.display_type = "WIRE"
        collections["Gallery_Collision"].objects.link(proxy)


GAZE = {"N": (0, 1), "S": (0, -1), "E": (1, 0), "W": (-1, 0)}


def marker(name, x, y, z, gaze):
    """Add an empty whose +Y points along gaze: 'N', 'S', 'E', or 'W'."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "SINGLE_ARROW"
    empty.location = (x, y, z)
    empty.rotation_euler = (
        0,
        0,
        {"N": 0, "S": math.pi, "E": -math.pi / 2, "W": math.pi / 2}[gaze],
    )
    collections["Gallery_Markers"].objects.link(empty)


def gallery_light(index, x, y, gaze):
    """Hang a spot above the walkway, aimed at the anchor, with a fixture box."""
    gx, gy = GAZE[gaze]
    position = Vector((x - gx * LIGHT_THROW, y - gy * LIGHT_THROW, LIGHT_HEIGHT))
    aim = Vector((x, y, ANCHOR_HEIGHT)) - position
    name = f"Light_Gallery_{index:02}"
    data = bpy.data.lights.new(name, "SPOT")
    data.energy = LIGHT_INTENSITY
    data.spot_size = math.radians(50)
    data.spot_blend = 0.35
    data.color = (1.0, 0.95, 0.88)
    light = bpy.data.objects.new(name, data)
    light.location = position
    light.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    collections["Gallery_Lights"].objects.link(light)
    half = 0.07
    box(
        f"Fixture_Gallery_{index:02}",
        position.x - half,
        position.x + half,
        position.y - half,
        position.y + half,
        LIGHT_HEIGHT,
        HEIGHT,
        FIXTURE,
        collide=False,
    )


# Floor and ceiling. Nothing can reach the ceiling, so it needs no proxy.
box("Floor", -10 - WALL, 10 + WALL, -5 - WALL, 5 + WALL, -WALL, 0, FLOOR)
box(
    "Ceiling",
    -10 - WALL,
    10 + WALL,
    -5 - WALL,
    5 + WALL,
    HEIGHT,
    HEIGHT + WALL,
    CEILING,
    collide=False,
)

# Long walls with piers that recess three display bays per side.
box("Wall_North", -10 - WALL, 10 + WALL, 5, 5 + WALL, 0, HEIGHT, WALLS)
box("Wall_South", -10 - WALL, 10 + WALL, -5 - WALL, -5, 0, HEIGHT, WALLS)
for index, x in enumerate((-6, -2, 2, 6), start=1):
    box(f"Pier_North_{index:02}", x - 0.3, x + 0.3, 4.65, 5, 0, HEIGHT, WALLS)
    box(f"Pier_South_{index:02}", x - 0.3, x + 0.3, -5, -4.65, 0, HEIGHT, WALLS)

# Left end wall behind the spawn and right end wall around the basement opening.
box("Wall_West", -10 - WALL, -10, -5, 5, 0, HEIGHT, WALLS)
box("Wall_East_North", 10, 10 + WALL, 0.8, 5, 0, HEIGHT, WALLS)
box("Wall_East_South", 10, 10 + WALL, -5, -0.8, 0, HEIGHT, WALLS)
box("Wall_East_Lintel", 10, 10 + WALL, -0.8, 0.8, 2.4, HEIGHT, WALLS)
# Seals the opening until the basement door lands in Milestone 5.
box(
    "Basement_Opening_Placeholder",
    10 + WALL,
    10 + 2 * WALL,
    -0.8,
    0.8,
    0,
    2.4,
    DOORWAY,
)

# Two freestanding islands and a smaller central partition.
box("Island_Left", -5.5, -2.5, -0.3, 0.3, 0, 2.4, DISPLAY)
box("Island_Right", 2.5, 5.5, -0.3, 0.3, 0, 2.4, DISPLAY)
box("Partition_Center", -0.15, 0.15, -1, 1, 0, 2.4, DISPLAY)

marker("Spawn_Gallery", -8.5, 0, 0, "E")

# 01-06 perimeter bays, 07-10 island faces, 11-12 partition faces.
anchors = [
    (-4, 5 - ANCHOR_OFFSET, "N"),
    (0, 5 - ANCHOR_OFFSET, "N"),
    (4, 5 - ANCHOR_OFFSET, "N"),
    (4, -5 + ANCHOR_OFFSET, "S"),
    (0, -5 + ANCHOR_OFFSET, "S"),
    (-4, -5 + ANCHOR_OFFSET, "S"),
    (-4, 0.3 + ANCHOR_OFFSET, "S"),
    (-4, -0.3 - ANCHOR_OFFSET, "N"),
    (4, 0.3 + ANCHOR_OFFSET, "S"),
    (4, -0.3 - ANCHOR_OFFSET, "N"),
    (-0.15 - ANCHOR_OFFSET, 0, "E"),
    (0.15 + ANCHOR_OFFSET, 0, "W"),
]
for index, (x, y, gaze) in enumerate(anchors, start=1):
    marker(f"Exhibit_{index:02}", x, y, ANCHOR_HEIGHT, gaze)
    gallery_light(index, x, y, gaze)

# Reusable frame: back at the origin, front facing -Y, centered on the anchor.
w, h, d, b = FRAME_WIDTH / 2, FRAME_HEIGHT / 2, FRAME_DEPTH, FRAME_BORDER
for name, x0, x1, z0, z1 in (
    ("Frame_Top", -w, w, h - b, h),
    ("Frame_Bottom", -w, w, -h, -h + b),
    ("Frame_Left", -w, -w + b, -h + b, h - b),
    ("Frame_Right", w - b, w, -h + b, h - b),
):
    box(name, x0, x1, -d, 0, z0, z1, FRAME, collide=False, collection="Frame_Display")
box(
    "Frame_TestCanvas",
    -w + b,
    w - b,
    -0.02,
    0,
    -h + b,
    h - b,
    CANVAS,
    collide=False,
    collection="Frame_Display",
)
# Marks the canvas's top-left corner as seen by a visitor to catch mirrored axes.
box(
    "Frame_TestMark",
    -w + b + 0.04,
    -w + b + 0.16,
    -0.025,
    -0.02,
    h - b - 0.16,
    h - b - 0.04,
    MARK,
    collide=False,
    collection="Frame_Display",
)


def export(path, collection_names):
    bpy.ops.object.select_all(action="DESELECT")
    for name in collection_names:
        for obj in collections[name].objects:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=True,
        export_import_convert_lighting_mode="RAW",
    )


output = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
export(
    os.path.join(output, "gallery.glb"),
    ("Gallery_Render", "Gallery_Collision", "Gallery_Markers", "Gallery_Lights"),
)
export(os.path.join(output, "frame.glb"), ("Frame_Display",))
