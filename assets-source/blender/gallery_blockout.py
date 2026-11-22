"""Build the approved main gallery blockout and its display frame as GLBs.

Run from the repository root:

    blender --background --factory-startup \
        --python assets-source/blender/gallery_blockout.py -- public/models

This writes gallery.glb (room, collision proxies, markers, and lights),
frame.glb (the reusable display frame), and basement.glb (loaded on demand). Artwork stays out of every export.

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
    "Basement_Render",
    "Basement_Collision",
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
FIXTURE = material("Fixture_Housing", (0.03, 0.03, 0.035), 0.5)
FRAME = material("Frame_Moulding", (0.04, 0.035, 0.03), 0.6)
CANVAS = material("Frame_Canvas", (0.75, 0.73, 0.68))


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


def box(
    name, x0, x1, y0, y1, z0, z1, mat, collide=True,
    collection="Gallery_Render", proxies="Gallery_Collision",
):
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
        collections[proxies].objects.link(proxy)


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
# Basement entrance in the right end wall: a hinged door, its frame, a sign,
# and a statue. The door collider is a separate proxy the engine toggles.
DOOR = material("Door_Basement", (0.05, 0.045, 0.04), 0.7)
IRON = material("Entrance_Iron", (0.06, 0.06, 0.065), 0.45)
BONE = material("Sign_Lettering", (0.78, 0.74, 0.66), 0.6)
CLOTH = material("Statue_Robe", (0.015, 0.015, 0.018), 0.9)
BLADE = material("Statue_Blade", (0.55, 0.56, 0.58), 0.3)
WOOD = material("Statue_Staff", (0.12, 0.08, 0.05), 0.8)

hinge = bpy.data.objects.new("Door_Basement_Hinge", None)
hinge.empty_display_type = "PLAIN_AXES"
hinge.location = (10 + WALL / 2, 0.8, 0)
collections["Gallery_Markers"].objects.link(hinge)
door = bpy.data.objects.new("Door_Basement", box_mesh("Door_Basement", (0.06, 1.6, 2.4)))
door.data.materials.append(DOOR)
door.parent = hinge
door.location = (0, -0.8, 1.2)
collections["Gallery_Render"].objects.link(door)
proxy = bpy.data.objects.new("COL_Door_Basement", box_mesh("COL_Door_Basement", (0.06, 1.6, 2.4)))
proxy.location = (10 + WALL / 2, 0, 1.2)
proxy.display_type = "WIRE"
collections["Gallery_Collision"].objects.link(proxy)

for name, y0, y1, z0, z1 in (
    ("Door_Frame_North", 0.8, 0.95, 0, 2.55),
    ("Door_Frame_South", -0.95, -0.8, 0, 2.55),
    ("Door_Frame_Top", -0.95, 0.95, 2.4, 2.55),
):
    box(name, 9.94, 10, y0, y1, z0, z1, IRON, collide=False)

# Sign: a spiked iron board with raised lettering facing the gallery (-X).
box("Sign_Board", 9.95, 10, -1.75, 1.75, 2.72, 3.2, IRON, collide=False)
for index in range(9):
    y = -1.6 + index * 0.4
    spike = bpy.data.meshes.new(f"Sign_Spike_{index:02}")
    spike.from_pydata(
        [(9.95, y - 0.08, 3.2), (9.95, y + 0.08, 3.2), (9.95, y, 3.38 + 0.06 * (index % 2)),
         (10, y - 0.08, 3.2), (10, y + 0.08, 3.2), (10, y, 3.38 + 0.06 * (index % 2))],
        [],
        [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)],
    )
    spike.materials.append(IRON)
    obj = bpy.data.objects.new(f"Sign_Spike_{index:02}", spike)
    collections["Gallery_Render"].objects.link(obj)

text_curve = bpy.data.curves.new("Sign_Basement", "FONT")
text_curve.body = "BASEMENT OF DOOM"
text_curve.size = 0.3
text_curve.extrude = 0.012
text_curve.align_x = "CENTER"
text_curve.align_y = "CENTER"
text_obj = bpy.data.objects.new("Sign_Basement_Text", text_curve)
scene.collection.objects.link(text_obj)
text_obj.location = (9.935, 0, 2.96)
# Stand the text up and turn it to face -X so it reads left to right.
text_obj.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
bpy.context.view_layer.update()
lettering = bpy.data.meshes.new_from_object(
    text_obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
)
lettering.materials.clear()
lettering.materials.append(BONE)
sign = bpy.data.objects.new("Sign_Basement", lettering)
sign.matrix_world = text_obj.matrix_world
sign["text"] = text_curve.body
collections["Gallery_Render"].objects.link(sign)
bpy.data.objects.remove(text_obj)

# An original Grim Reaper statue on a plinth in the south-east corner, clear
# of the walkway and the doorway.
sx, sy = 9.3, -3.6
box("Statue_Plinth", sx - 0.35, sx + 0.35, sy - 0.35, sy + 0.35, 0, 0.4, IRON, collide=False)
bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.38, radius2=0.12, depth=1.5, location=(sx, sy, 1.15))
robe = bpy.context.active_object
robe.name = "Statue_Robe"
robe.data.materials.append(CLOTH)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.2, location=(sx - 0.03, sy, 2.0))
hood = bpy.context.active_object
hood.name = "Statue_Hood"
hood.scale = (1.0, 0.9, 1.25)
hood.data.materials.append(CLOTH)
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.025, depth=2.3, location=(sx - 0.25, sy + 0.25, 1.55))
staff = bpy.context.active_object
staff.name = "Statue_Staff"
staff.rotation_euler = (0.12, 0, 0)
staff.data.materials.append(WOOD)
blade = bpy.data.objects.new("Statue_Blade", box_mesh("Statue_Blade", (0.03, 0.75, 0.12)))
blade.location = (sx - 0.25, sy + 0.05, 2.62)
blade.rotation_euler = (-0.35, 0, 0)
blade.data.materials.append(BLADE)
for obj in (robe, hood, staff):
    for owner in obj.users_collection:
        owner.objects.unlink(obj)
    collections["Gallery_Render"].objects.link(obj)
collections["Gallery_Render"].objects.link(blade)
proxy = bpy.data.objects.new("COL_Statue", box_mesh("COL_Statue", (0.7, 0.7, 2.4)))
proxy.location = (sx, sy, 1.2)
proxy.display_type = "WIRE"
collections["Gallery_Collision"].objects.link(proxy)

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
# The canvas is one textured quad recessed 2 cm behind the moulding's front.
# Counter-clockwise as seen from the front (-Y), so its normal faces the visitor;
# UV (0, 0) is the visitor's bottom-left corner.
cx0, cx1, cz0, cz1 = -w + b, w - b, -h + b, h - b
canvas = bpy.data.meshes.new("Frame_Canvas")
canvas.from_pydata(
    [(cx0, -0.02, cz0), (cx1, -0.02, cz0), (cx1, -0.02, cz1), (cx0, -0.02, cz1)],
    [],
    [(0, 1, 2, 3)],
)
uv_layer = canvas.uv_layers.new(name="UVMap")
for loop, uv in zip(canvas.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
    uv_layer.data[loop.index].uv = uv
canvas.materials.append(CANVAS)
collections["Frame_Display"].objects.link(bpy.data.objects.new("Frame_Canvas", canvas))


# Basement stairwell behind the door: an upper landing that clears the door's
# swing, 17 steps down, and a lower landing. It exports to basement.glb so the
# gallery loads without it.
CONCRETE = material("Basement_Concrete", (0.16, 0.155, 0.15), 0.95)
PLASTER = material("Basement_Plaster", (0.24, 0.22, 0.2), 0.95)
RISE, RUN, STEPS = 0.18, 0.3, 17
BOTTOM = -RISE * STEPS
STAIR_X = 12.0
LOWER_X = STAIR_X + RUN * STEPS
END_X = 19.0
BASEMENT = dict(collection="Basement_Render", proxies="Basement_Collision")

box("Landing_Upper", 10 + WALL, STAIR_X, -0.8, 0.8, BOTTOM - 0.2, 0, CONCRETE, **BASEMENT)
for step in range(STEPS):
    x0 = STAIR_X + RUN * step
    box(f"Stair_{step + 1:02}", x0, x0 + RUN, -0.8, 0.8, BOTTOM - 0.2, -RISE * (step + 1), CONCRETE, **BASEMENT)
box("Landing_Lower", LOWER_X, END_X, -0.8, 0.8, BOTTOM - 0.2, BOTTOM, CONCRETE, **BASEMENT)
for side, y0, y1 in (("North", 0.8, 1.0), ("South", -1.0, -0.8)):
    box(f"Stairwell_Wall_{side}", 10 + WALL, END_X, y0, y1, BOTTOM, HEIGHT, PLASTER, **BASEMENT)
box("Stairwell_Wall_End", END_X, END_X + WALL, -1.0, 1.0, BOTTOM, HEIGHT, PLASTER, **BASEMENT)
box("Stairwell_Ceiling", 10 + WALL, END_X + WALL, -1.0, 1.0, HEIGHT, HEIGHT + WALL, PLASTER, collide=False, collection="Basement_Render")


def join(name, prefixes, collection):
    """Merge same-material render boxes into one mesh to cut draw calls."""
    objs = [o for o in collections[collection].objects if o.name.startswith(prefixes)]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name


# COL_ proxies stay separate: the engine needs one box per collider.
join("Gallery_Walls", ("Wall_", "Pier_"), "Gallery_Render")
join("Gallery_Displays", ("Island_", "Partition_"), "Gallery_Render")
join("Gallery_Fixtures", ("Fixture_Gallery_",), "Gallery_Render")
join("Door_Frame", ("Door_Frame_", "Sign_Board", "Sign_Spike_", "Statue_Plinth"), "Gallery_Render")
join("Statue_Cloak", ("Statue_Robe", "Statue_Hood"), "Gallery_Render")
join("Basement_Steps", ("Landing_", "Stair_"), "Basement_Render")
join("Basement_Walls", ("Stairwell_",), "Basement_Render")
join(
    "Frame_Moulding",
    ("Frame_Top", "Frame_Bottom", "Frame_Left", "Frame_Right"),
    "Frame_Display",
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
        export_extras=True,
    )


output = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
export(
    os.path.join(output, "gallery.glb"),
    ("Gallery_Render", "Gallery_Collision", "Gallery_Markers", "Gallery_Lights"),
)
export(os.path.join(output, "frame.glb"), ("Frame_Display",))
export(
    os.path.join(output, "basement.glb"), ("Basement_Render", "Basement_Collision")
)
