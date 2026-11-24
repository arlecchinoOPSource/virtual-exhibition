"""A heavy, weathered oak throne on a raised base, with a draped cloth.

Local frame: the chair faces -X (toward the cellar doorway), Y runs across
the seat and Z is up from the floor. All sizes are metres, set against a
seated adult: seat 0.46 m above the platform, arms 0.26 m above the seat.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from basement_surfaces import fbm, noise
from grim_reaper import Sculpture

PLATFORM = 0.14


class Member:
    """One straight piece of joinery; its grain runs along its longest side."""

    def __init__(self, lo, hi, worn=False):
        self.lo, self.hi = np.array(lo, float), np.array(hi, float)
        self.axis = int(np.argmax(self.hi - self.lo))
        self.worn = worn

    def contains(self, p, slack=0.012):
        return bool(np.all(p >= self.lo - slack) and np.all(p <= self.hi + slack))


def _block(name, member, collection, mat, chamfer):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    size = member.hi - member.lo
    for v in bm.verts:
        v.co = Vector(member.lo + (np.array(v.co) + 0.5) * size)
    # A small chamfer softens every arris and gives the wear somewhere to sit.
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=chamfer, segments=1, affect="EDGES")
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def build_throne(collection, oak, cloth, tx, ty, floor_z):
    """Build the chair parts (named Throne_*) and the cloth.

    Returns the joinery members (for the grain bake) and the collider box.
    """
    z0 = floor_z + PLATFORM
    seat_top = z0 + 0.46
    arm_top = seat_top + 0.26

    def m(x0, x1, y0, y1, za, zb, worn=False):
        return Member((tx + x0, ty + y0, za), (tx + x1, ty + y1, zb), worn)

    members = {
        # Raised base: a plinth with a stepped upper course.
        "Base": m(-0.4, 0.4, -0.6, 0.6, floor_z, floor_z + 0.09),
        "Base_Course": m(-0.36, 0.36, -0.55, 0.55, floor_z + 0.09, z0),
        "Seat": m(-0.32, 0.2, -0.34, 0.34, seat_top - 0.06, seat_top),
        "Back_Panel": m(0.2, 0.25, -0.25, 0.25, seat_top, z0 + 1.45),
        "Top_Rail": m(0.17, 0.29, -0.35, 0.35, z0 + 1.45, z0 + 1.55),
        "Back_Rail": m(0.17, 0.29, -0.25, 0.25, seat_top - 0.14, seat_top - 0.06),
        "Front_Stretcher": m(-0.3, -0.21, -0.25, 0.25, z0 + 0.1, z0 + 0.15),
    }
    for side, name in ((-1, "S"), (1, "N")):
        y0, y1 = sorted((side * 0.25, side * 0.34))
        members[f"Front_Post_{name}"] = m(-0.3, -0.21, y0, y1, z0, arm_top - 0.05)
        members[f"Back_Post_{name}"] = m(0.18, 0.28, y0, y1, z0, z0 + 1.62)
        a0, a1 = sorted((side * 0.235, side * 0.37))
        members[f"Arm_{name}"] = m(-0.37, 0.28, a0, a1, arm_top - 0.055, arm_top, worn=True)
        s0, s1 = sorted((side * 0.27, side * 0.32))
        members[f"Side_Stretcher_{name}"] = m(-0.21, 0.18, s0, s1, z0 + 0.12, z0 + 0.17)
    for name, member in members.items():
        _block(f"Throne_{name}", member, collection, oak, 0.01 if name.startswith("Base") else 0.006)

    # Carved upper extensions: a forked central spire and horn-like branches
    # rising from the back posts, all tapering to blunt points.
    carving = Sculpture()
    cx = tx + 0.235
    top = z0 + 1.55
    carving.tube([(cx, ty, top - 0.02), (cx, ty, top + 0.25), (cx + 0.004, ty, top + 0.5),
                  (cx, ty, top + 0.66)], [0.04, 0.034, 0.02, 0.006], 10)
    for side in (-1, 1):
        carving.tube([(cx, ty, top + 0.22), (cx, ty + side * 0.08, top + 0.36),
                      (cx, ty + side * 0.16, top + 0.5), (cx, ty + side * 0.19, top + 0.6)],
                     [0.026, 0.022, 0.014, 0.005], 10)
        post_y = ty + side * 0.295
        post_top = z0 + 1.62
        carving.tube([(cx, post_y, post_top - 0.02), (cx, post_y + side * 0.07, post_top + 0.16),
                      (cx, post_y + side * 0.18, post_top + 0.3),
                      (cx, post_y + side * 0.25, post_top + 0.42),
                      (cx, post_y + side * 0.27, post_top + 0.5)],
                     [0.05, 0.042, 0.03, 0.016, 0.006], 10)
        carving.tube([(cx, post_y + side * 0.09, post_top + 0.2),
                      (cx, post_y + side * 0.04, post_top + 0.34), (cx, post_y, post_top + 0.44)],
                     [0.022, 0.014, 0.005], 10)
        # Rounded finials crown the front posts, proud of the arm ends.
        carving.oval((tx - 0.31, ty + side * 0.3025, arm_top + 0.032), (0.042, 0.042, 0.036), 14)
    carving.object("Throne_Carving", oak, collection)

    _drape(collection, cloth, tx, ty, seat_top)
    collider = (tx - 0.4, tx + 0.4, ty - 0.62, ty + 0.62, floor_z, floor_z + 2.3)
    return list(members.values()), collider


def _drape(collection, mat, tx, ty, seat_top):
    """A heavy cloth laid on the seat, rolled over its front edge and hanging
    in folds that deepen toward a weighted hem. Folds only swing outward, so
    the cloth never passes into the legs behind it."""
    front = tx - 0.32
    gap = 0.005
    # Centre-line path in (x, z): across the seat, round the edge, then down.
    path = [(x, seat_top + gap) for x in np.linspace(tx + 0.12, front + 0.012, 10)]
    centre = (front + 0.012, seat_top - 0.012)
    radius = 0.012 + gap
    path += [(centre[0] + radius * math.cos(a), centre[1] + radius * math.sin(a))
             for a in np.linspace(math.pi / 2, math.pi, 8)[1:]]
    drops = 25
    path += [(front - gap, seat_top - 0.012 - 0.36 * t) for t in np.linspace(0, 1, drops + 1)[1:]]
    rows, columns = len(path), 34
    hang_start = rows - drops
    rng = np.random.default_rng(56)
    phases = rng.uniform(0, math.tau, 3)
    verts = []
    for r, (x, z) in enumerate(path):
        depth = max(0, r - hang_start + 1) / drops  # 0 on the seat, 1 at the hem
        for c in range(columns):
            v = c / (columns - 1) * 2 - 1
            y = ty + v * 0.23 * (1 + 0.08 * depth)
            # Two main pleats and a lesser one, swinging outward (-X).
            wave = (0.6 * math.sin(v * 7.5 + phases[0]) + 0.3 * math.sin(v * 13 + phases[1])
                    + 0.1 * math.sin(v * 23 + phases[2]))
            swing = 0.03 * depth ** 1.3 * (1 + wave)
            lift = 0.012 * depth ** 2 * (1 + math.sin(v * 7.5 + phases[0]))
            # Contact wrinkles where the cloth lies on the seat.
            ripple = 0.003 * max(0, math.sin(v * 18 + x * 60)) if depth == 0 else 0
            verts.append((x - swing, y, z + lift + ripple))
    faces = [(r * columns + c, r * columns + c + 1, (r + 1) * columns + c + 1, (r + 1) * columns + c)
             for r in range(rows - 1) for c in range(columns - 1)]
    mesh = bpy.data.meshes.new("Basement_Throne_Cloth")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new("Basement_Throne_Cloth", mesh)
    collection.objects.link(obj)
    # Faces point up on the seat and outward on the drop, so the thickness
    # grows away from the wood.
    solid = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
    solid.thickness = 0.004
    solid.offset = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # A rolled, weighted hem along the bottom edge.
    hem = Sculpture()
    hem.tube([Vector(verts[(rows - 1) * columns + c]) + Vector((-0.002, 0, 0.004))
              for c in range(columns)], [0.006] * columns, 8)
    hem.object("Basement_Throne_Hem", mat, collection)


def wood_shader(members):
    """Dark oiled oak: grain along each member, rubbed edges, polished arm
    fronts, scratches and small dents."""
    def shade(p, n):
        centre = p.mean(axis=0)
        member = next((mb for mb in members if mb.contains(centre)), None)
        # Carved branches and finials: the grain rises with the wood.
        axis = member.axis if member is not None else 2
        others = [i for i in range(3) if i != axis]
        stretched = p.copy()
        stretched[:, axis] *= 0.08
        warp = fbm(stretched, 3, 3, 61)
        ring = p[:, others[0]] * 38 + p[:, others[1]] * 23 + 4 * warp
        late = np.exp(-((ring % 1 - 0.5) / 0.14) ** 2)
        fibre = fbm(stretched, 40, 2, 62)
        tone = 0.9 + 0.2 * fbm(p, 2, 2, 63) - 0.25 * late - 0.08 * fibre
        color = np.array([0.24, 0.135, 0.07]) * tone[:, None]
        rough = 0.62 + 0.1 * late
        height = -0.0006 * late - 0.0003 * fibre

        if member is not None:
            # Rubbed edges: distance to the member's arrises in the face plane.
            normal_axis = int(np.argmax(np.abs(n)))
            edge = np.full(len(p), 1.0)
            if abs(n[normal_axis]) > 0.99:
                for i in range(3):
                    if i != normal_axis:
                        edge = np.minimum(edge, np.minimum(p[:, i] - member.lo[i], member.hi[i] - p[:, i]))
            else:
                edge[:] = 0  # chamfers are the arris itself
            wear = np.exp(-np.clip(edge, 0, None) / 0.012) * (0.6 + 0.4 * noise(p, 30, 64))
            if member.worn and n[2] > 0.9:
                # Hands polish the front of each arm.
                wear = np.maximum(wear, 0.7 * np.exp(-((p[:, 0] - member.lo[0] - 0.12) / 0.1) ** 2))
        else:
            wear = 0.5 * max(n[2], 0) * (0.5 + 0.5 * noise(p, 20, 65))
        worn = np.array([0.46, 0.3, 0.17])
        color = color * (1 - wear[:, None]) + worn * wear[:, None] * (0.85 + 0.15 * tone[:, None])
        rough = rough - 0.3 * wear

        # Scratches and dents in the dark finish.
        for k, freq in enumerate((5, 8)):
            line = np.abs(fbm(p * (1, 1.7, 0.6), freq, 2, 70 + k) - 0.5)
            scratch = (line < 0.0015) * (noise(p, 3, 72 + k) > 0.6)
            color = color + 0.05 * scratch[:, None]
            height = height - 0.0004 * scratch
        dent = noise(p, 45, 74) > 0.93
        height = height - 0.0008 * dent
        color = color * (1 - 0.15 * dent)[:, None]
        return color, rough, height
    return shade
