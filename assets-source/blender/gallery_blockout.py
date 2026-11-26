"""Build the approved main gallery blockout and its display frame as GLBs.

Run from the repository root:

    blender --background --factory-startup \
        --python assets-source/blender/gallery_blockout.py -- public/models

This writes gallery.glb (room, collision proxies, markers, and lights),
frame.glb (the reusable display frame), and basement.glb (loaded on demand). Exhibit
artwork stays out of every export; the basement's two historical prints are
baked into basement.glb (posters.py, public/models/CREDITS.md).

Units are meters with Z up. The shell follows the accepted plan in
assets-source/layout/redesign.json (docs/DESIGN.md): a 24.0 x 16.5 m
interior, x -14..10 and y -9..7.5, with the south-east corner cut away and a
3.6 m ceiling. The visitor spawns inside an enclosed elevator car behind the
west wall (-X), whose doors slide open onto the central band when the walk
starts. The basement opening is in the east wall (+X) at x = 10, where it has
always been, so the basement keeps its world transform.

Every marker's local +Y axis points the way a visitor looks: forward at the
spawn and into the display surface at an exhibit anchor. After the glTF Y-up
conversion that axis becomes the node's local -Z, matching a Three.js camera.
The frame is modeled with its back at the origin and its front facing -Y, so
it faces the walkway when attached to an anchor.

Light energy is exported raw: each spot's Blender energy becomes the
Three.js intensity in candela.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from grim_reaper import Sculpture, sculpt_reaper
from sign_lettering import build_sign
from basement_surfaces import Cellar, bake_atlas, paint_graffiti, stair_surface
from throne import build_throne, wood_shader
from candle_stand import build_candle_stand
from posters import hang_poster
from radio import build_radio
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


FLOOR = material("Lacquered oak parquet", (0.45, 0.27, 0.12), 0.2)
WALLS = material("Warm white mineral paint", (0.79, 0.77, 0.73), 0.91)
paint_finish(WALLS)
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


def marker(name, x, y, z, gaze, collection="Gallery_Markers"):
    """Add an empty whose +Y points along gaze: 'N', 'S', 'E', or 'W'."""
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "SINGLE_ARROW"
    empty.location = (x, y, z)
    empty.rotation_euler = (
        0,
        0,
        {"N": 0, "S": math.pi, "E": -math.pi / 2, "W": math.pi / 2}[gaze],
    )
    collections[collection].objects.link(empty)


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
    # A short length of ceiling track over each head, parallel to its wall.
    rx, ry = (0.024, 0.6) if gx else (0.6, 0.024)
    box(prefix + "_Rail", stem.x-rx, stem.x+rx, stem.y-ry, stem.y+ry, HEIGHT-0.03,
        HEIGHT, FIXTURE, collide=False)


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


# The measured shell from the accepted plan (docs/DESIGN.md, issue #86).
# Rectangles there are [x0, x1, y0, y1] in these same Blender coordinates.
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "layout",
                       "redesign.json")) as plan_file:
    PLAN = json.load(plan_file)
FOOT_X0, FOOT_X1, FOOT_Y0, FOOT_Y1 = -14 - WALL, 10 + WALL, -9 - WALL, 7.5 + WALL
# The south-east corner outside the building: no parquet is laid there.
NOTCH = (4 + WALL, 10 + WALL, -9 - WALL, -2 - WALL)

# Floor and ceiling, each in two parts that leave out the cut-away corner,
# where the basement stairs now descend under their own ceiling. Nothing can
# reach the ceiling, so it needs no proxy.
for z0, z1, mat, name in ((-WALL, 0, FLOOR, "Floor"), (HEIGHT, HEIGHT + WALL, CEILING, "Ceiling")):
    box(f"{name}_North", FOOT_X0, FOOT_X1, NOTCH[3], FOOT_Y1, z0, z1, mat, collide=name == "Floor")
    box(f"{name}_South", FOOT_X0, NOTCH[0], FOOT_Y0, NOTCH[3], z0, z1, mat, collide=name == "Floor")
    join(name, (f"{name}_North", f"{name}_South"), "Gallery_Render")
oak_floor(bpy.data.objects["Floor"], FLOOR, exclude=(NOTCH,))

# The arrival elevator: an enclosed car behind the west wall where the visitor
# spawns. Its walls, handrail, door surround and leaves share one satin steel
# (only lightly metallic: the scene has no environment map to reflect), and
# the whole ceiling is a lit panel. Three materials keep it to three draws.
ELEVATOR = PLAN["elevator"]
car_x0, car_x1, car_y0, car_y1 = ELEVATOR["car"]
CAR_HEIGHT = ELEVATOR["car_height"]
_, _, door_y0, door_y1 = ELEVATOR["doors"]
DOOR_HEIGHT = ELEVATOR["door_height"]
PANEL = material("Elevator satin steel", (0.6, 0.59, 0.56), 0.36)
PANEL.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.3
CAR_FLOOR = material("Elevator floor stone", (0.15, 0.14, 0.13), 0.55)
CAR_LIGHT = material("Elevator ceiling light", (0.95, 0.92, 0.86), 0.6)
car_light = CAR_LIGHT.node_tree.nodes["Principled BSDF"]
car_light.inputs["Emission Color"].default_value = (1.0, 0.93, 0.82, 1)
car_light.inputs["Emission Strength"].default_value = 0.9

# Outer walls and full-height partitions. The street's north wall carries a
# 0.4 m furring wall that #95 dresses as shallow facades; frames 04 and 05
# hang on its face. The car's walls stop just above its ceiling.
for wall in PLAN["walls"]:
    if wall["id"].startswith(("Stairwell_", "Room_")):
        continue
    if wall["id"].startswith("Elevator_"):
        box(wall["id"], *wall["rect"], 0, CAR_HEIGHT + 0.1, PANEL)
    else:
        box(wall["id"], *wall["rect"], 0, HEIGHT, WALLS)
facade = next(item for item in PLAN["furniture"] if item["id"] == "Street_Facades")
box("Street_Facade_Base", *facade["rect"], 0, HEIGHT, WALLS)
bx0, bx1, by0, by1 = PLAN["basement_door"]["opening"]
box("Wall_Notch_Lintel", bx0, bx1, by0, by1, 2.4, HEIGHT, WALLS)
box("Wall_West_Lintel", -14 - WALL, -14, door_y0, door_y1, DOOR_HEIGHT, HEIGHT, WALLS)

box("Elevator_Floor", car_x0 - 0.1, car_x1, car_y0 - 0.1, car_y1 + 0.1, -WALL, 0, CAR_FLOOR)
box("Elevator_Ceiling", car_x0 - 0.1, car_x1, car_y0 - 0.1, car_y1 + 0.1, CAR_HEIGHT,
    CAR_HEIGHT + 0.1, CAR_LIGHT, collide=False)
car_middle = (car_y0 + car_y1) / 2
box("Elevator_Handrail", car_x0, car_x0 + 0.04, car_middle - 0.75, car_middle + 0.75, 0.88,
    0.92, PANEL, collide=False)
for name, y0, y1 in (("South", door_y0 - 0.12, door_y0), ("North", door_y1, door_y1 + 0.12)):
    box(f"Elevator_Surround_{name}", -14, -13.97, y0, y1, 0, DOOR_HEIGHT + 0.12, PANEL,
        collide=False)
box("Elevator_Surround_Head", -14, -13.97, door_y0 - 0.12, door_y1 + 0.12, DOOR_HEIGHT,
    DOOR_HEIGHT + 0.12, PANEL, collide=False)
# Inside the car: the front wall around the doorway in the same steel, a call
# panel beside the door and a lit floor indicator over it.
for name, y0, y1 in (("South", car_y0, door_y0), ("North", door_y1, car_y1)):
    box(f"Elevator_Front_{name}", car_x1 - 0.04, car_x1, y0, y1, 0, CAR_HEIGHT, PANEL,
        collide=False)
box("Elevator_Front_Head", car_x1 - 0.04, car_x1, door_y0, door_y1, DOOR_HEIGHT, CAR_HEIGHT,
    PANEL, collide=False)
box("Elevator_Panel", car_x1 - 0.5, car_x1 - 0.2, car_y1 - 0.025, car_y1, 1.0, 1.45, PANEL,
    collide=False)
for index, z in enumerate((1.12, 1.26)):
    box(f"Elevator_Button_{index}", car_x1 - 0.37, car_x1 - 0.33, car_y1 - 0.035,
        car_y1 - 0.025, z, z + 0.04, CAR_LIGHT, collide=False)
box("Elevator_Indicator", car_x1 - 0.055, car_x1 - 0.04, car_middle - 0.16, car_middle + 0.16,
    DOOR_HEIGHT + 0.05,
    DOOR_HEIGHT + 0.12, CAR_LIGHT, collide=False)
# Two leaves inside the wall's thickness, meeting on the axis. Each slides its
# own width into the wall beside it (src/environments/elevator.ts), where the
# wall hides it; COL_Elevator_Doors holds the visitor in the car until then.
middle = (door_y0 + door_y1) / 2
for name, y0, y1 in (("South", door_y0, middle), ("North", middle, door_y1)):
    box(f"Elevator_Door_{name}", -14.14, -14.06, y0, y1, 0, DOOR_HEIGHT, PANEL, collide=False)
proxy = bpy.data.objects.new("COL_Elevator_Doors",
                             box_mesh("COL_Elevator_Doors", (WALL, door_y1 - door_y0, DOOR_HEIGHT)))
proxy.location = (-14 - WALL / 2, middle, DOOR_HEIGHT / 2)
proxy.display_type = "WIRE"
collections["Gallery_Collision"].objects.link(proxy)

# Studio props from the asset register (docs/ASSET_REGISTER.md). Each comes
# from its untouched original in assets-source/third-party/<id>/ and must fit
# its plan envelope; third_party.py prints its measures for the register.
from third_party import import_prop
easel_rect = next(item["rect"] for item in PLAN["furniture"] if item["id"] == "Studio_Easel")
easel, easel_measures = import_prop(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "third-party", "2ZP3o8hyPA",
                 "art-easel-set-up.glb"),
    "Studio_Easel", collections["Gallery_Render"], easel_rect, height=1.85, turn_deg=-90)
print("THIRD_PARTY Studio_Easel", easel_measures)
ex0, ex1, ey0, ey1 = easel_measures["bounds"]
proxy = bpy.data.objects.new("COL_Studio_Easel", box_mesh("COL_Studio_Easel", (ex1 - ex0, ey1 - ey0, 1.85)))
proxy.location = ((ex0 + ex1) / 2, (ey0 + ey1) / 2, 1.85 / 2)
proxy.display_type = "WIRE"
collections["Gallery_Collision"].objects.link(proxy)
# Basement entrance in the right end wall: a hinged door, its frame, a sign,
# and a statue. The door collider is a separate proxy the engine toggles.
# The basement and its entrance are modelled in their original frame (door in
# an east wall at x = 10, stairs running east) and then placed by the plan's
# basement_transform: a quarter turn and a move that put the door in the cut-
# away corner's north wall with the stairs running south.
turn = PLAN["basement_transform"]
PLACE = (Matrix.Translation(Vector(turn["translate"]))
         @ Matrix.Rotation(math.radians(turn["rotate_z_deg"]), 4, "Z"))


def place(objects):
    """Move top-level objects by PLACE. Collision proxies take the move in
    their vertices instead, so they stay unrotated, axis-aligned boxes."""
    # New objects' world matrices are stale until the view layer updates.
    bpy.context.view_layer.update()
    for obj in objects:
        if obj.parent is not None:
            continue
        if obj.name.startswith("COL_"):
            obj.data.transform(PLACE @ obj.matrix_world)
            obj.matrix_world = Matrix.Identity(4)
        else:
            obj.matrix_world = PLACE @ obj.matrix_world


entrance_before = set(bpy.data.objects.keys())
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

# Sign: original raised lettering on a spiked iron board that stands off the
# wall on four bolts, centred over the opening and facing the gallery (-X).
SIGN_IRON = material("Sign_Iron", (0.05, 0.048, 0.046), 0.55)
SIGN_IRON.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.6
build_sign(collections["Gallery_Render"], SIGN_IRON, BONE, 10, 2.96, 1.75, "BASEMENT OF DOOM")

# An original Grim Reaper statue on a plinth beside the south door jamb. The
# door swings outwards into the stairwell, so the statue never blocks it.
sx, sy = 9.5, -1.5
box("Statue_Plinth", sx - 0.35, sx + 0.35, sy - 0.35, sy + 0.35, 0, 0.4, IRON, collide=False)
STATUE_BONE = material("Aged ivory bone", (0.46, 0.37, 0.24), 0.83)
BLADE.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.66
CLOTH.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.23
HOOD_SHADOW = material("Statue_Hood_Shadow", (0, 0, 0), 1.0)
HOOD_SHADOW.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0
sculpt_reaper(collections["Gallery_Render"], sx, sy, CLOTH, STATUE_BONE, WOOD, BLADE, HOOD_SHADOW)
proxy = bpy.data.objects.new("COL_Statue", box_mesh("COL_Statue", (0.7, 0.7, 2.4)))
proxy.location = (sx, sy, 1.2)
proxy.display_type = "WIRE"
collections["Gallery_Collision"].objects.link(proxy)
# Place the entrance. The hinge sits on a turned mount so the door module's
# local swing about Y still starts from zero.
entrance = [bpy.data.objects[name] for name in set(bpy.data.objects.keys()) - entrance_before]
mount = bpy.data.objects.new("Door_Basement_Mount", None)
mount.matrix_world = PLACE
collections["Gallery_Markers"].objects.link(mount)
hinge.parent = mount
place(obj for obj in entrance if obj is not hinge)

# The catalogue stand beside the arrival axis. It is modelled at the origin
# with its reader on the west side; a quarter turn puts the reader on the
# north side, facing south across the stand, at the plan's position.
from lectern import build_lectern
build_lectern(box, material, collections["Gallery_Render"])
lx0, lx1, ly0, ly1 = PLAN["lectern"]["rect"]
lectern_at = Vector(((lx0 + lx1) / 2, (ly0 + ly1) / 2, 0))
turn = Matrix.Translation(lectern_at) @ Matrix.Rotation(-math.pi / 2, 4, "Z")
for obj in collections["Gallery_Render"].objects:
    if obj.name.startswith(("Lectern_", "Catalogue_")):
        obj.matrix_world = turn @ obj.matrix_world
# Collision proxies stay axis-aligned, so the clearance box is rebuilt turned.
clearance = bpy.data.objects["COL_Lectern_Clearance"]
clearance.data = box_mesh("COL_Lectern_Clearance", (lx1 - lx0, ly1 - ly0, 1.2))
clearance.location = lectern_at + Vector((0, 0, 0.6))

spawn = PLAN["spawn"]
marker("Spawn_Gallery", *spawn["at"], 0, spawn["gaze"])

# The fifteen upstairs slots, three per section, numbered in walking order.
# Basement slots 16-18 export with basement.glb (below).
for frame in PLAN["frames"]:
    if frame["section"] == "basement":
        continue
    index = int(frame["slot"].split("_")[1])
    x, y = frame["at"]
    marker(frame["slot"], x, y, ANCHOR_HEIGHT, frame["gaze"])
    gallery_light(index, x, y, frame["gaze"])

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
# The boxes above stay as colliders; the visible flight is a clean surface of
# treads and risers, so no buried box faces take up texture space.
for obj in [o for o in collections["Basement_Render"].objects if o.name.startswith(("Landing_", "Stair_"))]:
    bpy.data.objects.remove(obj)
stair_surface("Basement_Steps", CONCRETE, collections["Basement_Render"],
              10 + WALL, STAIR_X, RUN, RISE, STEPS, END_X, -0.8, 0.8)
for side, y0, y1 in (("North", 0.8, 1.0), ("South", -1.0, -0.8)):
    box(f"Stairwell_Wall_{side}", 10 + WALL, END_X, y0, y1, BOTTOM, HEIGHT, PLASTER, **BASEMENT)
box("Stairwell_Ceiling", 10 + WALL, END_X, -1.0, 1.0, HEIGHT, HEIGHT + WALL, PLASTER, collide=False, collection="Basement_Render")


# The basement room: weathered concrete, damaged plaster, BLACK METAL graffiti,
# a wooden throne, an iron candle stand, and a bare bulb. Every mesh, letter,
# and texture colour here is original.
ROOM_X0, ROOM_X1, ROOM_Y, ROOM_H = END_X, END_X + 8, 4.0, 2.8
TOP = BOTTOM + ROOM_H
OAK = material("Throne_Wood", (0.13, 0.06, 0.025), 0.75)
WAX = material("Candle_Wax", (0.5, 0.42, 0.3), 0.7)


def glow(name, rgb, strength):
    mat = material(name, rgb, 0.4)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


FLAME = glow("Candle_Flame", (1.0, 0.55, 0.15), 6)
FILAMENT = glow("Bulb_Filament", (1.0, 0.78, 0.45), 12)
# Clear, slightly smoky glass that glows faintly; the filament shows through.
GLASS = glow("Bulb_Glass", (1.0, 0.8, 0.55), 0.9)
GLASS.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.45
GLASS.surface_render_method = "BLENDED"
BAKELITE = material("Bulb_Socket", (0.025, 0.018, 0.014), 0.5)


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

# Weathering is baked into the shell textures; see basement_surfaces.py.

# BLACK METAL graffiti is painted after the cellar surfaces; see below.

# A decrepit oak throne on a raised base against the east wall, facing the
# doorway, with a dusty cloth. The collider covers the base so it cannot be climbed.
tx, ty = ROOM_X1 - 0.75, 0.0
# Faded, dusty wool: fully matte; the dye and dust live in vertex colour.
THRONE_CLOTH = material("Throne_Cloth", (0.1, 0.04, 0.035), 0.95)
throne_members, throne_box = build_throne(collections["Basement_Render"], OAK, THRONE_CLOTH, tx, ty, BOTTOM)
solid("COL_Throne", *throne_box)

# Wrought-iron candle stand with five burnt-down candles, lit by one shared
# point light at the flames (no per-candle lights).
cx, cy = ROOM_X1 - 2.2, 2.6
CANDLE_IRON = material("Candle_Iron", (0.02, 0.02, 0.02), 0.55)
iron_shader = CANDLE_IRON.node_tree.nodes["Principled BSDF"]
iron_shader.inputs["Metallic"].default_value = 0.7
patina = CANDLE_IRON.node_tree.nodes.new("ShaderNodeVertexColor")
patina.layer_name = "Patina"
CANDLE_IRON.node_tree.links.new(patina.outputs["Color"], iron_shader.inputs["Base Color"])
flame_centre, stand_box = build_candle_stand(collections["Basement_Render"], CANDLE_IRON, WAX, FLAME, cx, cy, BOTTOM)
# Kept low so the candles flicker beside the bulb rather than compete with it.
point_light("Light_Basement_Candles", *flame_centre, 0.6, (1.0, 0.55, 0.25))
solid("COL_Candle_Stand", *stand_box)

# A vintage valve radio on a side table in the south-east corner: clear of
# the walking route, the throne, the graffiti above and the Doré print, and
# turned toward the middle of the room. See radio.py for the node contract.
radio_table, radio_box = build_radio(collections["Basement_Render"], ROOM_X1 - 0.4, -ROOM_Y + 0.32,
                                     BOTTOM, 205)
solid("COL_Radio_Table", *radio_box)

# Bare incandescent bulbs on cloth cords: one over the room, nudged toward
# the throne for a little fill there, and one high over the stairs so the
# steps read in both directions. Both are weak and warm.
for name, x, y, ceiling, drop, energy in (
    ("Room", 23.4, 0.0, TOP, 0.75, 3.0),
    ("Stairs", STAIR_X + 2.4, 0.0, HEIGHT, 1.2, 2.6),
):
    bulb_z = ceiling - drop
    cord, socket, glass, filament = Sculpture(), Sculpture(), Sculpture(), Sculpture()
    cord.tube([(x, y, ceiling), (x + 0.004, y, bulb_z + 0.12), (x, y, bulb_z + 0.09)], [0.004] * 3, 6)
    socket.tube([(x, y, bulb_z + 0.095), (x, y, bulb_z + 0.04)], [0.016, 0.018], 10)
    # Pear-shaped glass: a narrow neck swelling to a round bowl.
    glass.rings([[(x + r * math.cos(a), y + r * math.sin(a), bulb_z + h)
                  for a in (k * math.tau / 14 for k in range(14))]
                 for h, r in ((0.042, 0.013), (0.025, 0.016), (0.008, 0.026), (-0.012, 0.031),
                              (-0.032, 0.029), (-0.048, 0.019), (-0.056, 0.006))])
    # A looped filament between two lead wires, the brightest thing in the room.
    filament.tube([(x - 0.006, y, bulb_z + 0.03), (x - 0.008, y, bulb_z - 0.012),
                   (x - 0.004, y + 0.006, bulb_z - 0.02), (x + 0.004, y - 0.006, bulb_z - 0.02),
                   (x + 0.008, y, bulb_z - 0.012), (x + 0.006, y, bulb_z + 0.03)], [0.0015] * 6, 5)
    cord.object(f"Bulb_Cord_{name}", IRON, collections["Basement_Render"])
    socket.object(f"Bulb_Socket_{name}", BAKELITE, collections["Basement_Render"])
    glass.object(f"Bulb_{name}", GLASS, collections["Basement_Render"])
    filament.object(f"Bulb_Filament_{name}", FILAMENT, collections["Basement_Render"])
    point_light(f"Light_Basement_Bulb_{name}", x, y, bulb_z - 0.02, energy, (1.0, 0.7, 0.4))




# COL_ proxies stay separate: the engine needs one box per collider.
join("Gallery_Walls", ("Wall_", "Partition_", "Street_Facade_"), "Gallery_Render")
# The leaves stay separate so they can slide; the rest of the car is one mesh.
join("Elevator_Car", ("Elevator_Wall_", "Elevator_Floor", "Elevator_Ceiling",
                      "Elevator_Handrail", "Elevator_Surround_", "Elevator_Front_",
                      "Elevator_Panel", "Elevator_Button_", "Elevator_Indicator"),
     "Gallery_Render")
join("Lectern_Woodwork", ("Lectern_",), "Gallery_Render")
join("Gallery_Fixtures", ("Fixture_Gallery_",), "Gallery_Render")
join("Door_Frame", ("Door_Frame_", "Statue_Plinth"), "Gallery_Render")

def export(path, collection_names, image_format="AUTO"):
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
        export_image_format=image_format,
        export_jpeg_quality=82,
    )


output = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "."
export(
    os.path.join(output, "gallery.glb"),
    ("Gallery_Render", "Gallery_Collision", "Gallery_Markers", "Gallery_Lights"),
    "JPEG",
)
if "--gallery-only" in sys.argv:
    sys.exit(0)

join("Basement_Walls", ("Stairwell_", "Room_Wall_"), "Basement_Render")
join("Basement_Shell", ("Room_Floor", "Room_Ceiling", "Basement_Steps"), "Basement_Render")
join("Basement_Throne", ("Throne_",), "Basement_Render")
join("Basement_Candle_Stand", ("Candle_Stand_",), "Basement_Render")
join("Basement_Bulb_Cords", ("Bulb_Cord_", "Bulb_Socket_"), "Basement_Render")
join("Basement_Filaments", ("Bulb_Filament_",), "Basement_Render")
join("Basement_Candles", ("Candle_Wax_",), "Basement_Render")
join("Basement_Flames", ("Candle_Flame_",), "Basement_Render")

# Unique weathered atlases for the cellar plaster and concrete.
cellar = Cellar(
    room=((ROOM_X0 + WALL, -ROOM_Y, BOTTOM), (ROOM_X1, ROOM_Y, TOP)),
    stairwell=((10 + WALL, -0.8, BOTTOM - 0.01), (ROOM_X0 + WALL, 0.8, HEIGHT)),
    stair_x=STAIR_X, lower_x=LOWER_X, stair_top=0.0, floor_z=BOTTOM, ceiling_z=TOP,
    throne=(tx, ty), candles=(cx, cy),
)
# Baked contact shadow where the throne base and the stand's feet meet the floor.
cellar.contacts = [("rect", throne_box[0], throne_box[1], throne_box[2], throne_box[3]),
                   ("circle", cx, cy, 0.22), ("rect", *radio_table)]
bake_atlas(bpy.data.objects["Basement_Walls"], PLASTER, "Basement plaster", 2048, cellar.inside, cellar.plaster)
bake_atlas(bpy.data.objects["Basement_Shell"], CONCRETE, "Basement concrete", 2048, cellar.inside, cellar.concrete)
bake_atlas(bpy.data.objects["Basement_Throne"], OAK, "Throne oak", 1024,
           lambda q: q[2] > BOTTOM, wood_shader(throne_members), ppm=300)
# Hand-sprayed on the south half of the east wall, facing the doorway and clear
# of the throne, the damp trail on the north half and the candle stand.
paint_graffiti(cellar, "Graffiti_Black_Metal", collections["Basement_Render"],
               ROOM_X1, -2.15, BOTTOM + 1.75, 2.3, 1.5, "BLACK METAL")
# Two historical prints on the long side walls, near the room bulb and clear
# of the corners (left for the radio, #60): Kittelsen's lur player on the
# north wall west of the candle stand, Doré's Death on the south wall facing it.
hang_poster(collections["Basement_Render"], "Poster_Kittelsen_Lur",
            "kittelsen-op-under-fjeldet-toner-en-lur.webp",
            (22.3, ROOM_Y, BOTTOM + 1.6), (0, -1), 1.2, margin=0.06, seed=1,
            curl_corner=(-1, 1))
hang_poster(collections["Basement_Render"], "Poster_Dore_Pale_Horse",
            "dore-death-on-the-pale-horse.jpg",
            (23.4, -ROOM_Y, BOTTOM + 1.6), (0, 1), 1.64, margin=0.06, seed=2, curl_corner=(1, 1),
            # The engraved plate only: no scanned page edge or printed caption.
            crop=(8, 12, 760, 961))

# Turn and move the finished basement into place (see PLACE above).
place(list(collections["Basement_Render"].objects) + list(collections["Basement_Collision"].objects))
# The basement's three frame slots (#88), already in world coordinates in the
# plan, so they are added after the move. They export with basement.glb and
# are hung only once it loads.
for frame in PLAN["frames"]:
    if frame["section"] == "basement":
        marker(frame["slot"], *frame["at"], BOTTOM + ANCHOR_HEIGHT, frame["gaze"], "Basement_Render")

export(os.path.join(output, "frame.glb"), ("Frame_Display",))
export(
    os.path.join(output, "basement.glb"), ("Basement_Render", "Basement_Collision"), "JPEG"
)
