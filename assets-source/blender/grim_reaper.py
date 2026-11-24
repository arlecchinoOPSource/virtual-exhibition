"""Stationary entrance sculpture. Local -Y faces the visitor; Z is gallery height."""
import math

import bpy
from mathutils import Vector


class Sculpture:
    """Collect same-finish surfaces into a single drawable mesh."""
    def __init__(self):
        self.vertices = []
        self.faces = []

    def rings(self, sections, cap=True):
        start = len(self.vertices)
        count = len(sections[0])
        for ring in sections:
            self.vertices.extend(ring)
        for j in range(len(sections)-1):
            for i in range(count):
                a = start + j*count + i
                b = start + j*count + (i+1) % count
                self.faces.append((a, b, b+count, a+count))
        end = start + (len(sections)-1)*count
        if cap:
            self.faces.extend([tuple(reversed(range(start,start+count))),
                               tuple(range(end,end+count))])

    def tube(self, points, radii, segments=10, pleats=0):
        points = list(map(Vector, points))
        rings = []
        for j,(point,radius) in enumerate(zip(points,radii)):
            tangent = (points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
            cross = tangent.cross(Vector((1,0,0))).normalized()
            side = tangent.cross(cross)
            ring = []
            for i in range(segments):
                a = math.tau*i/segments
                r = radius*(1+0.115*math.cos(pleats*a+0.4*j)) if pleats else radius
                ring.append(point+r*(cross*math.cos(a)+side*math.sin(a)))
            rings.append(ring)
        self.rings(rings)

    def oval(self, center, scale, segments=16):
        x,y,z = center
        rx,ry,rz = scale
        self.rings([[(x+rx*math.cos(t)*math.cos(a), y+ry*math.cos(t)*math.sin(a),
                      z+rz*math.sin(t)) for a in angles(segments)]
                    for t in [-1.565,-1.18,-0.78,-0.4,0,0.4,0.78,1.18,1.565]])

    def object(self, name, mat, collection):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        mesh.materials.append(mat)
        for poly in mesh.polygons:
            poly.use_smooth = True
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        return obj


def angles(n):
    return [i*math.tau/n for i in range(n)]


def sculpt_reaper(collection, sx, sy, cloth, bone, wood, steel, shadow, heading=-117):
    robe, hands, void, haft, blade = (Sculpture() for _ in range(5))
    # Broad, even folds: one rhythm from the shoulders to the pooled hem.
    def drape(levels, mantle=False):
        rings = []
        for z,w,d,amp in levels:
            ring = []
            for a in angles(32):
                fold = math.cos(5*a+0.6*z)
                x = (w+amp*fold)*math.cos(a)
                y = (d+amp*fold)*math.sin(a)
                sag = 0.08*math.sin(a) if mantle else 0
                ring.append((x, y, z+sag))
            rings.append(ring)
        robe.rings(rings)
    drape([(0.41,.32,.27,.022),(.54,.315,.27,.022),(.90,.265,.22,.020),
           (1.28,.19,.17,.016),(1.62,.21,.145,.010),(1.79,.27,.155,.008),
           (1.92,.21,.13,.006),(1.98,.10,.09,.004)])
    drape([(1.57,.26,.212,.006),(1.78,.327,.193,.008),(1.94,.19,.148,.006),
           (2.00,.115,.105,.004)], True)
    # Hood loops run from the rear crown out to the opening, then back along the
    # inside of its turned edge. The aperture narrows to a point at the breast.
    hood = []
    for y,w,h,cz in [(0.20,.055,.09,2.17),(.16,.15,.18,2.17),
                       (.08,.207,.235,2.16),(-.04,.221,.263,2.15),
                       (-.15,.212,.273,2.145),(-.206,.201,.267,2.145),
                       (-.215,.194,.261,2.145),(-.204,.183,.251,2.145),
                       (-.128,.177,.242,2.147),(-.027,.157,.192,2.16)]:
        ring=[]
        for a in angles(32):
            s,c=math.sin(a),math.cos(a)
            taper=1-0.40*max(0,-s)
            # The hood projects forwards over the brow.
            lip = min(1, max(0, (-y-0.025)/0.16))
            overhang = max(0,s)**2 * lip
            ring.append((w*c*taper, y-0.090*overhang,
                         cz+h*s-0.074*overhang-0.045*max(-s,0)**3))
        hood.append(ring)
    robe.rings(hood,cap=False)
    # No face: a matte black mass fills the hood so the opening reads as
    # shadow from any angle, with or without realtime shadows.
    void.oval((0,-.09,2.13),(.13,.10,.18),16)

    # Each hand is a simple bony mitten clasping the diagonal shaft.
    shaft_base = Vector((-.35,-.21,.42))
    shaft_top = Vector((.43,-.32,2.72))
    def grip(z):
        return shaft_base.lerp(shaft_top,(z-shaft_base.z)/(shaft_top.z-shaft_base.z))
    for sign,z in [(-1,1.25),(1,1.78)]:
        hand = grip(z)
        wrist = hand+Vector((0.068*sign,.018,-.025))
        elbow = Vector((sign*.31,-.04,1.50 if sign>0 else 1.36))
        shoulder = Vector((sign*.215,.005,1.81))
        cuff = wrist.lerp(elbow,.22)
        robe.tube([shoulder,elbow,cuff,cuff+(cuff-elbow).normalized()*.008],
                  [.095,.102,.118,.09],16)
        hands.tube([wrist,hand+Vector((sign*.03,-.012,0)),
                    hand+Vector((-sign*.012,-.03,0))],[.022,.026,.018],10)
    haft.tube([shaft_base,shaft_top],[.022,.022],8)
    axis=(shaft_top-shaft_base).normalized()
    blade.tube([shaft_top-axis*.093,shaft_top+axis*.016],[.028,.027],8)
    # Crescent blade: a flat wedge from spine to edge.
    sections=[]
    for i in range(13):
        t=i/12
        x=.43-1.02*t
        z=2.70+.19*math.sin(t*math.pi)-.26*t**2
        width=.003+.105*(1-t)**.55
        y=-.32+.09*t
        sections.append([(x,y-.007,z),(x,y+.007,z),(x,y,z-width)])
    blade.rings(sections)
    parts=[robe.object("Statue_Cloak",cloth,collection),
           void.object("Statue_Hood_Shadow",shadow,collection),
           hands.object("Statue_Hands",bone,collection),
           haft.object("Statue_Staff",wood,collection),
           blade.object("Statue_Blade",steel,collection)]
    # Flat faces keep the scythe's bevel readable in the realtime light.
    for face in parts[-1].data.polygons:
        face.use_smooth = False
    for part in parts:
        part.rotation_euler.z=math.radians(heading)
        part.location=(sx,sy,0)
