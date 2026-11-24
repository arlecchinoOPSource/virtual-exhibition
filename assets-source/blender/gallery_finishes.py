"""Original gallery materials and millwork. All dimensions are in metres."""
import math

import bpy
import numpy as np
from mathutils import Vector


def oak_floor(obj, mat):
    """Bake one nonrepeating color map across the complete 20.4 m slab."""
    width, height = 2048, 1024
    rng = np.random.default_rng(48)
    pixels = np.ones((height, width, 4), dtype=np.float32)
    for y0 in range(0, height, 20):
        rows = min(20, height - y0)
        x0 = -int(rng.integers(0, 115))
        while x0 < width:
            length = int(rng.integers(115, 245))
            lo, hi = max(0, x0), min(width, x0 + length)
            y, x = np.mgrid[:rows, lo:hi]
            u = (x - x0) / length
            v = y / 20 - rng.uniform(0.15, 0.85)
            # Long curved growth rings, fine vessels and occasional dark heartwood.
            axis = v + 0.06 * np.sin(u * 5 + rng.uniform(0, 6))
            rings = 2 * np.pi * (np.sqrt(axis**2 + (u - 0.5)**2 * 0.6 + 0.02) * 10)
            grain = 0.034 * np.cos(rings) + 0.013 * np.cos(rings * 2)
            fiber = rng.normal(0, 0.009, (rows, hi-lo))
            tone = rng.uniform(0.90, 1.09) + grain + fiber
            tone[y == 0] *= 0.91
            tone[x == x0] *= 0.90
            pixels[y0:y0+rows, lo:hi, :3] = tone[..., None] * (0.66, 0.50, 0.35)
            x0 += length
    image = bpy.data.images.new("European oak - staggered boards", width, height, alpha=False)
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    mat.node_tree.links.new(texture.outputs["Color"], mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    uv = obj.data.uv_layers.new(name="FloorPlan")
    for loop in obj.data.loops:
        x, y, _ = obj.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (x / 20.4 + 0.5, y / 10.4 + 0.5)


def paint_finish(mat):
    # Fine roller stipple in roughness only. The paint stays opaque and clean.
    size = 128
    rng = np.random.default_rng(49)
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = rng.uniform(0.79, 0.94, (size, size, 1))
    image = bpy.data.images.new("Paint roller finish", size, size, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    mat.node_tree.links.new(texture.outputs["Color"], mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"])


def paint_uv(obj):
    layer = obj.data.uv_layers.new(name="Paint")
    for poly in obj.data.polygons:
        axis = max(range(3), key=lambda i: abs(poly.normal[i]))
        for index in poly.loop_indices:
            point = obj.data.vertices[obj.data.loops[index].vertex_index].co
            layer.data[index].uv = [point[i] * 4 for i in range(3) if i != axis]


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
