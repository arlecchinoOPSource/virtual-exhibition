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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gallery_finishes import frame_profile, oak_floor, paint_finish, paint_uv, soften, turned

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
LIGHT_INTENSITY = 6.5

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


FLOOR = material("Oiled oak", (0.35, 0.20, 0.09), 0.57)
WALLS = material("Warm white mineral paint", (0.79, 0.77, 0.73), 0.91)
paint_finish(WALLS)
DISPLAY = WALLS
CEILING = material("Ceiling white", (0.82, 0.81, 0.78), 0.94)
# Approximate diffuse ceiling bounce where the realtime renderer has no GI.
ceiling_shader = CEILING.node_tree.nodes["Principled BSDF"]
ceiling_shader.inputs["Emission Color"].default_value = (0.26, 0.25, 0.23, 1)
ceiling_shader.inputs["Emission Strength"].default_value = 1
FIXTURE = material("Fixture_Housing", (0.03, 0.03, 0.035), 0.5)
FRAME = material("Frame_Moulding", (0.04, 0.035, 0.03), 0.6)
FIXTURE.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.48
LENS = material("Recessed frosted lens", (0.85, 0.80, 0.68), 0.30)
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
    if mat == WALLS:
        paint_uv(obj)
        soften(obj, 0.007)
    return obj


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
    """Align the adjustable track head and its beam with the exhibit anchor."""
    gx, gy = GAZE[gaze]
    position = Vector((x - gx * LIGHT_THROW, y - gy * LIGHT_THROW, LIGHT_HEIGHT))
    aim = Vector((x, y, ANCHOR_HEIGHT)) - position
    name = f"Light_Gallery_{index:02}"
    data = bpy.data.lights.new(name, "SPOT")
    data.energy = LIGHT_INTENSITY
    data.spot_size = math.radians(68)
    data.spot_blend = 0.72
    data.color = (1.0, 0.95, 0.88)
    light = bpy.data.objects.new(name, data)
    light.location = position
    light.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    collections["Gallery_Lights"].objects.link(light)
    direction = aim.normalized()
    render = collections["Gallery_Render"]
    prefix = f"Fixture_Gallery_{index:02}"
    mount = position - direction * 0.12
    turned(prefix + "_Body", [(-0.19, 0.046), (-0.185, 0.053),
           (-0.15, 0.056), (-0.14, 0.052), (-0.13, 0.056),
           (-0.014, 0.056), (0, 0.058), (0.005, 0.054),
           (0.005, 0.047), (-0.009, 0.044)], position, direction, FIXTURE, render)
    turned(prefix + "_Lens", [(0, 0.043), (0.002, 0.043)], position-direction*0.008,
           direction, LENS, render)
    side = Vector((-gy, gx, 0))
    stem = mount + side * 0.065
    turned(prefix + "_Pivot", [(-0.068, 0.024), (0.076, 0.024)],
           mount, side, FIXTURE, render)
    box(prefix + "_Yoke", stem.x-0.013, stem.x+0.013, stem.y-0.013, stem.y+0.013,
        stem.z, HEIGHT-0.048, FIXTURE, collide=False)
    box(prefix + "_Adaptor", stem.x-0.048, stem.x+0.048, stem.y-0.048, stem.y+0.048,
        HEIGHT-0.075, HEIGHT-0.027, FIXTURE, collide=False)
    # One continuous rail per perimeter row and per island-facing row.
    if index in (1, 4, 7, 8, 11):
        if gx:
            box(prefix+"_Rail", -1.75, 1.75, -0.09, 0.09, HEIGHT-0.03, HEIGHT,
                FIXTURE, collide=False)
        else:
            box(prefix+"_Rail", -5.0, 5.0, stem.y-0.024, stem.y+0.024, HEIGHT-0.03,
                HEIGHT, FIXTURE, collide=False)


# Floor and ceiling. Nothing can reach the ceiling, so it needs no proxy.
floor = box("Floor", -10 - WALL, 10 + WALL, -5 - WALL, 5 + WALL, -WALL, 0, FLOOR)
oak_floor(floor, FLOOR)
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
frame_profile(collections["Frame_Display"], FRAME, w, h, d, b)
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
box("Stairwell_Ceiling", 10 + WALL, END_X, -1.0, 1.0, HEIGHT, HEIGHT + WALL, PLASTER, collide=False, collection="Basement_Render")


# The basement room: weathered concrete, damaged plaster, BLACK METAL graffiti,
# a wooden throne, an iron candle stand, and a bare bulb. Every mesh, letter,
# and texture colour here is original.
ROOM_X0, ROOM_X1, ROOM_Y, ROOM_H = END_X, END_X + 8, 4.0, 2.8
TOP = BOTTOM + ROOM_H
BRICK = material("Basement_Brick", (0.2, 0.07, 0.04), 0.95)
STAIN = material("Basement_Stain", (0.05, 0.045, 0.04), 1.0)
PAINT = material("Graffiti_Paint", (0.8, 0.79, 0.76), 0.85)
OAK = material("Throne_Wood", (0.13, 0.06, 0.025), 0.75)
WAX = material("Candle_Wax", (0.85, 0.8, 0.65), 0.6)


def glow(name, rgb, strength):
    mat = material(name, rgb, 0.4)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


FLAME = glow("Candle_Flame", (1.0, 0.55, 0.15), 6)
FILAMENT = glow("Bulb_Glass", (1.0, 0.85, 0.6), 8)


def point_light(name, x, y, z, energy, rgb):
    data = bpy.data.lights.new(name, "POINT")
    data.energy = energy
    data.color = rgb
    data.shadow_soft_size = 0.05
    light = bpy.data.objects.new(name, data)
    light.location = (x, y, z)
    collections["Basement_Render"].objects.link(light)


def prop(name, x0, x1, y0, y1, z0, z1, mat):
    box(name, x0, x1, y0, y1, z0, z1, mat, collide=False, collection="Basement_Render")


def solid(name, x0, x1, y0, y1, z0, z1):
    proxy = bpy.data.objects.new(name, box_mesh(name, (x1 - x0, y1 - y0, z1 - z0)))
    proxy.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    proxy.display_type = "WIRE"
    collections["Basement_Collision"].objects.link(proxy)


# Shell: floor, ceiling, and four walls, with a doorway from the stairwell.
box("Room_Floor", ROOM_X0, ROOM_X1, -ROOM_Y, ROOM_Y, BOTTOM - 0.2, BOTTOM, CONCRETE, **BASEMENT)
box("Room_Ceiling", ROOM_X0, ROOM_X1, -ROOM_Y, ROOM_Y, TOP, TOP + WALL, CONCRETE, collide=False, collection="Basement_Render")
box("Room_Wall_North", ROOM_X0, ROOM_X1, ROOM_Y, ROOM_Y + WALL, BOTTOM, TOP, PLASTER, **BASEMENT)
box("Room_Wall_South", ROOM_X0, ROOM_X1, -ROOM_Y - WALL, -ROOM_Y, BOTTOM, TOP, PLASTER, **BASEMENT)
box("Room_Wall_East", ROOM_X1, ROOM_X1 + WALL, -ROOM_Y, ROOM_Y, BOTTOM, TOP, PLASTER, **BASEMENT)
box("Room_Wall_West_North", ROOM_X0, ROOM_X0 + WALL, 0.8, ROOM_Y, BOTTOM, TOP, PLASTER, **BASEMENT)
box("Room_Wall_West_South", ROOM_X0, ROOM_X0 + WALL, -ROOM_Y, -0.8, BOTTOM, TOP, PLASTER, **BASEMENT)
box("Room_Wall_West_Lintel", ROOM_X0, ROOM_X0 + WALL, -1.0, 1.0, BOTTOM + 2.2, HEIGHT, PLASTER, collide=False, collection="Basement_Render")

# Weathering: brick showing through broken plaster, and floor stains.
for index, (x0, x1, z0, z1, side) in enumerate((
    (20.0, 21.1, -2.2, -1.5, 1), (23.4, 24.2, -1.4, -0.7, 1), (21.6, 22.8, -2.7, -2.1, -1),
    (25.0, 26.2, -1.9, -1.1, -1),
)):
    y = (ROOM_Y - 0.01) * side
    prop(f"Plaster_Damage_{index:02}", x0, x1, min(y, y - 0.02 * side), max(y, y - 0.02 * side), z0, z1, BRICK)
for index, (x, y, size) in enumerate(((21.2, 1.6, 1.3), (24.6, -1.8, 1.8), (22.4, -0.4, 0.8))):
    prop(f"Floor_Stain_{index:02}", x - size / 2, x + size / 2, y - size / 3, y + size / 3, BOTTOM, BOTTOM + 0.004, STAIN)

# Handwritten-style graffiti: sheared Blender-font lettering on the east wall.
graffiti_curve = bpy.data.curves.new("Graffiti_Black_Metal", "FONT")
graffiti_curve.body = "BLACK METAL"
graffiti_curve.size = 0.34
graffiti_curve.shear = 0.3
graffiti_curve.extrude = 0.004
graffiti_curve.align_x = "CENTER"
graffiti_curve.align_y = "CENTER"
graffiti_obj = bpy.data.objects.new("Graffiti_Black_Metal_Text", graffiti_curve)
scene.collection.objects.link(graffiti_obj)
graffiti_obj.location = (ROOM_X1 - 0.008, 0.2, BOTTOM + 2.5)
graffiti_obj.rotation_euler = (math.pi / 2, -0.06, -math.pi / 2)
bpy.context.view_layer.update()
graffiti_mesh = bpy.data.meshes.new_from_object(
    graffiti_obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
)
graffiti_mesh.materials.clear()
graffiti_mesh.materials.append(PAINT)
graffiti = bpy.data.objects.new("Graffiti_Black_Metal", graffiti_mesh)
graffiti.matrix_world = graffiti_obj.matrix_world
graffiti["text"] = graffiti_curve.body
collections["Basement_Render"].objects.link(graffiti)
bpy.data.objects.remove(graffiti_obj)

# Wooden throne against the east wall, facing the doorway.
tx, ty = ROOM_X1 - 0.75, 0.0
prop("Throne_Seat", tx - 0.35, tx + 0.35, ty - 0.4, ty + 0.4, BOTTOM + 0.45, BOTTOM + 0.55, OAK)
prop("Throne_Back", tx + 0.25, tx + 0.35, ty - 0.4, ty + 0.4, BOTTOM + 0.55, BOTTOM + 2.0, OAK)
for side in (-1, 1):
    prop(f"Throne_Arm_{'N' if side > 0 else 'S'}", tx - 0.35, tx + 0.25, ty + side * 0.4 - 0.05, ty + side * 0.4 + 0.05, BOTTOM + 0.75, BOTTOM + 0.85, OAK)
    for ex in (-0.3, 0.3):
        prop(f"Throne_Leg_{side}_{ex}", tx + ex - 0.05, tx + ex + 0.05, ty + side * 0.35 - 0.05, ty + side * 0.35 + 0.05, BOTTOM, BOTTOM + 0.85, OAK)
for index, offset in enumerate((-0.3, 0, 0.3)):
    prop(f"Throne_Spire_{index}", tx + 0.26, tx + 0.34, ty + offset - 0.04, ty + offset + 0.04, BOTTOM + 2.0, BOTTOM + 2.25 + 0.1 * (offset == 0), OAK)
solid("COL_Throne", tx - 0.4, tx + 0.4, ty - 0.5, ty + 0.5, BOTTOM, BOTTOM + 2.3)

# Iron candle stand with five candles and a warm point light.
cx, cy = ROOM_X1 - 2.2, 2.6
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.22, depth=0.04, location=(cx, cy, BOTTOM + 0.02))
stand_parts = [bpy.context.active_object]
bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.025, depth=1.3, location=(cx, cy, BOTTOM + 0.67))
stand_parts.append(bpy.context.active_object)
bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.015, location=(cx, cy, BOTTOM + 1.32))
stand_parts.append(bpy.context.active_object)
for index, obj in enumerate(stand_parts):
    obj.name = f"Candle_Stand_{index}"
    obj.data.materials.append(IRON)
    for owner in obj.users_collection:
        owner.objects.unlink(obj)
    collections["Basement_Render"].objects.link(obj)
for index in range(5):
    angle = index * 2 * math.pi / 5
    x, y = cx + 0.2 * math.cos(angle), cy + 0.2 * math.sin(angle)
    prop(f"Candle_Wax_{index}", x - 0.02, x + 0.02, y - 0.02, y + 0.02, BOTTOM + 1.33, BOTTOM + 1.45 + 0.03 * (index % 2), WAX)
    prop(f"Candle_Flame_{index}", x - 0.008, x + 0.008, y - 0.008, y + 0.008, BOTTOM + 1.46 + 0.03 * (index % 2), BOTTOM + 1.5 + 0.03 * (index % 2), FLAME)
point_light("Light_Basement_Candles", cx, cy, BOTTOM + 1.6, 1.6, (1.0, 0.6, 0.3))
solid("COL_Candle_Stand", cx - 0.25, cx + 0.25, cy - 0.25, cy + 0.25, BOTTOM, BOTTOM + 1.5)

# Bare bulbs on cords: one over the room and one over the stairs.
for name, x, y, ceiling, drop, energy in (
    ("Room", 22.6, 0.0, TOP, 0.7, 5.0),
    ("Stairs", STAIR_X + 2.4, 0.0, HEIGHT, 1.2, 4.0),
):
    bulb_z = ceiling - drop
    prop(f"Bulb_Cord_{name}", x - 0.005, x + 0.005, y - 0.005, y + 0.005, bulb_z + 0.06, ceiling, IRON)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.05, location=(x, y, bulb_z))
    bulb = bpy.context.active_object
    bulb.name = f"Bulb_{name}"
    bulb.data.materials.append(FILAMENT)
    for owner in bulb.users_collection:
        owner.objects.unlink(bulb)
    collections["Basement_Render"].objects.link(bulb)
    point_light(f"Light_Basement_Bulb_{name}", x, y, bulb_z - 0.08, energy, (1.0, 0.82, 0.55))


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
join("Basement_Walls", ("Stairwell_", "Room_Wall_"), "Basement_Render")
join("Basement_Shell", ("Room_Floor", "Room_Ceiling"), "Basement_Render")
join("Basement_Weathering", ("Plaster_Damage_",), "Basement_Render")
join("Basement_Stains", ("Floor_Stain_",), "Basement_Render")
join("Basement_Throne", ("Throne_",), "Basement_Render")
join("Basement_Candle_Stand", ("Candle_Stand_", "Bulb_Cord_"), "Basement_Render")
join("Basement_Candles", ("Candle_Wax_",), "Basement_Render")
join("Basement_Flames", ("Candle_Flame_",), "Basement_Render")
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
