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
import math

import bpy
from mathutils import Matrix, Vector


def vertex_colour_material(name, roughness=0.8):
    """One material that shows the mesh's vertex colours (exported as COLOR_0)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    shader = nodes["Principled BSDF"]
    shader.inputs["Roughness"].default_value = roughness
    colour = nodes.new("ShaderNodeVertexColor")
    mat.node_tree.links.new(colour.outputs["Color"], shader.inputs["Base Color"])
    return mat


def import_prop(path, name, collection, envelope, height, turn_deg, wall="N", gap=0.05):
    """Import, normalize and place a prop. Returns the object and its measures.

    envelope is the plan rectangle [x0, x1, y0, y1] in Blender metres; the prop
    is centred along the wall named by `wall` and stands `gap` off that side.
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
    }[wall]
    prop.location = (at[0], at[1], 0)
    bounds = (at[0] - size.x / 2, at[0] + size.x / 2, at[1] - size.y / 2, at[1] + size.y / 2)
    if bounds[0] < x0 - 1e-6 or bounds[1] > x1 + 1e-6 or bounds[2] < y0 - 1e-6 or bounds[3] > y1 + 1e-6:
        raise ValueError(f"{name} ({size.x:.2f} x {size.y:.2f} m) does not fit its envelope {envelope}.")

    mesh.materials.clear()
    mesh.materials.append(vertex_colour_material(f"{name}_Paint"))
    for poly in mesh.polygons:
        poly.material_index = 0
    return prop, {
        **source,
        "scale": scale,
        "size_m": tuple(round(v, 3) for v in size),
        "bounds": tuple(round(v, 3) for v in bounds),
    }
