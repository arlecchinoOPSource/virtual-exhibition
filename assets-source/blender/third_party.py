"""Bring a downloaded third-party GLB into the gallery scene (docs/ASSET_PIPELINE.md,
"Third-party asset intake", steps 3-5).

The original stays untouched under assets-source/third-party/<id>/. This module
imports it, joins its meshes into one object, drops empties, cameras and lights,
scales it to a real-world height, puts its origin at the centre of its base,
turns it to face the room, and stands it against a wall inside the plan's
furniture envelope. Every material is replaced by one vertex-colour material, so
the prop costs a single draw. It fails the build if the result leaves the
envelope.
"""
import json
import math
import re

import bpy
from mathutils import Matrix, Vector


BAKED = "Baked"


def bake_colours(mesh, path):
    """Bake each face's glTF base colour factor, times any vertex colour the
    model has, into one corner colour attribute (8-bit, sRGB-encoded), so a single material
    can show every original material's colour."""
    with open(path, "rb") as glb:
        glb.seek(12)
        length = int.from_bytes(glb.read(4), "little")
        glb.read(4)
        document = json.loads(glb.read(length))
    factors = {m.get("name"): m.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])
               for m in document.get("materials", [])}

    def factor(material):
        name = material.name if material else None
        if name not in factors and name:
            name = re.sub(r"\.\d{3}$", "", name)
        return factors.get(name, [1, 1, 1, 1])[:3]

    source = mesh.color_attributes[0] if len(mesh.color_attributes) else None
    baked = mesh.color_attributes.new(BAKED, "BYTE_COLOR", "CORNER")
    for poly in mesh.polygons:
        rgb = factor(mesh.materials[poly.material_index] if mesh.materials else None)
        for loop in poly.loop_indices:
            tint = (1, 1, 1)
            if source is not None:
                index = loop if source.domain == "CORNER" else mesh.loops[loop].vertex_index
                tint = source.data[index].color[:3]
            baked.data[loop].color = (rgb[0] * tint[0], rgb[1] * tint[1], rgb[2] * tint[2], 1)
    for attribute in [a for a in mesh.color_attributes if a.name != BAKED]:
        mesh.color_attributes.remove(attribute)
    mesh.color_attributes.active_color = mesh.color_attributes[BAKED]


def vertex_colour_material(name, roughness=0.8):
    """One material that shows the mesh's vertex colours (exported as COLOR_0)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes["Principled BSDF"]
    shader.inputs["Roughness"].default_value = roughness
    colour = nodes.new("ShaderNodeVertexColor")
    colour.layer_name = BAKED
    mat.node_tree.links.new(colour.outputs["Color"], shader.inputs["Base Color"])
    return mat


def import_prop(path, name, collection, envelope, height, turn_deg, wall="N", gap=0.05,
                base_z=0.0, material=None):
    """Import, normalize and place a prop. Returns the object and its measures.

    envelope is the plan rectangle [x0, x1, y0, y1] in Blender metres; the prop
    is centred along the wall named by `wall` and stands `gap` off that side,
    or centred in it for wall "C". base_z lifts it onto a surface. A shared
    material lets a room's props be joined into one draw.
    turn_deg turns the model about Z so its front faces into the room.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    source = {
        "objects": len(imported),
        "meshes": len(meshes),
        "materials": len({m for obj in meshes for m in obj.data.materials if m}),
        "triangles": sum(len(p.vertices) - 2 for obj in meshes for p in obj.data.polygons),
        "vertices": sum(len(obj.data.vertices) for obj in meshes),
    }

    # Bake every transform into the vertices and join the meshes into one.
    bpy.context.view_layer.update()
    for obj in meshes:
        obj.data.transform(obj.matrix_world)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
    for obj in imported:
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    prop = bpy.context.view_layer.objects.active
    prop.name = prop.data.name = name
    for coll in list(prop.users_collection):
        coll.objects.unlink(prop)
    collection.objects.link(prop)

    # Turn to face the room, scale to height, origin at the centre of the base.
    mesh = prop.data
    mesh.transform(Matrix.Rotation(math.radians(turn_deg), 4, "Z"))
    lo = Vector([min(v.co[i] for v in mesh.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in mesh.vertices) for i in range(3)])
    scale = height / (hi.z - lo.z)
    mesh.transform(Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
    mesh.transform(Matrix.Scale(scale, 4))
    size = (hi - lo) * scale

    x0, x1, y0, y1 = envelope
    at = {
        "N": ((x0 + x1) / 2, y1 - gap - size.y / 2),
        "S": ((x0 + x1) / 2, y0 + gap + size.y / 2),
        "E": (x1 - gap - size.x / 2, (y0 + y1) / 2),
        "W": (x0 + gap + size.x / 2, (y0 + y1) / 2),
        "C": ((x0 + x1) / 2, (y0 + y1) / 2),
    }[wall]
    prop.location = (at[0], at[1], base_z)
    bounds = (at[0] - size.x / 2, at[0] + size.x / 2, at[1] - size.y / 2, at[1] + size.y / 2)
    if bounds[0] < x0 - 1e-6 or bounds[1] > x1 + 1e-6 or bounds[2] < y0 - 1e-6 or bounds[3] > y1 + 1e-6:
        raise ValueError(f"{name} ({size.x:.2f} x {size.y:.2f} m) does not fit its envelope {envelope}.")

    bake_colours(mesh, path)
    # No texture reads them, so the UVs only cost transfer.
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    mesh.materials.clear()
    mesh.materials.append(material or vertex_colour_material(f"{name}_Paint"))
    for poly in mesh.polygons:
        poly.material_index = 0
    return prop, {
        **source,
        "scale": scale,
        "size_m": tuple(round(v, 3) for v in size),
        "bounds": tuple(round(v, 3) for v in bounds),
    }


def colour_block(name, collection, rect, z0, z1, rgb, material):
    """An original, plain box in one vertex colour, for joining with a room's
    props (for example a cabinet that a prop stands on)."""
    x0, x1, y0, y1 = rect
    mesh = bpy.data.meshes.new(name)
    verts = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    mesh.from_pydata(verts, [], faces)
    baked = mesh.color_attributes.new(BAKED, "BYTE_COLOR", "CORNER")
    for item in baked.data:
        item.color = (*rgb, 1)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj
