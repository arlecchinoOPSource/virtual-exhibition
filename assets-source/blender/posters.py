"""Paper prints of historical artworks pasted to the cellar walls.

Each poster is its own sheet, material, and image slot, so one print can be
replaced (swap the file in assets-source/posters/) without touching the
other. The artwork keeps its source proportions: the sheet is sized from the
image and gets a narrow paper margin. The sheet stands 5 mm off the plaster,
bows a few millimetres between its pasted corners, and one corner lifts where
the paste has given way. Ageing is baked at build time and kept light: the
margin yellows toward the edges and the print takes a faint, uneven tone. The
source files stay exactly as supplied; see public/models/CREDITS.md.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Vector

from basement_surfaces import fbm

SOURCES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "posters")
# Off-white rag paper, as display values like the image pixels.
PAPER = np.array([0.86, 0.83, 0.75])


def hang_poster(collection, name, source, centre, normal, art_height, margin=0.03, seed=0,
                curl_corner=(1, 1), crop=None):
    """Paste a print of `source` on a wall.

    centre is the wall point behind the sheet's middle and normal the wall's
    outward horizontal direction. art_height is the artwork's height in metres;
    its width follows the image. curl_corner picks the lifting corner as
    (right, top) signs seen from the front. crop, if given, is the
    (left, top, right, bottom) pixel box to keep, measured from the image's
    top-left corner like an image editor; the source file stays untouched.
    """
    art = bpy.data.images.load(os.path.join(SOURCES, source))
    w, h = art.size
    pixels = np.empty(w * h * 4, np.float32)
    art.pixels.foreach_get(pixels)
    bpy.data.images.remove(art)
    # Blender stores rows bottom first.
    pixels = pixels.reshape(h, w, 4)[..., :3]
    if crop:
        left, top, right, bottom = crop
        pixels = pixels[h - bottom:h - top, left:right]
        h, w = pixels.shape[:2]
    ppm = h / art_height
    pad = round(margin * ppm)
    W, H = w + 2 * pad, h + 2 * pad
    sheet = np.empty((H, W, 3), np.float32)
    sheet[:] = PAPER
    sheet[pad:pad + h, pad:pad + w] = pixels

    # Ageing: a faint mottled tone over the sheet and a yellowed margin.
    jj, ii = np.mgrid[:H, :W]
    s, t = (ii + 0.5) / ppm, (jj + 0.5) / ppm
    local = np.stack([s.ravel(), t.ravel(), np.full(s.size, seed * 3.1)], 1)
    mottle = fbm(local, 6, 3, 90 + seed).reshape(H, W)
    edge = np.minimum(np.minimum(s, W / ppm - s), np.minimum(t, H / ppm - t))
    yellow = np.clip(1 - edge / 0.05, 0, 1) ** 2 * 0.25 + (mottle - 0.5) * 0.08
    sheet *= 1 - yellow[..., None] * np.array([0.25, 0.4, 0.75])
    rgba = np.ones((H, W, 4), np.float32)
    rgba[..., :3] = np.clip(sheet, 0, 1)
    img = bpy.data.images.new(f"{name} - print", W, H, alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()

    mat = bpy.data.materials.new(f"{name}_Print")
    shader = mat.node_tree.nodes["Principled BSDF"]
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    shader.inputs["Roughness"].default_value = 0.88
    # The lifted corner shows its back from a glancing angle.
    mat.use_backface_culling = False

    # The sheet: a grid bowed off the wall, with one corner curling away.
    width, height = W / ppm, H / ppm
    n = Vector((*normal, 0)).normalized()
    right = (-n).cross(Vector((0, 0, 1)))
    up = Vector((0, 0, 1))
    origin = Vector(centre)
    cols, rows = max(2, round(width / 0.06)), max(2, round(height / 0.06))
    corner = Vector((curl_corner[0] * width / 2, curl_corner[1] * height / 2))
    verts, uvs = [], []
    for r in range(rows + 1):
        for c in range(cols + 1):
            u, v = c / cols, r / rows
            x, y = (u - 0.5) * width, (v - 0.5) * height
            bow = 0.004 * math.sin(math.pi * u) * math.sin(math.pi * v)
            reach = max(0.0, 1 - (Vector((x, y)) - corner).length / 0.16)
            off = 0.005 + bow + 0.03 * reach ** 2.5
            verts.append(origin + right * x + up * y + n * off)
            uvs.append((u, v))
    faces = [(r * (cols + 1) + c, r * (cols + 1) + c + 1, (r + 1) * (cols + 1) + c + 1,
              (r + 1) * (cols + 1) + c) for r in range(rows) for c in range(cols)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    uv = mesh.uv_layers.new(name="Print")
    for loop in mesh.loops:
        uv.data[loop.index].uv = uvs[loop.vertex_index]
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj["artwork"] = source
    collection.objects.link(obj)
    return obj
