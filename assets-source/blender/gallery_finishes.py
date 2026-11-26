"""Original gallery materials and millwork. All dimensions are in metres."""
import math

import bpy
import numpy as np
from mathutils import Vector


def oak_floor(obj, mat, exclude=()):
    """Lacquered mosaic parquet: 480 mm squares of five oak fingers, laid in
    alternating directions. Each finger samples its own pre-seamed block of
    the atlas, so the joints are in the texture (stable under mipmapping)
    and no two neighbours repeat."""
    rng = np.random.default_rng(48)
    finger_px, width_px, per_row, rows = 320, 64, 6, 32
    size = 2048
    color = np.zeros((size, size, 3), dtype=np.float32)
    rough = np.zeros((size, size), dtype=np.float32)
    relief = np.zeros_like(rough)
    y, x = np.mgrid[:width_px, :finger_px]
    u, v = x / finger_px, y / width_px
    for k in range(per_row * rows):
        # Each finger is cut from a different part of a virtual log: mostly
        # straight quarter-sawn grain, sometimes the arched figure near the heart.
        phase = rng.uniform(0, math.tau)
        wander = 0.04 * np.sin(u * 5 + phase) + 0.012 * np.sin(u * 13 - phase)
        offset = rng.uniform(-1.1, 0.15)
        across = v - offset + wander
        lengthwise = (u - rng.uniform(0.2, 0.8)) * rng.uniform(0.4, 1.3)
        radius = np.sqrt(across**2 + lengthwise**2 + 0.08)
        ring = radius * rng.uniform(14, 22) + 0.15 * np.sin(radius * 20 + phase)
        earlywood = np.exp(-((np.sin(np.pi * ring) / 0.4) ** 2))
        fibres = np.sin(2 * np.pi * (across * 36 + 0.15 * np.sin(u * 20 + phase)))
        pores = np.maximum(fibres, 0) ** 6 * (0.5 + 0.5 * np.sin(u * 50 + v * 14 + phase)) ** 2
        # Fingers differ in tone as real stock does; a few run noticeably darker.
        tone = rng.choice([rng.uniform(0.9, 0.95), rng.uniform(0.96, 1.04)], p=[0.2, 0.8])
        tone = tone + 0.025 * np.sin(ring * 1.3) - 0.07 * earlywood - 0.04 * pores
        tone = tone + rng.normal(0, 0.005, u.shape)
        # Joints: a dark hairline with a slight bevel on all four edges.
        edge = np.minimum(np.minimum(x, finger_px - 1 - x), np.minimum(y, width_px - 1 - y))
        joint = np.clip(1 - edge / 1.2, 0, 1)
        tone = tone * (1 - 0.28 * joint)
        row, col = divmod(k, per_row)
        rows_ = slice(row * width_px, (row + 1) * width_px)
        cols_ = slice(col * finger_px, (col + 1) * finger_px)
        color[rows_, cols_] = tone[..., None] * np.array((0.8, 0.62, 0.42))
        rough[rows_, cols_] = 0.16 + 0.05 * earlywood + 0.03 * pores + 0.25 * joint
        relief[rows_, cols_] = 0.05 * earlywood + 0.03 * pores - 0.3 * joint

    shader = mat.node_tree.nodes["Principled BSDF"]
    def map_image(name, pixels, linear=False):
        h, w = pixels.shape[:2]
        rgba = np.ones((h, w, 4), dtype=np.float32)
        rgba[..., :3] = pixels if pixels.ndim == 3 else pixels[..., None]
        img = bpy.data.images.new(name, w, h, alpha=False)
        if linear:
            img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(rgba.ravel())
        img.pack()
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        return node.outputs["Color"]

    links = mat.node_tree.links
    links.new(map_image("Honey oak parquet - colour", color), shader.inputs["Base Color"])
    half = lambda m: m.reshape(size // 2, 2, size // 2, 2).mean(axis=(1, 3))
    links.new(map_image("Lacquer - roughness", half(rough), True), shader.inputs["Roughness"])
    dy, dx = np.gradient(half(relief))
    normal = np.stack([0.5 - dx * 0.4, 0.5 - dy * 0.4, np.ones_like(dx)], axis=-1)
    normal_node = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    links.new(map_image("Parquet joints - tangent normal", normal, True), normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], shader.inputs["Normal"])
    # A hard, glossy lacquer over the oak picks up every spotlight.
    shader.inputs["Coat Weight"].default_value = 0.65
    shader.inputs["Coat Roughness"].default_value = 0.06

    # Keep the slab sides, bottom, top elevation and independent collider intact.
    slab = obj.data
    verts = [tuple(pt.co) for pt in slab.vertices]
    faces = [tuple(f.vertices) for f in slab.polygons if f.normal.z < 0.9]
    z = max(pt[2] for pt in verts)
    xmin, xmax = min(pt[0] for pt in verts), max(pt[0] for pt in verts)
    ymin, ymax = min(pt[1] for pt in verts), max(pt[1] for pt in verts)
    tile, fingers = 0.48, 5
    finger_w = tile / fingers
    uvs = []
    count = per_row * rows
    tx = math.floor(xmin / tile)
    while tx * tile < xmax:
        ty = math.floor(ymin / tile)
        while ty * tile < ymax:
            x0, y0 = tx * tile, ty * tile
            along_x = (tx + ty) % 2 == 0
            for f in range(fingers):
                if along_x:
                    a0, a1, b0, b1 = x0, x0 + tile, y0 + f * finger_w, y0 + (f + 1) * finger_w
                else:
                    a0, a1, b0, b1 = x0 + f * finger_w, x0 + (f + 1) * finger_w, y0, y0 + tile
                c0, c1 = max(a0, xmin), min(a1, xmax)
                d0, d1 = max(b0, ymin), min(b1, ymax)
                if c0 >= c1 or d0 >= d1:
                    continue
                # Cut each excluded [x0, x1, y0, y1] area, given in world
                # coordinates (the slab's vertices are local), out of the finger.
                pieces = [(c0, c1, d0, d1)]
                for e in exclude:
                    ex0, ex1 = e[0] - obj.location.x, e[1] - obj.location.x
                    ey0, ey1 = e[2] - obj.location.y, e[3] - obj.location.y
                    kept = []
                    for p0, p1, q0, q1 in pieces:
                        if p1 <= ex0 or p0 >= ex1 or q1 <= ey0 or q0 >= ey1:
                            kept.append((p0, p1, q0, q1))
                            continue
                        kept += [r for r in ((p0, ex0, q0, q1), (ex1, p1, q0, q1),
                                             (max(p0, ex0), min(p1, ex1), q0, ey0),
                                             (max(p0, ex0), min(p1, ex1), ey1, q1))
                                 if r[0] < r[1] and r[2] < r[3]]
                    pieces = kept
                if not pieces:
                    continue
                k = int(rng.integers(count))
                row, col = divmod(k, per_row)
                pu0, pu1 = col * finger_px / size, (col + 1) * finger_px / size
                pv0, pv1 = row * width_px / size, (row + 1) * width_px / size
                if rng.random() < 0.5:
                    pu0, pu1 = pu1, pu0
                # Map each clipped corner back into the finger's own frame:
                # s runs along the grain, t across it.
                def coord(px, py):
                    if along_x:
                        s, t = (px - a0) / (a1 - a0), (py - b0) / (b1 - b0)
                    else:
                        s, t = (py - b0) / (b1 - b0), (px - a0) / (a1 - a0)
                    return (pu0 + (pu1 - pu0) * s, pv0 + (pv1 - pv0) * t)
                for p0, p1, q0, q1 in pieces:
                    index = len(verts)
                    corners = [(p0, q0), (p1, q0), (p1, q1), (p0, q1)]
                    verts.extend([(px, py, z) for px, py in corners])
                    faces.append(tuple(range(index, index + 4)))
                    uvs.append([coord(px, py) for px, py in corners])
            ty += 1
        tx += 1
    surface = bpy.data.meshes.new("Oak parquet")
    surface.from_pydata(verts, [], faces)
    surface.materials.append(mat)
    uv = surface.uv_layers.new(name="Parquet")
    for poly, coords in zip(list(surface.polygons)[-len(uvs):], uvs):
        for loop, coord in zip(poly.loop_indices, coords):
            uv.data[loop].uv = coord
    obj.data = surface
    bpy.data.meshes.remove(slab)


def _tileable(rng, size, low, high, stretch=1.0):
    """Band-limited noise that wraps seamlessly: white noise filtered in the
    frequency domain, between low and high cycles per tile. stretch > 1
    favours horizontal frequencies, giving vertical streaks."""
    fy, fx = np.meshgrid(np.fft.fftfreq(size) * size, np.fft.fftfreq(size) * size, indexing="ij")
    radius = np.hypot(fx, fy * stretch)
    band = (radius >= low) & (radius <= high)
    field = np.real(np.fft.ifft2(np.fft.fft2(rng.normal(size=(size, size))) * band))
    return field / (np.abs(field).max() + 1e-9)


def paint_finish(mat):
    """Matte emulsion on plastered walls, tiled every metre: broad mottling
    from the plaster beneath, faint vertical roller laps, and an orange-peel
    stipple that catches raking spotlight."""
    size = 512
    rng = np.random.default_rng(49)
    mottle = _tileable(rng, size, 2, 6)
    laps = _tileable(rng, size, 3, 9, stretch=8.0)
    stipple = _tileable(rng, size, 60, 170)
    grit = _tileable(rng, size, 170, 256)

    shader = mat.node_tree.nodes["Principled BSDF"]
    base = np.array(shader.inputs["Base Color"].default_value[:3])

    def image(name, pixels, linear):
        rgba = np.ones((size, size, 4), dtype=np.float32)
        rgba[..., :3] = pixels if pixels.ndim == 3 else pixels[..., None]
        img = bpy.data.images.new(name, size, size, alpha=False)
        if linear:
            img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(np.clip(rgba, 0, 1).ravel())
        img.pack()
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        return node.outputs["Color"]

    # Base colour as display values: the material colour, gently uneven.
    tone = 1 + 0.016 * mottle + 0.01 * laps - 0.01 * np.clip(stipple, 0, 1)
    display = np.where(base <= 0.0031308, base * 12.92, 1.055 * base ** (1 / 2.4) - 0.055)
    links = mat.node_tree.links
    links.new(image("Mineral paint - colour", tone[..., None] * display, False), shader.inputs["Base Color"])
    rough = 0.86 + 0.05 * stipple + 0.03 * grit - 0.02 * laps
    links.new(image("Mineral paint - roughness", rough, True), shader.inputs["Roughness"])
    # Stipple and grit in relief, with a breath of the roller laps.
    height = 0.6 * stipple + 0.25 * grit + 0.4 * laps
    dy, dx = np.gradient(height)
    normal = np.stack([0.5 - dx * 0.35, 0.5 - dy * 0.35, np.ones_like(dx)], axis=-1)
    normal_node = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    links.new(image("Mineral paint - normal", normal, True), normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], shader.inputs["Normal"])


def paint_uv(obj):
    # One texture tile per metre of wall, in world position (boxes are unrotated).
    layer = obj.data.uv_layers.new(name="Paint")
    for poly in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        for index in poly.loop_indices:
            point = obj.location + obj.data.vertices[obj.data.loops[index].vertex_index].co
            layer.data[index].uv = [point[i] for i in range(3) if i != axis]


def soften(obj, width):
    bevel = obj.modifiers.new("Painted arris", "BEVEL")
    bevel.width = width
    bevel.segments = 3
    bevel.harden_normals = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)


def turned(name, profile, location, axis, mat, collection):
    """Revolve an axial section, including the recessed front of the fitting."""
    vertices, faces = [], []
    count = 32
    for z, radius in profile:
        for i in range(count):
            angle = i * math.tau / count
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
    for row in range(len(profile)-1):
        for i in range(count):
            a = row * count + i
            b = row * count + (i+1) % count
            faces.append((a, b, b+count, a+count))
    faces.extend([tuple(reversed(range(count))), tuple(range(len(vertices)-count, len(vertices)))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = Vector(axis).to_track_quat("Z", "Y").to_euler()
    for poly in list(mesh.polygons)[:-2]:
        poly.use_smooth = True
    return obj


def frame_profile(collection, mat, w, h, d, border):
    # A single continuous mitred profile, from outer back to recessed inner lip.
    section = [(0,0), (0.002,0.002), (0.002,d-0.005), (0.005,d),
               (0.014,d), (0.017,d-0.004), (0.020,d-0.004),
               (border-0.007,0.029), (border-0.003,0.031), (border,0.029),
               (border,0.017), (border-0.004,0)]
    verts, faces = [], []
    for inset, depth in section:
        dx, dz = w-inset, h-inset
        verts.extend([(-dx,-depth,-dz),(dx,-depth,-dz),(dx,-depth,dz),(-dx,-depth,dz)])
    for j in range(len(section)):
        nxt = (j+1) % len(section)
        for i in range(4):
            k = (i+1) % 4
            faces.append((4*j+i,4*j+k,4*nxt+k,4*nxt+i))
    mesh = bpy.data.meshes.new("Frame_Moulding")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    collection.objects.link(bpy.data.objects.new("Frame_Moulding", mesh))
