"""Original angular lettering and mounting for the BASEMENT OF DOOM sign.

Glyphs are stroke polylines on a unit cell (u right, v up), extruded as
raised cast bars. No font file is involved. The sign faces -X, so reading
left to right runs from +Y to -Y.
"""
import math

import bpy
from mathutils import Vector, noise

# Strokes per glyph in a 1 x 1 cell. Chamfered corners keep the counters open
# and give the letters a forged, heavy-metal edge without hurting legibility.
GLYPHS = {
    "A": [[(0, 0), (0.42, 1), (0.58, 1), (1, 0)], [(0.2, 0.38), (0.8, 0.38)]],
    "B": [[(0, 0), (0, 1), (0.72, 1), (0.88, 0.86), (0.88, 0.66), (0.74, 0.53), (0, 0.53)],
          [(0.74, 0.53), (1, 0.38), (1, 0.14), (0.84, 0), (0, 0)]],
    "D": [[(0, 0), (0, 1), (0.68, 1), (1, 0.7), (1, 0.3), (0.68, 0), (0, 0)]],
    "E": [[(1, 1), (0, 1), (0, 0), (1, 0)], [(0, 0.52), (0.72, 0.52)]],
    "F": [[(1, 1), (0, 1), (0, 0)], [(0, 0.52), (0.7, 0.52)]],
    "M": [[(0, 0), (0, 1), (0.5, 0.42), (1, 1), (1, 0)]],
    "N": [[(0, 0), (0, 1), (1, 0), (1, 1)]],
    "O": [[(0.22, 0), (0.78, 0), (1, 0.22), (1, 0.78), (0.78, 1), (0.22, 1),
           (0, 0.78), (0, 0.22), (0.22, 0)]],
    "S": [[(1, 0.84), (0.84, 1), (0.16, 1), (0, 0.84), (0, 0.64), (0.16, 0.52),
           (0.84, 0.48), (1, 0.36), (1, 0.16), (0.84, 0), (0.16, 0), (0, 0.16)]],
    "T": [[(0, 1), (1, 1)], [(0.5, 1), (0.5, 0)]],
}
# The first and last letters carry tapering tails, the classic metal framing
# device, while the rest of the line stays plain and readable.
TAILS = {0: [(0, 0), (-0.15, -0.4)], -1: [(1, 0), (1.15, -0.4)]}
# Pointed serifs crown the stems that stand at a cell edge.
CROWNS = {"B": [0], "D": [0], "E": [0], "F": [0], "M": [0, 1], "N": [0, 1]}


class Relief:
    def __init__(self):
        self.vertices, self.faces = [], []

    def prism(self, outline, x_front, x_back):
        """Extrude a convex (y, z) outline from x_back forwards to x_front."""
        n = len(outline)
        start = len(self.vertices)
        self.vertices += [(x_front, y, z) for y, z in outline]
        self.vertices += [(x_back, y, z) for y, z in outline]
        self.faces.append(tuple(start + i for i in range(n)))
        self.faces.append(tuple(start + n + i for i in reversed(range(n))))
        for i in range(n):
            j = (i + 1) % n
            self.faces.append((start + i, start + n + i, start + n + j, start + j))

    def object(self, name, mat, collection):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.validate()
        mesh.update()
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        # Prisms are wound by hand; let Blender make every normal face out.
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        return obj


def bar(relief, a, b, width, x_front, x_back, point=False):
    """A stroke from a to b, or one sharpened to a point at b."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    n = Vector((-d.y, d.x)) * width / 2
    outline = [a - n, b, a + n] if point else [a - n, b - n, b + n, a + n]
    relief.prism([tuple(p) for p in outline], x_front, x_back)


def joint(relief, centre, width, x_front, x_back):
    """A chamfered octagon that closes the corner between two strokes."""
    r = width / 2 / math.cos(math.pi / 8)
    relief.prism([(centre[0] + r * math.cos((k + 0.5) * math.tau / 8),
                   centre[1] + r * math.sin((k + 0.5) * math.tau / 8)) for k in range(8)],
                 x_front, x_back)


def letter_strokes(text, height, cell, gap, space):
    """Glyph strokes in sign coordinates (u, v), centred on u = 0."""
    width = sum(space if c == " " else cell for c in text) + gap * (len(text) - 1)
    drawn = [i for i, c in enumerate(text) if c != " "]
    cursor, strokes = -width / 2, []
    for i, char in enumerate(text):
        if char == " ":
            cursor += space + gap
            continue

        def place(point, x=cursor):
            return (x + point[0] * cell, point[1] * height)

        strokes += [([place(p) for p in stroke], False) for stroke in GLYPHS[char]]
        for key, tail in TAILS.items():
            if drawn[key] == i:
                strokes.append(([place(p) for p in tail], True))
        for side in CROWNS.get(char, []):
            strokes.append(([place((side, 1.0)), place((side, 1.2))], True))
        cursor += cell + gap
    return strokes


def build_sign(collection, iron, lettering_mat, wall_x, z_center, half_length, text):
    """Board on standoffs, raised lettering, crown spikes and bolt heads."""
    gap, thick, relief_depth = 0.045, 0.04, 0.022
    board_back = wall_x - gap
    board_front = board_back - thick
    z0, z1 = z_center - 0.24, z_center + 0.24

    board = Relief()
    bevel = 0.03
    outline = [(-half_length + bevel, z0), (half_length - bevel, z0),
               (half_length, z0 + bevel), (half_length, z1 - bevel),
               (half_length - bevel, z1), (-half_length + bevel, z1),
               (-half_length, z1 - bevel), (-half_length, z0 + bevel)]
    board.prism(outline, board_front, board_back)
    # A raised rim frames the lettering field.
    rim, lip = 0.035, 0.008
    for y in (-half_length, half_length - rim):
        board.prism([(y, z0), (y + rim, z0), (y + rim, z1), (y, z1)],
                    board_front - lip, board_front)
    for z in (z0, z1 - rim):
        board.prism([(-half_length, z), (half_length, z), (half_length, z + rim),
                     (-half_length, z + rim)], board_front - lip, board_front)
    # Spikes along the crown; the outer and centre ones stand taller.
    for index in range(9):
        y = -half_length + 0.2 + index * (2 * half_length - 0.4) / 8
        tall = 0.22 if index in (0, 4, 8) else 0.15
        board.prism([(y - 0.07, z1), (y + 0.07, z1), (y, z1 + tall)],
                    board_front + 0.008, board_back - 0.008)
    # Standoffs hold the board off the wall; bolt heads show on the rim.
    for y in (-half_length + 0.12, half_length - 0.12):
        for z in (z0 + 0.1, z1 - 0.1):
            hexagon = [(y + 0.022 * math.cos(k * math.tau / 6),
                        z + 0.022 * math.sin(k * math.tau / 6)) for k in range(6)]
            board.prism(hexagon, board_back, wall_x)
            board.prism(hexagon, board_front - 0.016, board_front)
    board_obj = board.object("Sign_Board", iron, collection)

    letters = Relief()
    height = 0.22
    front, back = board_front - relief_depth, board_front + 0.002
    baseline = z_center - height / 2 + 0.02
    for points, sharp in letter_strokes(text, height, 0.16, 0.045, 0.12):
        # u runs along -Y so the line reads left to right from the gallery.
        world = [(-u, baseline + v) for u, v in points]
        for k, (a, b) in enumerate(zip(world, world[1:])):
            bar(letters, a, b, 0.034, front, back, sharp and k == len(world) - 2)
        for k, point in enumerate(world):
            if not (sharp and k == len(world) - 1):
                joint(letters, point, 0.034, front, back)
    sign = letters.object("Sign_Basement", lettering_mat, collection)
    sign["text"] = text

    weather(board_obj, iron, (0.05, 0.048, 0.046), (0.17, 0.16, 0.15), z_center, half_length)
    weather(sign, lettering_mat, (0.6, 0.55, 0.46), (0.8, 0.76, 0.68), z_center, half_length)
    return board_obj, sign


def weather(obj, mat, base, worn, z_center, half_length):
    """Bake rubbed-bright edges and mottled grime into vertex colour."""
    mesh = obj.data
    colors = mesh.color_attributes.new(name="Wear", type="BYTE_COLOR", domain="POINT")
    for vertex in mesh.vertices:
        p = vertex.co
        grime = 0.5 + 0.5 * noise.noise(p * 9)
        edge = max(abs(p.y) / half_length, abs(p.z - z_center) / 0.3) ** 6
        t = min(1, 0.3 * grime + 0.6 * edge)
        rgb = [b + (w - b) * t for b, w in zip(base, worn)]
        colors.data[vertex.index].color = (*rgb, 1)
    tint = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    tint.layer_name = colors.name
    mat.node_tree.links.new(tint.outputs["Color"],
                            mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
