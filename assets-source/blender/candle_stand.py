"""A tall wrought-iron candle stand with burnt-down candles.

Hand-forged look: three scrolled legs, a slightly bent shaft, four
irregular branches and a top cup, each with a drip pan, and an original
ring ornament with an inverted pentagram. Rods stay at least 14 mm thick
so they hold up at reduced render resolution, and every tube uses 6-8
sides. Heights are metres above the floor.
"""
import math

import numpy as np
from mathutils import Vector

from basement_surfaces import fbm, noise
from grim_reaper import Sculpture


def build_candle_stand(collection, iron, wax, flame, cx, cy, floor_z):
    """Build Candle_Stand_Iron, Candle_Wax_All and Candle_Flame_All; return
    the flame centre for the shared light and the collider box."""
    rng = np.random.default_rng(57)
    metal, candles, flames = Sculpture(), Sculpture(), Sculpture()

    def at(r, a, z):
        return Vector((cx + r * math.cos(a), cy + r * math.sin(a), floor_z + z))

    # Three splayed legs ending in curled scroll feet.
    for k in range(3):
        a = math.radians(30 + 120 * k)
        metal.tube([at(0.03, a, 0.42), at(0.12, a, 0.24), at(0.22, a, 0.08), at(0.27, a, 0.03),
                    at(0.3, a + 0.05, 0.05), at(0.29, a + 0.1, 0.09)],
                   [0.016, 0.015, 0.014, 0.014, 0.012, 0.01], 6)
    # The shaft wanders a few millimetres off true, as hand forging does.
    shaft = [at(0.004 * abs(rng.normal()), rng.uniform(0, 6), z) for z in (0.36, 0.7, 1.05, 1.4, 1.62)]
    metal.tube(shaft, [0.019, 0.017, 0.016, 0.015, 0.014], 8)
    for z, size in ((0.42, 0.034), (1.12, 0.03)):
        metal.oval(at(0, 0, z), (size, size, size * 0.75), 8)

    cups = []
    # Four bent branches at uneven heights and reaches, plus the top cup.
    for deg, reach, rise in ((40, 0.2, 1.32), (128, 0.24, 1.42), (215, 0.18, 1.36), (305, 0.25, 1.46)):
        a = math.radians(deg + rng.uniform(-8, 8))
        metal.tube([at(0.01, a, 1.12), at(reach * 0.45, a, 1.1), at(reach * 0.85, a + 0.08, rise - 0.12),
                    at(reach, a + 0.05, rise - 0.03)], [0.014, 0.013, 0.012, 0.012], 6)
        cups.append(at(reach, a + 0.05, rise))
    cups.append(at(0, 0, 1.64))
    for cup in cups:
        # Drip pan and candle socket.
        metal.oval(cup, (0.046, 0.046, 0.008), 8)
        metal.tube([cup, cup + Vector((0, 0, 0.035))], [0.022, 0.022], 8)

    # Ring ornament with an inverted pentagram, turned toward the room.
    face = math.atan2(-cy, 22.0 - cx)
    side = Vector((-math.sin(face), math.cos(face), 0))
    hub = at(0.0, 0, 0.82) + Vector((math.cos(face), math.sin(face), 0)) * 0.02
    ring = [hub + side * 0.11 * math.cos(t) + Vector((0, 0, 0.11 * math.sin(t)))
            for t in np.linspace(0, math.tau, 25)]
    metal.tube(ring, [0.009] * len(ring), 6)
    # Inverted: one point downward. The star joins every second point.
    points = [hub + side * 0.1 * math.cos(-math.pi / 2 + k * math.tau / 5)
              + Vector((0, 0, 0.1 * math.sin(-math.pi / 2 + k * math.tau / 5))) for k in range(5)]
    for k in range(5):
        metal.tube([points[k], points[(k + 2) % 5]], [0.007, 0.007], 6)
    # Collars clamp the ring to the shaft above and below.
    metal.tube([at(0, 0, 0.7), hub + Vector((0, 0, -0.11))], [0.008, 0.008], 6)
    metal.tube([hub + Vector((0, 0, 0.11)), at(0, 0, 0.95)], [0.008, 0.008], 6)
    _weather(metal.object("Candle_Stand_Iron", iron, collection))

    # Candles burnt to different lengths, with drips over the socket rims.
    tops = []
    for cup in cups:
        height = rng.uniform(0.05, 0.16)
        base = cup + Vector((0, 0, 0.01))
        top = base + Vector((0, 0, height))
        candles.tube([base, top - Vector((0, 0, 0.006)), top], [0.017, 0.017, 0.012], 8)
        for _ in range(2):
            t = rng.uniform(0, math.tau)
            drop = rng.uniform(0.02, height * 0.8)
            candles.oval(top + Vector((0.017 * math.cos(t), 0.017 * math.sin(t), -drop)),
                         (0.006, 0.006, 0.014), 6)
        flames.oval(top + Vector((0, 0, 0.022)), (0.007, 0.007, 0.018), 6)
        tops.append(top)
    candles.object("Candle_Wax_All", wax, collection)
    flames.object("Candle_Flame_All", flame, collection)
    centre = sum(tops, Vector()) / len(tops) + Vector((0, 0, 0.12))
    collider = (cx - 0.3, cx + 0.3, cy - 0.3, cy + 0.3, floor_z, floor_z + 1.6)
    return centre, collider


def _weather(obj):
    """Black iron with rust blooms and rubbed spots, in vertex colour."""
    colors = obj.data.color_attributes.new(name="Patina", type="BYTE_COLOR", domain="POINT")
    pts = np.array([v.co for v in obj.data.vertices])
    rust = np.clip((fbm(pts, 7, 3, 81) - 0.5) * 3, 0, 1)
    rubbed = noise(pts, 25, 82) > 0.8
    for i, vert in enumerate(obj.data.vertices):
        # Linear values: near-black iron, brown rust, grey bare metal.
        c = np.array([0.018, 0.017, 0.017]) * (1 - rust[i]) + np.array([0.09, 0.035, 0.015]) * rust[i]
        if rubbed[i] and vert.normal.z > 0.2:
            c = np.array([0.12, 0.115, 0.11])
        colors.data[i].color = (*c, 1)
