"""A vintage tabletop valve radio on a small side table (#60).

The design is original and generic: an arched walnut cabinet with fretwork
over dark grille cloth, a brass-framed dial strip with an invented frequency
scale, two fluted knobs, a chicken-head power switch, and a jewel pilot lamp.
It is modelled at real scale with the cabinet front facing local -Y.

Node contract for playback (#61). Names survive export; read world
transforms after the basement loads.

  Radio_Basement            root empty; every radio part is its child
  Radio_Basement_Power      chicken-head switch, the click/E target
  Radio_Basement_Emitter    empty 2 cm in front of the grille centre
  Radio_Basement_Status     pilot lamp; own material Radio_Status_Lamp
  Radio_Basement_Dial       dial strip; own material Radio_Dial_Face
  Radio_Basement_Knob_Volume, Radio_Basement_Knob_Tuning

The lamp and dial materials export with no emission, so the set reads as off;
#61 lights them by setting the materials' emissive colour. Each knob and the
switch has its origin on its shaft, so it turns in place about its local Z
axis in Three.js (local Y in Blender).
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from basement_surfaces import fbm, noise
from grim_reaper import Sculpture

WIDTH, DEPTH = 0.40, 0.20
PLINTH, SHOULDER, ARCH = 0.018, 0.19, 0.12
FRONT = -DEPTH / 2
DIAL_Z, KNOB_Z = 0.105, 0.048


def material(name, rgb, roughness, metallic=0.0, wear=False):
    # A second set (the living room's) reuses the first set's materials, so
    # the names in the node contract hold for both.
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if wear:
        tint = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        tint.layer_name = "Wear"
        mat.node_tree.links.new(tint.outputs["Color"], shader.inputs["Base Color"])
    return mat


class Part:
    """Closed solids gathered into one mesh."""

    def __init__(self):
        self.bm = bmesh.new()

    def solid(self, outline, y0, y1, back=None):
        """Extrude an (x, z) outline from y0 (front) to y1; back may differ."""
        back = back or outline
        f = [self.bm.verts.new((x, y0, z)) for x, z in outline]
        b = [self.bm.verts.new((x, y1, z)) for x, z in back]
        self.bm.faces.new(f)
        self.bm.faces.new(b[::-1])
        n = len(f)
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((f[i], f[j], b[j], b[i]))

    def bevel(self, width, segments=2):
        """Round the sharp edges of everything added so far; later parts stay crisp."""
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        sharp = [e for e in self.bm.edges if len(e.link_faces) == 2
                 and e.link_faces[0].normal.angle(e.link_faces[1].normal) > math.radians(40)]
        bmesh.ops.bevel(self.bm, geom=sharp, offset=width, segments=segments, profile=0.5,
                        affect="EDGES", clamp_overlap=True)

    def bar(self, a, b, width, y0, y1, overlap=0.0):
        """A flat strip from a to b in the (x, z) plane, optionally run past both ends."""
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized()
        a, b = a - d * overlap, b + d * overlap
        n = Vector((-d.y, d.x)) * width / 2
        self.solid([tuple(p) for p in (a - n, b - n, b + n, a + n)], y0, y1)

    def rail(self, points, width, y0, y1):
        """Strips around a closed polyline; each runs half a width past its
        corners so the joints close without extra geometry."""
        for a, b in zip(points, points[1:] + points[:1]):
            self.bar(a, b, width, y0, y1, overlap=width / 2)

    def object(self, name, mat, collection, parent=None, location=(0, 0, 0), uv=None, smooth=False):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        mesh.materials.append(mat)
        if uv:
            # Planar map over the front: u along x, v up, across the given box.
            x0, z0, x1, z1 = uv
            layer = mesh.uv_layers.new(name="Face")
            for loop in mesh.loops:
                co = mesh.vertices[loop.vertex_index].co
                layer.data[loop.index].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
        for poly in mesh.polygons:
            poly.use_smooth = smooth
        if smooth:
            # Curves and bevels shade smoothly; corners of 90 degrees stay crisp.
            mesh.set_sharp_from_angle(angle=math.radians(50))
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        obj.parent = parent
        obj.location = location
        return obj


def weather(obj, base, dust, seed, amount=1.0):
    """Dust settles on the tops; handling rubs paler patches through."""
    mesh = obj.data
    colors = mesh.color_attributes.new(name="Wear", type="BYTE_COLOR", domain="POINT")
    world = obj.matrix_world
    pts = np.array([tuple(world @ v.co) for v in mesh.vertices])
    settle = fbm(pts, 9, 3, seed)
    rubbed = noise(pts, 30, seed + 1) > 0.82
    for i, vert in enumerate(mesh.vertices):
        up = max(0.0, vert.normal.z)
        t = min(1.0, amount * up ** 2 * (0.25 + 0.6 * settle[i]))
        c = np.array(base) * (1.6 if rubbed[i] and up < 0.5 else 1.0)
        colors.data[i].color = (*(c * (1 - t) + np.array(dust) * t), 1)


def arch(half_width, shoulder, rise, steps=16):
    """Straight sides up to the shoulder, then an elliptical arch."""
    pts = [(-half_width, 0.0), (half_width, 0.0)]
    pts += [(half_width * math.cos(math.pi * k / steps), shoulder + rise * math.sin(math.pi * k / steps))
            for k in range(steps + 1)]
    return pts


def arch_top(x, half_width, shoulder, rise):
    return shoulder + rise * math.sqrt(max(0.0, 1 - (x / half_width) ** 2))


DIGITS = {
    "0": [[(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)]],
    "1": [[(0.25, 0.8), (0.55, 1), (0.55, 0)]],
    "2": [[(0, 1), (1, 1), (1, 0.5), (0, 0.5), (0, 0), (1, 0)]],
    "4": [[(0, 1), (0, 0.5), (1, 0.5)], [(1, 1), (1, 0)]],
    "5": [[(1, 1), (0, 1), (0, 0.5), (1, 0.5), (1, 0), (0, 0)]],
    "6": [[(1, 1), (0, 1), (0, 0), (1, 0), (1, 0.5), (0, 0.5)]],
    "7": [[(0, 1), (1, 1), (0.4, 0)]],
    "8": [[(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)], [(0, 0.5), (1, 0.5)]],
    "9": [[(1, 0.5), (0, 0.5), (0, 1), (1, 1), (1, 0), (0, 0)]],
}


def dial_image(name, w=512, h=116):
    """Aged cream scale with an invented broadcast-band calibration."""
    jj, ii = np.mgrid[:h, :w]
    x, y = ii + 0.5, (jj + 0.5)
    ink = np.zeros((h, w))

    def line(a, b, r):
        a, b = np.array(a, float), np.array(b, float)
        d = b - a
        k = np.clip(((x - a[0]) * d[0] + (y - a[1]) * d[1]) / max(d @ d, 1e-9), 0, 1)
        dist = np.hypot(x - a[0] - k * d[0], y - a[1] - k * d[1])
        np.maximum(ink, np.clip(r - dist + 0.5, 0, 1), out=ink)

    base = 0.42 * h
    line((0.06 * w, base), (0.94 * w, base), 1.2)
    # Uneven spacing, as on real tuning scales: the low end is spread out.
    marks = [55, 60, 70, 80, 90, 100, 120, 140, 160]

    def pos(f):
        return 0.08 * w + 0.84 * w * (math.log(f / 55) / math.log(160 / 55)) ** 0.8

    for f in range(55, 161, 5):
        major = f in marks
        line((pos(f), base), (pos(f), base + (14 if major else 7)), 1.4 if major else 0.9)
    size = 15
    for f in marks:
        text = str(f)
        left = pos(f) - (len(text) * 0.75 - 0.25) * size / 2
        for k, ch in enumerate(text):
            for stroke in DIGITS[ch]:
                pts = [(left + k * size * 0.75 + u * size * 0.5, base + 22 + v * size) for u, v in stroke]
                for a, b in zip(pts, pts[1:]):
                    line(a, b, 1.2)
    # A plain rule below the scale, where a second range would sit.
    line((0.06 * w, 0.22 * h), (0.94 * w, 0.22 * h), 0.8)
    grime = fbm(np.stack([x.ravel() / w, y.ravel() / w, np.zeros(x.size)], 1), 5, 3, 120).reshape(h, w)
    paper = np.array([0.8, 0.7, 0.5]) * (0.88 + 0.12 * grime[..., None])
    rgb = paper * (1 - ink[..., None]) + np.array([0.14, 0.09, 0.05]) * ink[..., None]
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = rgb  # Row 0 is the bottom, as Blender stores pixels.
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


def build_radio(collection, x, y, floor_z, heading_deg, prefix="Radio_Basement", table_name="Radio_Table"):
    """Side table squared to the walls at (x, y), radio on top turned to
    heading_deg about Z. Returns the table footprint and its collider box.
    prefix names the radio's nodes (the contract above uses Radio_Basement),
    so a second set, such as the living room's Radio_Living, can be built."""
    wood = material("Radio_Cabinet_Walnut", (0.07, 0.035, 0.018), 0.45, wear=True)
    cloth = material("Radio_Grille_Cloth", (0.05, 0.038, 0.028), 0.95)
    bakelite = material("Radio_Bakelite", (0.018, 0.012, 0.009), 0.35)
    brass = material("Radio_Brass", (0.38, 0.27, 0.11), 0.45, metallic=0.9)
    lamp = material("Radio_Status_Lamp", (0.3, 0.09, 0.015), 0.2)
    table_wood = material("Radio_Table_Wood", (0.05, 0.03, 0.018), 0.65, wear=True)
    face = material("Radio_Dial_Face", (1, 1, 1), 0.7)
    if not any(node.type == "TEX_IMAGE" for node in face.node_tree.nodes):
        tex = face.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = dial_image("Radio_Dial_Face - scale")
        face.node_tree.links.new(tex.outputs["Color"], face.node_tree.nodes["Principled BSDF"].inputs["Base Color"])

    # The table: a plain stained top on four tapered legs with an apron.
    top_w, top_d, top_z = 0.52, 0.40, 0.725
    table = Part()
    table.solid([(-top_w / 2, top_z - 0.025), (top_w / 2, top_z - 0.025), (top_w / 2, top_z),
                 (-top_w / 2, top_z)], -top_d / 2, top_d / 2)
    table.bevel(0.004, 1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lx, ly = sx * (top_w / 2 - 0.045), sy * (top_d / 2 - 0.045)
            table.solid([(lx - 0.012, 0), (lx + 0.012, 0), (lx + 0.018, top_z - 0.025),
                         (lx - 0.018, top_z - 0.025)], ly - 0.018, ly + 0.018)
    for sy in (-1, 1):
        ay = sy * (top_d / 2 - 0.05)
        table.solid([(-top_w / 2 + 0.05, top_z - 0.1), (top_w / 2 - 0.05, top_z - 0.1),
                     (top_w / 2 - 0.05, top_z - 0.025), (-top_w / 2 + 0.05, top_z - 0.025)],
                    ay - 0.01, ay + 0.01)
    for sx in (-1, 1):
        ax = sx * (top_w / 2 - 0.05)
        table.solid([(ax - 0.01, top_z - 0.1), (ax + 0.01, top_z - 0.1), (ax + 0.01, top_z - 0.025),
                     (ax - 0.01, top_z - 0.025)], -top_d / 2 + 0.05, top_d / 2 - 0.05)
    table_obj = table.object(table_name, table_wood, collection, location=(x, y, floor_z), smooth=True)

    root = bpy.data.objects.new(f"{prefix}", None)
    root.empty_display_size = 0.1
    collection.objects.link(root)
    root.location = (x, y, floor_z + top_z)
    root.rotation_euler.z = math.radians(heading_deg)

    # Cabinet: plinth and arched body, with fretwork in a raised frame.
    cabinet = Part()
    cabinet.solid([(-WIDTH / 2 - 0.012, 0), (WIDTH / 2 + 0.012, 0), (WIDTH / 2 + 0.012, PLINTH),
                   (-WIDTH / 2 - 0.012, PLINTH)], FRONT - 0.008, -FRONT + 0.004)
    cabinet.solid([(px, pz + PLINTH) for px, pz in arch(WIDTH / 2, SHOULDER, ARCH)], FRONT, -FRONT)
    cabinet.bevel(0.005)
    g_half, g_low, g_shoulder, g_rise = 0.135, PLINTH + 0.13, PLINTH + 0.225, 0.06
    outline = [(px, pz + g_low) for px, pz in arch(g_half, g_shoulder - g_low, g_rise)]
    cabinet.rail(outline, 0.012, FRONT - 0.007, FRONT + 0.002)
    for bx in (-0.09, -0.045, 0.0, 0.045, 0.09):
        cabinet.bar((bx, g_low), (bx, arch_top(bx, g_half, g_shoulder, g_rise)), 0.011,
                    FRONT - 0.006, FRONT + 0.002)
    cabinet.bar((-g_half, g_low + 0.07), (g_half, g_low + 0.07), 0.008, FRONT - 0.0055, FRONT + 0.002)
    cabinet_obj = cabinet.object(f"{prefix}_Cabinet", wood, collection, root, smooth=True)

    grille = Part()
    grille.solid(outline, FRONT - 0.0015, FRONT + 0.002)
    grille.object(f"{prefix}_Grille", cloth, collection, root)

    # Dial: a brass-framed strip, and the pilot lamp in a brass cup beside it.
    d_half, d_h = 0.105, 0.046
    box = [(-d_half, DIAL_Z - d_h / 2), (d_half, DIAL_Z - d_h / 2), (d_half, DIAL_Z + d_h / 2),
           (-d_half, DIAL_Z + d_h / 2)]
    trim = Part()
    trim.rail(box, 0.007, FRONT - 0.005, FRONT + 0.002)
    lamp_x = -0.155
    trim.solid([(lamp_x + 0.012 * math.cos(k * math.tau / 12), DIAL_Z + 0.012 * math.sin(k * math.tau / 12))
                for k in range(12)], FRONT - 0.003, FRONT + 0.002)
    trim.object(f"{prefix}_Trim", brass, collection, root)

    dial = Part()
    dial.solid(box, FRONT - 0.0012, FRONT + 0.002)
    dial.object(f"{prefix}_Dial", face, collection, root,
                uv=(-d_half, DIAL_Z - d_h / 2, d_half, DIAL_Z + d_h / 2))
    # A fixed needle just proud of the scale, set to the middle of the band.
    needle = Part()
    needle.bar((0.012, DIAL_Z - d_h / 2 + 0.004), (0.012, DIAL_Z + d_h / 2 - 0.004), 0.0018,
               FRONT - 0.0022, FRONT - 0.0012)

    status = Part()
    ring = [(0.0085 * math.cos(k * math.tau / 12), 0.0085 * math.sin(k * math.tau / 12)) for k in range(12)]
    status.solid([(u * 0.6, v * 0.6) for u, v in ring], -0.007, 0.0, back=ring)
    status.object(f"{prefix}_Status", lamp, collection, root, location=(lamp_x, FRONT - 0.003, DIAL_Z),
                  smooth=True)

    # Controls: fluted knobs either side, the chicken-head switch between them.
    for name, kx in (("Volume", -0.13), ("Tuning", 0.13)):
        knob = Part()
        # Eighteen flutes: alternate ridge and groove points.
        fluted = [(0.019 * (1.04 if k % 2 else 0.96) * math.cos(k * math.tau / 36),
                   0.019 * (1.04 if k % 2 else 0.96) * math.sin(k * math.tau / 36)) for k in range(36)]
        knob.solid([(u * 0.86, v * 0.86) for u, v in fluted], -0.022, 0.0, back=fluted)
        knob.solid([(0.0215 * math.cos(k * math.tau / 24), 0.0215 * math.sin(k * math.tau / 24))
                    for k in range(24)], -0.004, 0.0)
        knob.object(f"{prefix}_Knob_{name}", bakelite, collection, root, location=(kx, FRONT, KNOB_Z),
                    smooth=True)
    switch = Part()
    point = math.radians(150)
    head = [(0.011 * math.cos(point + math.pi * 0.25 + k * math.pi * 1.5 / 10),
             0.011 * math.sin(point + math.pi * 0.25 + k * math.pi * 1.5 / 10)) for k in range(11)]
    switch.solid([(0.032 * math.cos(point), 0.032 * math.sin(point))] + head, -0.02, 0.0)
    switch.solid([(0.016 * math.cos(k * math.tau / 16), 0.016 * math.sin(k * math.tau / 16)) for k in range(16)],
                 -0.005, 0.0)
    switch.bevel(0.0015, 1)
    switch.object(f"{prefix}_Power", bakelite, collection, root, location=(0.0, FRONT, KNOB_Z),
                  smooth=True)

    # The needle and the cloth mains cord share the bakelite draw call.
    cord = Sculpture()
    cord.tube([(0.12, -FRONT, 0.03), (0.13, -FRONT + 0.05, 0.004), (0.14, -FRONT + 0.06, -0.05),
               (0.16, -FRONT + 0.07, -top_z + 0.01)], [0.0035] * 4, 6)
    cord_mesh = _mesh(cord)
    needle.bm.from_mesh(cord_mesh)
    bpy.data.meshes.remove(cord_mesh)
    needle.object(f"{prefix}_Fittings", bakelite, collection, root)

    emitter = bpy.data.objects.new(f"{prefix}_Emitter", None)
    emitter.empty_display_size = 0.03
    collection.objects.link(emitter)
    emitter.parent = root
    emitter.location = (0.0, FRONT - 0.02, (g_low + g_shoulder) / 2)

    bpy.context.view_layer.update()
    weather(cabinet_obj, (0.07, 0.035, 0.018), (0.2, 0.18, 0.15), 130)
    weather(table_obj, (0.05, 0.03, 0.018), (0.15, 0.12, 0.09), 133, amount=0.55)
    footprint = (x - top_w / 2, x + top_w / 2, y - top_d / 2, y + top_d / 2)
    collider = (*footprint, floor_z, floor_z + top_z + PLINTH + SHOULDER + ARCH)
    return footprint, collider


def _mesh(sculpture):
    mesh = bpy.data.meshes.new("Radio_Cord_Tmp")
    mesh.from_pydata(sculpture.vertices, [], sculpture.faces)
    return mesh
