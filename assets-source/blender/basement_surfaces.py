"""Weathered cellar surfaces baked into unique, non-repeating atlases.

Every visible face gets its own region of a texture atlas, and each texel is
shaded from its world position. Large damage is placed by hand (chipped
plaster, exposed brick, damp trails under their sources, cracks at stress
points); fine grain and aggregate ride on top. Ambient occlusion is baked into
corners. Nothing here samples an external image.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

PIXELS_PER_METRE = 80
PAD = 4


# --- Noise -----------------------------------------------------------------

def _hash(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFFFF) / float(0xFFFFFF)


def noise(p, freq, seed):
    """Trilinear value noise in [0, 1] at points p (N x 3)."""
    q = p * freq
    i = np.floor(q).astype(np.int64)
    t = q - i
    w = t * t * (3 - 2 * t)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                weight = ((w[:, 0] if dx else 1 - w[:, 0]) * (w[:, 1] if dy else 1 - w[:, 1])
                          * (w[:, 2] if dz else 1 - w[:, 2]))
                out = out + weight * _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm(p, freq, octaves, seed):
    total, norm, amp = 0, 0, 1.0
    for k in range(octaves):
        total = total + amp * noise(p, freq * 2 ** k, seed + k)
        norm += amp
        amp *= 0.5
    return total / norm


def warp(p, freq, amount, seed):
    offset = np.stack([fbm(p, freq, 2, seed + 10 * k) - 0.5 for k in range(3)], axis=1)
    return p + offset * amount


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def blob(p, centres):
    """Max of soft spheres (x, y, z, radius) around hand-placed centres."""
    out = np.zeros(len(p))
    for x, y, z, r in centres:
        d = np.linalg.norm(p - (x, y, z), axis=1) / r
        out = np.maximum(out, np.exp(-d * d))
    return out


# --- Atlas -----------------------------------------------------------------

def _axes(n):
    if abs(n.z) > 0.7:
        return Vector((1, 0, 0)), Vector((0, 1 if n.z > 0 else -1, 0))
    v = Vector((0, 0, 1))
    return v.cross(n).normalized(), v


def bake_atlas(obj, mat, name, width, keep, shade):
    """Drop hidden faces, give each visible face a unique atlas region and
    bake base colour, roughness and a tangent normal map for it."""
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    hidden = []
    for face in bm.faces:
        centre = face.calc_center_median()
        probes = [centre] + [v.co.lerp(centre, 0.05) for v in face.verts]
        if not any(keep(p + face.normal * 0.05) for p in probes):
            hidden.append(face)
    bmesh.ops.delete(bm, geom=hidden, context="FACES")

    rects = []
    for face in bm.faces:
        u, v = _axes(face.normal)
        a = [vert.co.dot(u) for vert in face.verts]
        b = [vert.co.dot(v) for vert in face.verts]
        size = (math.ceil((max(a) - min(a)) * PIXELS_PER_METRE) + 2 * PAD,
                math.ceil((max(b) - min(b)) * PIXELS_PER_METRE) + 2 * PAD)
        rects.append((face, u, v, min(a), min(b), size))

    # Shelf packing, tallest first.
    x = y = shelf = 0
    places = {}
    for index in sorted(range(len(rects)), key=lambda i: -rects[i][5][1]):
        w, h = rects[index][5]
        if x + w > width:
            x, y, shelf = 0, y + shelf, 0
        places[index] = (x, y)
        x, shelf = x + w, max(shelf, h)
    height = 1 << math.ceil(math.log2(y + shelf))

    uv_layer = bm.loops.layers.uv.new("Atlas")
    color = np.zeros((height, width, 3), np.float32)
    rough = np.ones((height, width), np.float32)
    relief = np.zeros((height, width), np.float32)
    for index, (face, u, v, a0, b0, (w, h)) in enumerate(rects):
        px, py = places[index]
        for loop in face.loops:
            co = loop.vert.co
            loop[uv_layer].uv = ((px + PAD + (co.dot(u) - a0) * PIXELS_PER_METRE) / width,
                                 (py + PAD + (co.dot(v) - b0) * PIXELS_PER_METRE) / height)
        n = face.normal.copy()
        jj, ii = np.mgrid[:h, :w]
        a = a0 + (ii.ravel() - PAD + 0.5) / PIXELS_PER_METRE
        b = b0 + (jj.ravel() - PAD + 0.5) / PIXELS_PER_METRE
        d = face.calc_center_median().dot(n)
        p = (np.outer(a, u) + np.outer(b, v) + np.asarray(n) * d).astype(np.float64)
        c, r, z = shade(p, np.asarray(n))
        color[py:py + h, px:px + w] = c.reshape(h, w, 3)
        rough[py:py + h, px:px + w] = r.reshape(h, w)
        relief[py:py + h, px:px + w] = z.reshape(h, w)
    bm.to_mesh(obj.data)
    bm.free()
    for poly in obj.data.polygons:
        poly.use_smooth = False

    # Finish maps at half resolution keep transfer down.
    half = lambda m: m.reshape(height // 2, 2, width // 2, 2).mean(axis=(1, 3))
    dy, dx = np.gradient(half(relief) * PIXELS_PER_METRE / 2)
    normal = np.stack([-dx, -dy, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    shader = mat.node_tree.nodes["Principled BSDF"]
    links = mat.node_tree.links

    def image(label, pixels, linear):
        rows, cols = pixels.shape[:2]
        rgba = np.ones((rows, cols, 4), np.float32)
        rgba[..., :3] = pixels if pixels.ndim == 3 else pixels[..., None]
        img = bpy.data.images.new(f"{name} - {label}", cols, rows, alpha=False)
        if linear:
            img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(np.clip(rgba, 0, 1).ravel())
        img.pack()
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        return node.outputs["Color"]

    links.new(image("colour", color, False), shader.inputs["Base Color"])
    links.new(image("roughness", half(rough), True), shader.inputs["Roughness"])
    normal_node = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    links.new(image("normal", normal * 0.5 + 0.5, True), normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], shader.inputs["Normal"])
    return width, height


# --- Cellar ----------------------------------------------------------------

class Cellar:
    """Room and stairwell volumes plus the hand-placed weathering."""

    def __init__(self, room, stairwell, stair_x, lower_x, stair_top, floor_z, ceiling_z,
                 throne, candles):
        self.room, self.stairwell = room, stairwell
        self.stair_x, self.lower_x, self.stair_top = stair_x, lower_x, stair_top
        self.floor_z, self.ceiling_z = floor_z, ceiling_z
        x0, x1 = room[0][0], room[1][0]
        fz = floor_z
        self.candles = candles
        # Traffic wears a path from the stair foot to the throne and candles.
        self.path = [(lower_x, 0.0), (x0 + 1.0, 0.0), (throne[0] - 0.8, throne[1]),
                     (x0 + 1.0, 0.0), (candles[0] - 0.5, candles[1] - 0.4)]
        # Plaster lost back to the concrete substrate.
        self.loss = [(23.8, 4.0, fz + 1.9, 0.75), (21.8, -4.0, fz + 0.6, 0.85),
                     (x1, -2.7, fz + 0.9, 0.6), (x0, 1.2, fz + 1.0, 0.45),
                     (x0, -1.3, fz + 0.4, 0.45), (18.0, 0.8, fz + 0.7, 0.6),
                     (13.0, -0.8, 0.45, 0.45), (15.6, 0.8, -0.6, 0.4)]
        # Selectively exposed masonry inside the worst losses.
        self.brick = [(20.6, 4.0, fz + 1.15, 0.6), (25.6, -4.0, fz + 1.45, 0.65),
                      (16.4, -0.8, -1.3, 0.55)]
        # Damp sources: seams at the head of a wall, with trails running down.
        self.damp = [(22.2, 4.0, 0.09, 1.9), (25.4, -4.0, 0.12, 2.3), (x1, 2.4, 0.08, 1.6),
                     (17.6, 0.8, 0.07, 2.8), (14.2, -0.8, 0.06, 2.0)]
        # Stress points for hairline cracks: opening corners and room corners.
        self.stress = [(x0 + 0.2, 0.8, fz + 2.2, 0.7), (x0 + 0.2, -0.8, fz + 2.2, 0.7),
                       (x0, 0.8, fz + 2.2, 0.6), (x0, -0.8, fz + 2.2, 0.6),
                       (x1, 4.0, ceiling_z, 0.9), (x1, -4.0, ceiling_z, 0.9),
                       (x0 + 0.2, 4.0, ceiling_z, 0.8)]
        # Floor stains where the old discrete decals sat, now irregular.
        self.stains = [(21.2, 1.6, 0.8), (24.6, -1.8, 1.0), (22.4, -0.4, 0.5)]

    def inside(self, p):
        for lo, hi in (self.room, self.stairwell):
            if all(lo[i] <= p[i] <= hi[i] for i in range(3)):
                return True
        return False

    def floor_at(self, x):
        steps = np.clip(np.ceil((x - self.stair_x) / 0.3), 0, 17)
        return np.where(x < self.stair_x, self.stair_top, -0.18 * steps)

    def ceiling_z_at(self, p):
        return np.where(p[:, 0] >= self.room[0][0], self.ceiling_z, self.stairwell[1][2])

    def ambient(self, p):
        """Soft darkening near the floor, ceiling and wall corners."""
        in_room = p[:, 0] >= self.room[0][0] - 0.01
        lo = np.where(in_room[:, None], self.room[0], self.stairwell[0]).astype(float)
        hi = np.where(in_room[:, None], self.room[1], self.stairwell[1]).astype(float)
        lo[:, 2] = np.where(in_room, self.floor_z, self.floor_at(p[:, 0]))
        ao = np.ones(len(p))
        for d in np.concatenate([p - lo, hi - p], axis=1).T:
            ao *= np.where(d > 0.015, 1 - 0.38 * np.exp(-d / 0.22), 1)
        return ao

    def cracks(self, p, zone, seed, width=0.006):
        q = warp(p, 2.0, 0.2, seed)
        line = np.abs(fbm(q, 2.4, 2, seed + 3) - 0.5)
        return (1 - smooth(0, width, line)) * smooth(0.45, 0.8, zone)

    def plaster_loss(self, p):
        """Where the plaster has fallen away, plus the fields the wall shading reuses."""
        base = np.where(p[:, 0] < self.room[0][0], self.floor_at(p[:, 0]), self.floor_z)
        above = p[:, 2] - base
        # Two scales of ragged edge: broad lobes and small bites.
        edge_noise = (0.75 * (fbm(warp(p, 1.0, 0.5, 3), 1.4, 3, 4) - 0.5)
                      + 0.45 * (fbm(p, 5.0, 3, 12) - 0.5))

        # Large damage: placed patches with ragged edges, plus a damp-rotted
        # skirting band whose height wanders along the wall.
        # The band rots only along some stretches, so it never reads as a stripe.
        stretch = smooth(0.45, 0.7, fbm(p * (1, 1, 0), 0.45, 2, 5))
        skirting = smooth(0.25 + 0.45 * fbm(p, 0.8, 2, 9), 0.0, above) * stretch
        # Spalls run wider than tall, following the coursing behind them.
        flat = p * (1, 1, 1.5)
        lift = lambda centres: [(x, y, z * 1.5, r) for x, y, z, r in centres]
        damage = np.maximum.reduce([blob(flat, lift(self.loss)), blob(flat, lift(self.brick)),
                                    0.8 * skirting])
        damage = damage + 0.7 * edge_noise
        return damage > 0.5, damage, edge_noise, stretch, flat, lift

    def wall(self, p, n):
        along = p[:, 0] * abs(n[1]) + p[:, 1] * abs(n[0])
        z = p[:, 2]
        base = np.where(p[:, 0] < self.room[0][0], self.floor_at(p[:, 0]), self.floor_z)
        above = z - base
        grain = fbm(p, 14, 3, 1)
        mottle = fbm(p, 1.1, 3, 2)
        lost, damage, edge_noise, stretch, flat, lift = self.plaster_loss(p)
        brick_zone = blob(flat, lift(self.brick)) + 0.5 * edge_noise > 0.6
        rim = (damage > 0.44) & ~lost

        plaster = np.array([0.58, 0.55, 0.49]) * (0.86 + 0.26 * mottle)[:, None]
        plaster *= (0.95 + 0.1 * grain)[:, None]
        concrete = np.array([0.40, 0.39, 0.37]) * (0.85 + 0.3 * fbm(p, 6, 3, 6))[:, None]
        speck = noise(p, 160, 7)
        concrete *= (1 + 0.18 * (speck > 0.86) - 0.12 * (speck < 0.1))[:, None]

        course, length = 0.075, 0.225
        row = np.floor((z + 4) / course)
        shifted = along + 0.5 * length * (row % 2)
        col = np.floor(shifted / length)
        mortar = ((z + 4) / course - row < 0.14) | (shifted / length - col < 0.05)
        tone = 0.78 + 0.4 * _hash(row.astype(np.int64), col.astype(np.int64), 0, 8)
        brick = np.array([0.52, 0.27, 0.19]) * tone[:, None]
        brick = np.where(mortar[:, None], [0.56, 0.53, 0.47], brick)

        exposed = lost & brick_zone
        color = np.where(lost[:, None], concrete, plaster)
        color = np.where(exposed[:, None], brick, color)
        color = np.where(rim[:, None], color * 1.12 + 0.03, color)
        height = np.where(lost, 0.0, 0.005) - 0.004 * (exposed & mortar)
        rough = np.where(lost, 0.9, 0.93) - 0.05 * grain

        # Damp trails widen and fade below each source; tide marks at the foot.
        wet = np.zeros(len(p))
        drop = np.clip(self.ceiling_z_at(p) - z, 0, None)
        for x, y, width, length in self.damp:
            lateral = np.hypot(p[:, 0] - x, p[:, 1] - y) + 0.06 * np.sin(z * 9 + x)
            lateral += 0.08 * (fbm(p, 2.2, 2, int(x * 10)) - 0.5)
            spread = width * (1 + 0.5 * drop)
            wet = np.maximum(wet, np.exp(-(lateral / spread) ** 2) * np.exp(-drop / length))
        tide_z = 0.35 + 0.5 * fbm(p * (1, 1, 0), 0.6, 3, 10) + 0.15 * edge_noise
        rising = smooth(tide_z, tide_z - 0.35, above) * (0.4 + 0.6 * stretch)
        tide = np.exp(-((above - tide_z) / 0.02) ** 2) * stretch
        color *= (1 - 0.42 * wet - 0.22 * rising)[:, None]
        color += (0.035 * tide * ~lost)[:, None]
        rough -= 0.3 * wet + 0.1 * rising

        crack = self.cracks(p, blob(p, self.stress), 11)
        color *= (1 - 0.6 * crack)[:, None]
        height -= 0.002 * crack
        dirt = np.exp(-np.clip(above, 0, None) / 0.12)
        color *= (1 - 0.35 * dirt)[:, None]
        color *= self.ambient(p)[:, None]
        return color, rough, height

    def ceiling(self, p, n):
        # Board-marked concrete: the imprint of the formwork planks.
        board = np.floor(p[:, 1] / 0.15)
        across = p[:, 1] / 0.15 - board
        seam = np.exp(-((np.minimum(across, 1 - across)) / 0.025) ** 2)
        tone = 0.96 + 0.08 * _hash(board.astype(np.int64), 0, 0, 21)
        streak = fbm(p * (1, 6, 1), 2, 3, 22)
        blotch = fbm(p, 0.8, 3, 26)
        color = np.array([0.55, 0.54, 0.51]) * (tone * (0.9 + 0.08 * streak + 0.14 * blotch))[:, None]
        color *= (1 - 0.12 * seam)[:, None]
        height = -0.002 * seam + 0.001 * streak
        rough = 0.9 - 0.05 * streak
        # Water stains with darker tide rings above each damp source.
        for x, y, width, _ in self.damp:
            # Stains creep out from the wall head, ragged rather than round.
            r = np.hypot(p[:, 0] - x, (p[:, 1] - y) * 1.6) + 0.35 * (fbm(p, 1.6, 4, 23) - 0.5)
            size = 0.25 + 3 * width
            inner = smooth(size, size * 0.3, r)
            ring = np.exp(-((r - size) / 0.02) ** 2)
            color *= (1 - 0.1 * inner - 0.16 * ring)[:, None]
            rough -= 0.15 * inner
        # Soot above the candles.
        cx, cy = self.candles
        soot = np.exp(-(np.hypot(p[:, 0] - cx, p[:, 1] - cy) / 0.55) ** 2)
        color *= (1 - 0.6 * soot * (0.7 + 0.3 * fbm(p, 4, 2, 24)))[:, None]
        crack = self.cracks(p, blob(p, self.stress), 25)
        color *= (1 - 0.5 * crack)[:, None]
        color *= self.ambient(p)[:, None]
        return color, rough, height - 0.002 * crack

    def floor(self, p, n):
        grain = fbm(p, 10, 3, 31)
        color = np.array([0.46, 0.45, 0.42]) * (0.85 + 0.3 * fbm(p, 0.9, 3, 32))[:, None]
        color *= (0.95 + 0.1 * grain)[:, None]
        stone = noise(p, 150, 33)
        color *= (1 + 0.22 * (stone > 0.85) - 0.16 * (stone < 0.08))[:, None]
        height = 0.0015 * (stone > 0.85) + 0.001 * grain
        rough = 0.88 - 0.05 * grain

        # Polished, grubby traffic path.
        xy = p[:, :2]
        dist = np.full(len(p), 9.0)
        for a, b in zip(self.path, self.path[1:]):
            a, b = np.array(a), np.array(b)
            t = np.clip(((xy - a) @ (b - a)) / max((b - a) @ (b - a), 1e-9), 0, 1)
            dist = np.minimum(dist, np.linalg.norm(xy - (a + t[:, None] * (b - a)), axis=1))
        worn = np.exp(-(dist / 0.55) ** 2) * (0.7 + 0.3 * fbm(p, 1.5, 2, 34))
        color *= (1 - 0.12 * worn)[:, None]
        rough -= 0.3 * worn

        # Stair nosings rub bright; treads polish down the middle.
        on_stairs = (p[:, 0] > self.stair_x) & (p[:, 0] < self.lower_x) & (n[2] > 0.9)
        nose = (p[:, 0] - self.stair_x) / 0.3 % 1
        color *= (1 + 0.25 * on_stairs * np.exp(-((1 - nose) / 0.12) ** 2))[:, None]
        rough -= 0.2 * on_stairs * np.exp(-(p[:, 1] / 0.4) ** 2)

        # Irregular oil and water stains, and spilt wax by the candles.
        for x, y, r in self.stains:
            d = np.hypot(p[:, 0] - x, (p[:, 1] - y) * 1.4) / r + 0.6 * (fbm(p, 1.8, 3, int(x)) - 0.5)
            stain = smooth(1.0, 0.45, d)
            color *= (1 - 0.22 * stain)[:, None]
            rough -= 0.25 * stain
        cx, cy = self.candles
        wax = (np.hypot(p[:, 0] - cx, p[:, 1] - cy) < 0.45) & (noise(p, 22, 35) > 0.78)
        color = np.where(wax[:, None], [0.78, 0.74, 0.62], color)
        height += 0.002 * wax

        # A settlement crack angling across the room.
        zone = np.exp(-(((p[:, 0] - 19.4) - 0.9 * (p[:, 1] + 3.5)) / 0.5) ** 2)
        zone *= (p[:, 0] > self.room[0][0]) & (p[:, 0] < 24.5)
        crack = self.cracks(p, zone, 36, 0.005)
        color *= (1 - 0.6 * crack)[:, None]
        if n[2] < 0.5:  # stair risers: toe scuffs near the tread below
            scuff = np.exp(-((p[:, 2] - self.floor_at(p[:, 0] + 0.01)) / 0.06) ** 2)
            color *= (1 - 0.3 * scuff * fbm(p, 6, 2, 37))[:, None]
        color *= self.ambient(p)[:, None]
        return color, rough, height - 0.002 * crack

    def plaster(self, p, n):
        return self.ceiling(p, n) if n[2] < -0.7 else self.wall(p, n)

    def concrete(self, p, n):
        return self.ceiling(p, n) if n[2] < -0.7 else self.floor(p, n)


def stair_surface(name, mat, collection, x_start, stair_x, run, rise, steps, lower_end, y0, y1):
    """Render-only landing, treads and risers; the colliders stay separate."""
    verts, faces = [], []

    def quad(*corners):
        faces.append(tuple(range(len(verts), len(verts) + 4)))
        verts.extend(corners)

    quad((x_start, y0, 0), (stair_x, y0, 0), (stair_x, y1, 0), (x_start, y1, 0))
    for k in range(steps):
        x0, top, below = stair_x + run * k, -rise * k, -rise * (k + 1)
        # Each riser faces down the flight (+X), then the next tread.
        quad((x0, y0, top), (x0, y0, below), (x0, y1, below), (x0, y1, top))
        x1 = x0 + run if k < steps - 1 else lower_end
        quad((x0, y0, below), (x1, y0, below), (x1, y1, below), (x0, y1, below))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


# --- Graffiti --------------------------------------------------------------

# Single-stroke capitals in a 0.75 x 1 cell, drawn the way a hand would move.
HAND = {
    "B": [[(0, 0), (0.02, 1)], [(0.02, 1), (0.45, 0.97), (0.6, 0.82), (0.5, 0.58), (0.03, 0.53)],
          [(0.05, 0.53), (0.6, 0.45), (0.7, 0.22), (0.55, 0.03), (0, 0)]],
    "L": [[(0.02, 1), (0, 0), (0.62, 0.03)]],
    "A": [[(0, 0), (0.36, 1), (0.72, 0)], [(0.14, 0.38), (0.6, 0.42)]],
    "C": [[(0.68, 0.84), (0.45, 1), (0.15, 0.92), (0, 0.55), (0.08, 0.15), (0.35, 0), (0.72, 0.12)]],
    "K": [[(0, 1), (0.02, 0)], [(0.66, 1), (0.04, 0.44)], [(0.26, 0.62), (0.72, 0)]],
    "M": [[(0, 0), (0.05, 1), (0.38, 0.34), (0.7, 1), (0.76, 0)]],
    "E": [[(0.66, 1), (0, 0.98), (0.02, 0), (0.7, 0.02)], [(0.02, 0.52), (0.5, 0.54)]],
    "T": [[(0, 1), (0.76, 0.97)], [(0.38, 0.98), (0.36, 0)]],
}


def paint_graffiti(cellar, name, collection, wall_x, y_centre, z_centre, width, height, text):
    """BLACK METAL in black spray with an inverted cross, as a thin decal.

    The decal sits 3 mm off the east wall with its own alpha texture, so it
    keeps crisp, ragged edges close up without flickering against the plaster.
    Paint is withheld where the plaster has fallen away and thins over the
    plaster grain, so the wall shows through the mark.
    """
    rng = np.random.default_rng(55)
    ppm = 420
    w, h = int(width * ppm), int(height * ppm)
    # Image u runs along -Y (left to right from the doorway), v runs up.
    jj, ii = np.mgrid[:h, :w]
    s = (ii + 0.5) / ppm - width / 2
    t = (jj + 0.5) / ppm - height / 2
    world = np.stack([np.full(s.size, wall_x), y_centre - s.ravel(), z_centre + t.ravel()], axis=1)
    cover = np.zeros((h, w))

    def stroke(points, radius):
        """Rasterise one pressure-varying stroke given in metres (s, t)."""
        pts = np.array(points, float)
        seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
        dist = np.concatenate([[0], np.cumsum(seg)])
        n = max(2, int(dist[-1] / 0.006))
        along = np.linspace(0, dist[-1], n)
        path = np.stack([np.interp(along, dist, pts[:, k]) for k in (0, 1)], axis=1)
        # Pressure swells mid-stroke and tails off; the hand also wavers.
        u = along / dist[-1]
        pressure = radius * (0.55 + 0.6 * np.sin(np.pi * np.clip(u * 1.1, 0, 1)) ** 0.6)
        pressure *= 1 + 0.18 * np.sin(u * rng.uniform(8, 15) + rng.uniform(0, 6))
        path += np.stack([np.sin(u * 7 + rng.uniform(0, 6)), np.cos(u * 5 + rng.uniform(0, 6))], 1) * 0.004
        for (a, ra), (b, rb) in zip(zip(path, pressure), zip(path[1:], pressure[1:])):
            r = max(ra, rb) + 0.01
            x0 = max(0, int((min(a[0], b[0]) - r + width / 2) * ppm))
            x1 = min(w, int((max(a[0], b[0]) + r + width / 2) * ppm) + 1)
            y0 = max(0, int((min(a[1], b[1]) - r + height / 2) * ppm))
            y1 = min(h, int((max(a[1], b[1]) + r + height / 2) * ppm) + 1)
            if x0 >= x1 or y0 >= y1:
                continue
            ps, pt = s[y0:y1, x0:x1], t[y0:y1, x0:x1]
            d = b - a
            k = np.clip(((ps - a[0]) * d[0] + (pt - a[1]) * d[1]) / max(d @ d, 1e-12), 0, 1)
            dd = np.hypot(ps - a[0] - k * d[0], pt - a[1] - k * d[1])
            rad = ra + (rb - ra) * k
            cover[y0:y1, x0:x1] = np.maximum(cover[y0:y1, x0:x1], np.clip((rad - dd) / 0.003 + 0.5, 0, 1))
        return path, pressure

    def drip(at, length):
        stroke([at, (at[0] + rng.normal(0, 0.004), at[1] - length)], 0.006)

    def word(letters, left, base, size, slope):
        x = left
        for char in letters:
            scale = size * rng.uniform(0.9, 1.12)
            lift = base + rng.normal(0, 0.02) + slope * (x - left)
            lean = rng.uniform(0.05, 0.16)
            for strokes in HAND[char]:
                pts = [(x + (u + lean * v) * scale * 0.78 + rng.normal(0, 0.006),
                        lift + v * scale + rng.normal(0, 0.006)) for u, v in strokes]
                path, pressure = stroke(pts, 0.019)
                low = path[np.argmin(path[:, 1])]
                if rng.random() < 0.35:
                    drip(low, rng.uniform(0.06, 0.28))
            x += scale * rng.uniform(0.8, 0.88)
        return x

    # Two stacked words, the second set in and climbing slightly.
    end = word("BLACK", -width / 2 + 0.08, 0.1, 0.33, 0.03)
    end = max(end, word("METAL", -width / 2 + 0.16, -0.38, 0.33, 0.05))
    # The inverted cross stands apart from the words, crossbar low on the shaft.
    cx = min(end + 0.3, width / 2 - 0.22)
    stroke([(cx, 0.58), (cx + 0.012, -0.6)], 0.027)
    stroke([(cx - 0.19, -0.26), (cx + 0.2, -0.23)], 0.025)
    drip((cx + 0.14, -0.24), 0.14)
    drip((cx + 0.012, -0.6), 0.18)

    # The wall shows through: no paint over lost plaster, thin over its grain.
    lost = cellar.plaster_loss(world)[0].reshape(h, w)
    grain = fbm(world, 60, 3, 56).reshape(h, w)
    chips = noise(world, 25, 57).reshape(h, w) > 0.9
    ragged = fbm(world, 180, 2, 58).reshape(h, w)
    alpha = np.clip(cover * 1.3 - 0.45 * (ragged - 0.5) - 0.3, 0, 1)
    alpha *= (0.72 + 0.28 * grain) * ~lost * np.where(chips, 0.25, 1)

    rgba = np.zeros((h, w, 4), np.float32)
    # Flat colour outside the strokes keeps the PNG small.
    rgba[..., :3] = np.where(alpha > 0, 0.03 + 0.03 * grain, 0.03)[..., None]
    rgba[..., 3] = alpha
    img = bpy.data.images.new(f"{name} - paint", w, h, alpha=True)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()

    mat = bpy.data.materials.new("Graffiti_Paint")
    shader = mat.node_tree.nodes["Principled BSDF"]
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    mat.node_tree.links.new(tex.outputs["Alpha"], shader.inputs["Alpha"])
    shader.inputs["Roughness"].default_value = 0.62
    mat.surface_render_method = "BLENDED"

    x = wall_x - 0.003
    y0, y1 = y_centre + width / 2, y_centre - width / 2
    z0, z1 = z_centre - height / 2, z_centre + height / 2
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)], [], [(0, 1, 2, 3)])
    uv = mesh.uv_layers.new(name="Paint")
    for loop, coord in zip(mesh.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop.index].uv = coord
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj["text"] = text
    collection.objects.link(obj)
    return obj
