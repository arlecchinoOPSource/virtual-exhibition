"""Original gallery materials and millwork. All dimensions are in metres."""
import math

import bpy
import numpy as np
from mathutils import Vector


def oak_floor(obj, mat):
    """Cut the visible slab face into boards and map each into a mill-stock atlas."""
    rng = np.random.default_rng(48)
    width, strips, strip_height = 2048, 16, 64
    height = strips * strip_height
    color = np.ones((height, width, 4), dtype=np.float32)
    rough = np.zeros((height, width), dtype=np.float32)
    relief = np.zeros_like(rough)
    y, x = np.mgrid[:strip_height, :width]
    u, v = x / width, y / strip_height
    for i in range(strips):
        # Vary the cut through a virtual log, from straight quarter-sawn grain
        # to arched grain where the board passes closer to the heart.
        phase = rng.uniform(0, math.tau)
        wander = 0.038 * np.sin(u * 9 + phase) + 0.012 * np.sin(u * 21 - phase)
        # Most boards intersect one side of the growth rings. Narrow patches
        # of cross-grain and irregular fibre drift break up the arched cuts.
        drift = np.interp(u[0], np.linspace(0, 1, 27), rng.normal(0, 0.012, 27))
        offset = rng.uniform(-1.15, 0.12)
        across = v - offset + wander + drift
        lengthwise = (u - rng.uniform(0.15, 0.85)) * rng.uniform(0.7, 2.2)
        radius = np.sqrt(across**2 + lengthwise**2 + 0.08)
        ring = radius * rng.uniform(15, 23) + 0.18 * np.sin(radius * 24 + phase)
        earlywood = np.exp(-((np.sin(np.pi * ring) / 0.40) ** 2))
        # Broken longitudinal vessels taper along the grain direction.
        fibres = np.sin(2 * np.pi * (across * 39 + 0.19 * np.sin(u*32+phase)))
        pores = np.maximum(fibres, 0)**6 * (0.5 + 0.5*np.sin(u*78 + v*16 + phase))**2
        knot = np.zeros_like(u)
        if i % 4 == 0:
            dist = np.hypot((u-rng.uniform(0.25, 0.75))/0.009, (v-0.47)/0.077)
            knot = np.exp(-dist**2) + 0.18*np.exp(-dist)*np.cos(8*dist)
        tone = rng.uniform(0.93, 1.07) + 0.032*np.sin(ring*1.3)
        patches = np.interp(u[0], np.linspace(0, 1, 19), rng.uniform(0.25, 1.0, 19))
        streaks = np.interp(across, np.linspace(-2, 3, 340), rng.normal(0, 0.034, 340))
        tone += streaks - (0.11*patches*earlywood + 0.065*pores + 0.23*knot)
        tone += rng.normal(0, 0.006, u.shape)
        seam = (y == 2) | (y == strip_height-3)
        tone[seam] *= 0.94
        rows = slice(i*strip_height, (i+1)*strip_height)
        color[rows, :, :3] = tone[..., None] * (0.705, 0.555, 0.365)
        rough[rows] = rng.uniform(0.33, 0.39) + 0.1*earlywood + 0.035*pores
        relief[rows] = 0.08*earlywood + 0.04*pores + 0.18*seam

    shader = mat.node_tree.nodes["Principled BSDF"]
    def map_image(name, pixels, linear=False):
        h, w = pixels.shape[:2]
        img = bpy.data.images.new(name, w, h, alpha=False)
        if linear:
            img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
        img.pack()
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = img
        return node.outputs["Color"]

    links = mat.node_tree.links
    links.new(map_image("Honey oak - sawn figure", color), shader.inputs["Base Color"])
    # Lower-resolution finish maps carry the soft sheen without overspending on transfer.
    rough = rough.reshape(height//2, 2, width//4, 4).mean(axis=(1, 3))
    finish = np.ones((*rough.shape, 4), dtype=np.float32)
    finish[:, :, :3] = rough[:, :, None]
    links.new(map_image("Satin oil - roughness", finish, True), shader.inputs["Roughness"])
    down = relief.reshape(height//2, 2, width//4, 4).mean(axis=(1, 3))
    dy, dx = np.gradient(down)
    normal = np.ones((*down.shape, 4), dtype=np.float32)
    normal[:, :, 0] = 0.5 + dx * 0.32
    normal[:, :, 1] = 0.5 + dy * 0.48
    normal_node = mat.node_tree.nodes.new("ShaderNodeNormalMap")
    links.new(map_image("Oak pores - tangent normal", normal, True), normal_node.inputs["Color"])
    links.new(normal_node.outputs["Normal"], shader.inputs["Normal"])
    shader.inputs["Coat Weight"].default_value = 0.19
    shader.inputs["Coat Roughness"].default_value = 0.32

    # Keep the slab sides, bottom, top elevation and independent collider intact.
    slab = obj.data
    verts = [tuple(pt.co) for pt in slab.vertices]
    faces = [tuple(f.vertices) for f in slab.polygons if f.normal.z < 0.9]
    board_uvs = []
    z = max(pt[2] for pt in verts)
    xmin, xmax = min(pt[0] for pt in verts), max(pt[0] for pt in verts)
    ymin, ymax = min(pt[1] for pt in verts), max(pt[1] for pt in verts)
    board_width = (ymax-ymin)/54
    for row in range(54):
        y0 = ymin + row*board_width
        x0 = xmin - rng.uniform(0, 1.35)
        while x0 < xmax:
            length = rng.uniform(1.45, 2.55)
            left, right = max(xmin, x0), min(xmax, x0+length)
            strip = rng.integers(strips)
            # Clip the sampled board as well as its geometry at the room perimeter.
            start = rng.uniform(0.01, 0.13)
            u0, u1 = start+(left-x0)/3.05, start+(right-x0)/3.05
            if rng.random() < 0.5:
                u0, u1 = 1-u0, 1-u1
            v0, v1 = (strip*strip_height + 2.5)/height, ((strip+1)*strip_height - 2.5)/height
            index = len(verts)
            verts.extend([(left,y0,z),(right,y0,z),(right,y0+board_width,z),(left,y0+board_width,z)])
            faces.append(tuple(range(index, index+4)))
            board_uvs.append(((u0,v0),(u1,v0),(u1,v1),(u0,v1)))
            x0 += length
    surface = bpy.data.meshes.new("Oak floorboards")
    surface.from_pydata(verts, [], faces)
    surface.materials.append(mat)
    uv = surface.uv_layers.new(name="Board grain")
    for poly, coords in zip(list(surface.polygons)[-len(board_uvs):], board_uvs):
        for loop, coord in zip(poly.loop_indices, coords):
            uv.data[loop].uv = coord
    obj.data = surface
    bpy.data.meshes.remove(slab)


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
