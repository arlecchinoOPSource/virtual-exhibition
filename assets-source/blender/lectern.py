"""Editable gallery catalogue stand and gently curved open book."""
import math

import bpy


def build_lectern(box, material, collection):
    oak = material("Lectern walnut", (0.24, 0.105, 0.043), 0.43)
    edge = material("Lectern edge grain", (0.15, 0.06, 0.022), 0.5)
    panel = material("Lectern face grain", (0.31, 0.15, 0.069), 0.48)
    cover = material("Catalogue linen cover", (0.07, 0.12, 0.094), 0.82)
    paper = material("Catalogue ivory paper", (0.83, 0.74, 0.57), 0.86)
    ink = material("Catalogue printing", (0.16, 0.115, 0.07), 0.9)

    def member(name, x0, x1, y0, y1, z0, z1, mat, bevel):
        obj = box(name, x0, x1, y0, y1, z0, z1, mat, collide=False)
        mod = obj.modifiers.new("Rounded joinery", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        obj.modifiers.new("Planar normals", "WEIGHTED_NORMAL")
        return obj

    member("Lectern_Base", -.34, .34, -.40, .40, 0, .07, edge, .025)
    member("Lectern_Shoe", -.24, .24, -.31, .31, .065, .135, oak, .022)
    member("Lectern_Pedestal", -.17, .17, -.235, .235, .12, 1.10, oak, .025)
    member("Lectern_Inset", -.185, -.169, -.18, .18, .22, .91, panel, .008)
    for y in (-.194, .194):
        member("Lectern_Stile", -.192, -.17, y-.012, y+.012, .17, .98, edge, .006)
    top = member("Lectern_Reading_Surface", -.30, .30, -.38, .38, 1.06, 1.12, oak, .015)
    top.rotation_euler.y = -math.atan(.29)
    member("Lectern_Lip", -.295, -.265, -.37, .37, 1.035, 1.075, edge, .009)

    def mesh(name, vertices, faces, mat):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.materials.append(mat)
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        return obj

    def height(x, y):
        return 1.150 + x * .29 + .016 * math.sin(math.pi * abs(y) / .24)

    hardcover = member("Catalogue_Cover", -.19, .19, -.25, .25, 1.116, 1.139, cover, .008)
    hardcover.rotation_euler.y = -math.atan(.29)
    vertices = [(x, y, height(x, y)) for y in [i * .02 for i in range(-12, 13)] for x in (-.177, .177)]
    pages = mesh("Catalogue_Pages", vertices, [(2*i, 2*i+1, 2*i+3, 2*i+2) for i in range(24)], paper)
    thickness = pages.modifiers.new("Paper block", "SOLIDIFY")
    thickness.thickness = .018
    for face in pages.data.polygons:
        face.use_smooth = True

    # Quiet typeset-like marks on an original catalogue spread.
    marks, quads = [], []
    for side in (-1, 1):
        for row in range(7):
            x = .112 - row * .033
            y = side * .115
            width = .066 if row < 6 else .038
            for segment in range(8):
                left = y - width + segment * width / 4
                right = left + width / 4
                quads.append(tuple(range(len(marks), len(marks) + 4)))
                marks.extend((u, v, height(u, v) + .002) for u, v in
                             [(x, left), (x+.004, left), (x+.004, right), (x, right)])
    mesh("Catalogue_Print", marks, quads, ink)
    proxy = box("Lectern_Clearance", -.35, .35, -.40, .40, 0, 1.2, oak)
    bpy.data.objects.remove(proxy, do_unlink=True)
