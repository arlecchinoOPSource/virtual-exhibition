"""Stationary entrance sculpture. Local -Y faces the visitor; Z is gallery height."""
import math

import bpy
from mathutils import Vector, noise


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


def sculpt_reaper(collection, sx, sy, cloth, bone, wood, steel):
    robe, skeleton, haft, blade = (Sculpture() for _ in range(4))
    # Skirt pools at the hem; narrower ribs converge at the belted waist.
    def drape(levels, mantle=False):
        rings = []
        for z,w,d,amp in levels:
            ring = []
            for a in angles(64):
                fold = (math.cos(5*a+1.1*z+0.5*math.sin(2*a))
                        + 0.30*math.cos(3*a-1.2*z)+0.12*math.sin(9*a+z))
                x = (w+amp*fold)*math.cos(a)
                y = (d+amp*fold)*math.sin(a)
                sag = (0.10*math.sin(a)+0.045*math.cos(a+0.5)) if mantle else 0.018*math.sin(5*a)
                ring.append((x+0.027*math.sin(2*z), y, z+sag*(1 if mantle else max(0,1-z))))
            rings.append(ring)
        robe.rings(rings)
    drape([(0.41,.32,.27,.025),(.44,.32,.28,.033),(.54,.315,.27,.032),
           (.76,.275,.235,.031),(1.03,.25,.205,.027),(1.28,.19,.17,.025),
           (1.46,.17,.14,.018),(1.62,.21,.145,.018),(1.79,.27,.155,.015),
           (1.92,.21,.13,.012),(1.98,.10,.09,.008)])
    drape([(1.55,.255,.208,.007),(1.57,.26,.212,.008),(1.66,.29,.209,.008),
           (1.78,.327,.193,.012),(1.86,.28,.177,.012),(1.94,.19,.148,.009),
           (2.00,.115,.105,.006)], True)
    # Hood loops run from the rear crown out to the opening, then back along the
    # inside of its turned edge. The aperture narrows to a point at the breast.
    hood = []
    for y,w,h,cz in [(0.20,.055,.09,2.17),(.16,.15,.18,2.17),
                       (.08,.207,.235,2.16),(-.04,.221,.263,2.15),
                       (-.15,.212,.273,2.145),(-.206,.201,.267,2.145),
                       (-.215,.194,.261,2.145),(-.204,.183,.251,2.145),
                       (-.128,.177,.242,2.147),(-.027,.157,.192,2.16)]:
        ring=[]
        for a in angles(64):
            s,c=math.sin(a),math.cos(a)
            taper=1-0.40*max(0,-s)
            # The hood creases at the crown, projecting forwards over the brow.
            lip = min(1, max(0, (-y-0.025)/0.16))
            overhang = max(0,s)**2 * lip
            ring.append((w*c*taper+0.013*s, y-0.090*overhang+0.026*c,
                         cz+h*s-0.074*overhang+0.035*overhang*max(0,1-abs(c)*3)-0.045*max(-s,0)**3))
        hood.append(ring)
    robe.rings(hood,cap=False)

    # Hands stagger along the diagonal shaft, sleeves open around the wrists.
    shaft_base = Vector((-.35,-.21,.42))
    shaft_top = Vector((.43,-.32,2.72))
    def grip(z):
        return shaft_base.lerp(shaft_top,(z-shaft_base.z)/(shaft_top.z-shaft_base.z))
    for sign,z in [(-1,1.25),(1,1.78)]:
        hand = grip(z)
        wrist = hand+Vector((0.068*sign,.018,-.025))
        elbow = Vector((sign*.31,-.04,1.50 if sign>0 else 1.36))
        shoulder = Vector((sign*.215,.005,1.81))
        start = wrist.lerp(elbow,.22)
        # Round the elbow bend and carry a single bell silhouette down to
        # a recessed cuff. Keeping the tube direction continuous avoids pinching.
        towards_hand = (start-elbow).normalized()
        robe.tube([shoulder,shoulder.lerp(elbow,.65),elbow,
                   elbow.lerp(start,.33),elbow.lerp(start,.77),start,
                   start+towards_hand*.006,start+towards_hand*.009],
                  [.092,.105,.101,.102,.113,.120,.118,.091],32,3)
        forearm = start.lerp(elbow,.18)
        for shift in [-.009,.009]:
            delta=Vector((shift,.004,0))
            skeleton.tube([forearm+delta,wrist+delta],
                          [.009,.007],10)
        # Four individually articulated rays curve forwards around the handle.
        for finger in range(4):
            offset=(finger-1.5)*.022
            root=hand+Vector((sign*.033,-.002,offset))
            mid=hand+Vector((sign*.016,-.030,offset+.009))
            tip=hand+Vector((-sign*.013,-.026,offset+.003))
            palm = wrist + Vector((0,0,offset*.38))
            distal = mid.lerp(tip,.60)+Vector((0,-.004,0))
            skeleton.tube([palm,root,root.lerp(mid,.45),mid,distal,tip],
                          [.005,.008,.005,.007,.005,.003],10)
            skeleton.oval(mid,(.008,.007,.007),8)
        skeleton.tube([wrist,hand+Vector((sign*.021,.025,.032)),
                       hand+Vector((-.010*sign,.014,.040))],[.010,.009,.006],8)

    # One continuous facial mass with sockets cut into its surface.
    skull = Sculpture()
    skull.rings([[(rx*math.cos(a),cy+ry*math.sin(a),z) for a in angles(36)]
                 for z,rx,ry,cy in [(2.005,.059,.044,-.12),(2.037,.074,.063,-.123),
                    (2.079,.100,.081,-.111),(2.117,.115,.098,-.103),
                    (2.178,.122,.108,-.103),(2.228,.114,.107,-.089),
                    (2.267,.088,.084,-.078),(2.286,.041,.047,-.076)]])
    for side in [-1,1]:
        # Fuse the arches to the face before carving the cavities. Their
        # intersections become a continuous brow and zygomatic process.
        skull.oval((side*.056,-.185,2.166),(.053,.026,.016),24)
        skull.oval((side*.084,-.158,2.103),(.030,.032,.020),24)
    skull.oval((0,-.193,2.123),(.016,.025,.040),24)
    head=skull.object("Statue_Skull",bone,collection)
    bpy.context.view_layer.objects.active=head
    head.data.remesh_voxel_size=.0033
    bpy.ops.object.voxel_remesh()
    for x,z,scale in [(-.055,2.139,(.046,.075,.036)),(.055,2.139,(.046,.075,.036)),
                      (0,2.081,(.022,.067,.032))]:
        cavity=Sculpture()
        cavity.oval((0,0,0),scale,32)
        cutter=cavity.object("Socket tool",bone,collection)
        cutter.location=(x,-.210,z)
        cutter.rotation_euler.y = -.17 if x>0 else (.17 if x<0 else 0)
        boolean=head.modifiers.new("Carved cavity","BOOLEAN")
        boolean.operation="DIFFERENCE"
        boolean.object=cutter
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
    reduce=head.modifiers.new("Retain facial planes","DECIMATE")
    reduce.ratio=.28
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    # Baked cavity shading retains socket depth in the shadowless web renderer.
    patina=head.data.color_attributes.new(name="Bone patina",type="BYTE_COLOR",domain="POINT")
    skull_mat=bone.copy()
    head.data.materials.clear()
    head.data.materials.append(skull_mat)
    pigment=skull_mat.node_tree.nodes.new("ShaderNodeVertexColor")
    pigment.layer_name=patina.name
    skull_mat.node_tree.links.new(pigment.outputs["Color"],skull_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    for vertex in head.data.vertices:
        x,y,z=vertex.co
        orbit=((abs(x)-.055)/.049)**2+((z-2.139)/.041)**2
        nose=(x/.023)**2+((z-2.081)/.035)**2
        depth=min(1,max(0,(y+.206)/.048))
        cavity=max(0,1-min(orbit,nose)) if y<-.12 else 0
        shade=(1-.95*depth*cavity**.5)*(1+.045*noise.noise_vector(vertex.co*125).x)
        patina.data[vertex.index].color=(.46*shade,.37*shade,.24*shade,1)
    for face in head.data.polygons:
        face.use_smooth=True
    for side in [-1,1]:
        skeleton.tube([(side*.094,-.125,2.09),(side*.084,-.12,2.033),
                       (side*.065,-.142,1.993),(side*.033,-.177,1.985),(0,-.182,1.985)],
                      [.014,.012,.014,.014,.012])
    for j in range(-4,5):
        x=j*.013
        y=-.183+0.026*(j/4)**2
        skeleton.oval((x,y,2.012),(.0066,.008,.008+(.003 if abs(j)==3 else 0)),12)
        skeleton.oval((x,y+.001,1.997),(.006,.008,.006),10)
    haft.tube([shaft_base,grip(.95),grip(1.65),grip(2.43),shaft_top],
              [.022,.020,.023,.020,.024],14)
    axis=(shaft_top-shaft_base).normalized()
    blade.tube([shaft_top-axis*.093,shaft_top+axis*.016],[.028,.027],16)
    # Forged crescent with a raised spine and a thin cutting edge.
    sections=[]
    for i in range(33):
        t=i/32
        x=.43-1.02*t
        z=2.70+.19*math.sin(t*math.pi)-.26*t**2
        width=.003+.105*(1-t)**.55
        y=-.32+.09*t
        sections.append([(x,y-.007,z),(x,y-.003,z+.016*(1-t)),
                         (x,y+.007,z),(x,y+.005,z-.028*(1-t)),
                         (x,y,z-width),(x,y-.005,z-.028*(1-t))])
    blade.rings(sections)
    parts=[head,robe.object("Statue_Cloak",cloth,collection),
           skeleton.object("Statue_Hands_and_Jaw",bone,collection),
           haft.object("Statue_Staff",wood,collection),blade.object("Statue_Blade",steel,collection)]
    # Bake the slight mottling of the dyed cloth into vertex color. No extra
    # texture request, and the weave stays understated under the gallery spots.
    cloak = parts[1].data
    colors = cloak.color_attributes.new(name="Charcoal dye", type="BYTE_COLOR", domain="POINT")
    for vertex in cloak.vertices:
        value = 0.018 + 0.006*noise.noise_vector(vertex.co*23).x
        colors.data[vertex.index].color = (value*.88,value*.93,value,1)
    pigment = cloth.node_tree.nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = colors.name
    cloth.node_tree.links.new(pigment.outputs["Color"], cloth.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    # Flat faces keep the scythe's long bevel readable in the realtime light.
    for face in parts[-1].data.polygons:
        face.use_smooth = False
    for part in parts:
        part.rotation_euler.z=math.radians(-117)
        part.location=(sx,sy,0)
