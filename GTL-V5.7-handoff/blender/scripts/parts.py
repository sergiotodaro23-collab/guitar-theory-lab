import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gtl3d import *
S = int(os.environ.get('S', '64'))
def knob(fname, C, dia, skirt, top, smetal, topmetal=0.0, toprough=0.4, ridges=60):
    reset(S); r = dia / 2
    cone('skirt', C / 2, C / 2, r, r * 0.84, 0, 13, knurl_mat('k', skirt, rough=0.32 if smetal else 0.5, metal=smetal, ridges=ridges), bev=0.8)
    cyl('top', C / 2, C / 2, r * 0.66, 13, 15.5, mat('t', top, rough=toprough, metal=topmetal, bump=0.08, bump_scale=1500), bev=1.0)
    catcher(0, 0, C, C); part_lights(P(C / 2), -P(C / 2)); camera(0, 0, C, C, 2); render(fname)
def rocker(fname, on):
    reset(S)
    box('bezel', 8, 8, 34, 46, 0, 4, mat('bz', (0.02, 0.02, 0.02), rough=0.5), bev=1.2, corner=3)
    red = mat('r', (0.55, 0.02, 0.015), rough=0.3, coat=0.4, emit=(1, 0.1, 0.05) if on else None, emit_str=0.25 if on else 0)
    o = box('rock', 12, 12, 26, 38, 4, 10, red, bev=1.6, seg=4, corner=2)
    o.rotation_euler = (math.radians(9 if on else -9), 0, 0)
    w = mat('w', (0.9, 0.88, 0.82), rough=0.5)
    box('i', 24, 17 if on else 39, 2, 7, 9.5, 11.6, w); 
    catcher(0, 0, 50, 62); part_lights(P(25), -P(31)); camera(0, 0, 50, 62, 2); render(fname)
def toggle(fname, up):
    reset(S); ch = mat('c', (0.85, 0.85, 0.86), rough=0.15, metal=1.0)
    cyl('nut', 20, 30, 9, 0, 4, mat('n', (0.7, 0.7, 0.72), rough=0.25, metal=1), verts=6, bev=0.6)
    cyl('ring', 20, 30, 6.5, 4, 6, ch, bev=0.5)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=P(2.4), depth=P(18), location=(P(20), -P(30 + (-7 if up else 7)), P(10)))
    bat = bpy.context.object; bat.rotation_euler = (math.radians(-55 if up else 55), 0, 0); bat.data.materials.append(ch)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=P(3.4), location=(P(20), -P(30 + (-14 if up else 14)), P(15)))
    s = bpy.context.object; s.data.materials.append(ch); bpy.ops.object.shade_smooth()
    catcher(0, 0, 40, 60); part_lights(P(20), -P(30)); camera(0, 0, 40, 60, 2); render(fname)
def footswitch(fname):
    reset(S); ch = mat('c', (0.8, 0.8, 0.82), rough=0.22, metal=1.0, bump=0.05, bump_scale=2000)
    cyl('nut', 55, 55, 33, 0, 5, mat('n', (0.62, 0.62, 0.64), rough=0.3, metal=1), verts=6, bev=1.2)
    cyl('washer', 55, 55, 29, 5, 7, ch, bev=0.8)
    cyl('cap', 55, 55, 22, 7, 18, knurl_mat('k', (0.72, 0.72, 0.74), rough=0.3, metal=1, ridges=40, strength=0.25), bev=3.5)
    catcher(0, 0, 110, 110); part_lights(P(55), -P(55)); camera(0, 0, 110, 110, 2); render(fname)
w = sys.argv[1:] or ['all']
if 'all' in w or 'knobs' in w:
    knob('knob-gold@2x.png', 72, 46, (0.78, 0.58, 0.26), (0.02, 0.02, 0.02), 1.0, toprough=0.3)
    knob('knob-black@2x.png', 56, 34, (0.03, 0.03, 0.03), (0.04, 0.04, 0.045), 0.0, toprough=0.35, ridges=40)
    knob('knob-alu@2x.png', 84, 56, (0.75, 0.75, 0.77), (0.05, 0.05, 0.055), 1.0, toprough=0.3, ridges=80)
if 'all' in w or 'sw' in w:
    rocker('rocker-on@2x.png', True); rocker('rocker-off@2x.png', False)
    toggle('toggle-up@2x.png', True); toggle('toggle-down@2x.png', False)
    footswitch('footswitch@2x.png')
