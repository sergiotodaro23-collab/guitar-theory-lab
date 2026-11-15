"""
Reusable geometry. Positions and sizes are in CSS pixels: (x, y) as on
screen, z as height above the page. Every function adds objects to the
current scene and returns the main one.
"""
import math

import bmesh
import bpy

from . import materials as M
from .scene import px, rad

# Standard heights (CSS px above the page), so parts from different components stack the same way.
Z_CABINET = 44      # front face of a cabinet or chassis
Z_PLATE = 2.5       # thickness of a control plate
Z_KNOB = 12         # height of a knob


def _smooth(angle=40):
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=rad(angle))
    except Exception:
        bpy.ops.object.shade_smooth()


def bevel(o, width, segments=4, angle=60):
    md = o.modifiers.new('bevel', 'BEVEL')
    md.width = px(width)
    md.segments = segments
    md.limit_method = 'ANGLE'
    md.angle_limit = rad(angle)
    md.harden_normals = True
    return md


def rbox(name, x, y, w, h, z0, z1, mat=None, corner=0.0, edge=0.0, segments=4):
    """A box on the CSS rectangle (x, y, w, h) from z0 to z1; `corner` rounds it as CSS border-radius does, `edge` softens its rims."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.scale = (px(w), px(h), px(z1 - z0))
    bpy.ops.object.transform_apply(scale=True)
    if corner > 0:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        upright = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6]
        bmesh.ops.bevel(bm, geom=upright, offset=px(corner), segments=10, affect='EDGES', profile=0.5)
        bm.to_mesh(o.data)
        bm.free()
    o.location = (px(x + w / 2), -px(y + h / 2), px((z0 + z1) / 2))
    o.name = name
    if edge:
        bevel(o, edge, segments)
    if mat:
        o.data.materials.append(mat)
    _smooth()
    return o


def cyl(name, x, y, r, z0, z1, mat=None, edge=0.0, verts=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=px(r), depth=px(z1 - z0), location=(px(x), -px(y), px((z0 + z1) / 2)))
    o = bpy.context.object
    o.name = name
    if edge:
        bevel(o, edge)
    if mat:
        o.data.materials.append(mat)
    _smooth()
    return o


def cone(name, x, y, r0, r1, z0, z1, mat=None, edge=0.0, verts=96):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=px(r0), radius2=px(r1), depth=px(z1 - z0), location=(px(x), -px(y), px((z0 + z1) / 2)))
    o = bpy.context.object
    o.name = name
    if edge:
        bevel(o, edge, 3, 50)
    if mat:
        o.data.materials.append(mat)
    _smooth(50)
    return o


def cut(target, cutter):
    """Boolean difference; the cutter stays in the scene, hidden from the render."""
    md = target.modifiers.new('cut', 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = cutter
    md.solver = 'EXACT'
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    return md


def parent(children, to):
    for c in children:
        c.parent = to
        c.matrix_parent_inverse = to.matrix_world.inverted()


def screw(x, y, r, z, mat, slot_mat, turn=30.0):
    """A cross-head screw flush on a surface at height z."""
    head = cyl('screw', x, y, r, z, z + r * 0.45, mat, edge=r * 0.3, verts=40)
    for k in (0, 90):
        bpy.ops.mesh.primitive_cube_add(size=1)
        c = bpy.context.object
        c.name = 'screw-slot'
        c.scale = (px(r * 1.2), px(r * 0.22), px(r * 0.2))
        c.location = (px(x), -px(y), px(z + r * 0.42))
        c.rotation_euler = (0, 0, rad(turn + k))
        c.data.materials.append(slot_mat)
    return head


def corner_cap(x, y, sx, sy, size, z, mat):
    """A cabinet corner protector at the corner (x, y); sx, sy = +1/-1 say which way the cabinet lies."""
    x0 = x if sx > 0 else x - size
    y0 = y if sy > 0 else y - size
    cap = rbox('corner', x0, y0, size, size, 0, z, mat, corner=size * 0.34, edge=2.0, segments=5)
    # Leave only an L-shaped piece: cut away the inner quadrant.
    inner = size * 0.42
    cx = x + sx * inner if sx > 0 else x - size - 4
    cy = y + sy * inner if sy > 0 else y - size - 4
    cut(cap, rbox('corner-cut', cx, cy, size - inner + 4, size - inner + 4, -4, z + 8, corner=size * 0.18))
    return cap


def tick_ring(x, y, radius, z, mat, count=11, start=-135.0, sweep=270.0, dot=0.9):
    """Engraved position marks around a knob: `count` dots over the knob's travel, larger at the ends and the middle."""
    marks = []
    for i in range(count):
        a = rad(start + sweep * i / (count - 1))
        big = i in (0, count // 2, count - 1)
        marks.append(cyl('tick', x + radius * math.sin(a), y - radius * math.cos(a), dot * (1.5 if big else 1.0), z - 0.3, z + 0.12, mat, verts=20))
    return marks


def skirted_knob(x, y, diameter, angle=0.0, z=0.0, skirt_mat=None, cap_mat=None, line_mat=None):
    """
    An amplifier knob: knurled skirt, flat metal cap, a painted line from the
    cap's centre to the skirt's rim. `angle` in degrees, clockwise from
    straight up, as a pointer on screen. The parts are parented to an empty
    at the axis, so one rotation turns the whole knob.
    """
    r = diameter / 2
    skirt_mat = skirt_mat or M.knurled('knob-skirt', (0.02, 0.019, 0.018), ridges=44)
    cap_mat = cap_mat or M.brushed('knob-cap', (0.8, 0.5, 0.17), rough=0.32, streak=0.35)
    line_mat = line_mat or M.enamel('knob-line', (0.93, 0.9, 0.82))
    bpy.ops.object.empty_add(location=(px(x), -px(y), px(z)))
    axis = bpy.context.object
    axis.name = 'knob-axis'
    base = cyl('knob-base', x, y, r * 1.0, z, z + 1.6, skirt_mat, edge=0.5, verts=96)
    skirt = cone('knob-skirt', x, y, r * 0.98, r * 0.76, z + 1.6, z + Z_KNOB * 0.72, skirt_mat, edge=0.7)
    cap = cyl('knob-cap', x, y, r * 0.6, z + Z_KNOB * 0.72, z + Z_KNOB, cap_mat, edge=0.9, verts=72)
    # Pointer: a raised line on the cap, continued down the skirt to the rim.
    top = rbox('knob-line', x - 0.9, y - r * 0.58, 1.8, r * 0.5, z + Z_KNOB - 0.2, z + Z_KNOB + 0.35, line_mat, edge=0.2, segments=2)
    side = rbox('knob-line-skirt', x - 0.9, y - r * 0.97, 1.8, r * 0.3, z + 1.2, z + Z_KNOB * 0.5, line_mat, edge=0.2, segments=2)
    side.rotation_euler = (rad(-24), 0, 0)
    parent([base, skirt, cap, top, side], axis)
    axis.rotation_euler = (0, 0, -rad(angle))
    return axis


def pilot_lamp(x, y, r, z, lit, color=(0.7, 0.012, 0.008)):
    """A jewel pilot lamp: chrome bezel, faceted glass dome."""
    cyl('lamp-bezel', x, y, r, z, z + 2.2, M.chrome('lamp-chrome', 0.18), edge=0.8, verts=48)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=px(r * 0.72), location=(px(x), -px(y), px(z + 2.0)))
    dome = bpy.context.object
    dome.name = 'lamp-jewel'
    dome.scale.z = 0.62
    dome.data.materials.append(M.jewel('jewel-lit' if lit else 'jewel', color, lit=lit))
    bpy.ops.object.shade_flat()
    if lit:
        bpy.ops.object.light_add(type='POINT', location=(px(x), -px(y), px(z + 5)))
        glow = bpy.context.object
        glow.name = 'lamp-glow'
        glow.data.color = (1.0, 0.16, 0.08)
        glow.data.energy = 0.006 * r * r
        glow.data.shadow_soft_size = px(r * 0.5)
    return dome
