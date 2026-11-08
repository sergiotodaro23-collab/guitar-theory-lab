import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gtl3d import *
from gtl3d import _bsdf
S = int(os.environ.get('S', '64'))
def wood_mat():
    m = bpy.data.materials.new('wood'); m.use_nodes = True; nt = m.node_tree; b = _bsdf(m)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (14, 1.2, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3; nz.inputs['Detail'].default_value = 6; nz.inputs['Distortion'].default_value = 1.5
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'; wv.inputs['Scale'].default_value = 1.2; wv.inputs['Distortion'].default_value = 7; wv.inputs['Detail'].default_value = 3
    nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'; nt.links.new(wv.outputs['Fac'], mx.inputs[0]); nt.links.new(nz.outputs['Fac'], mx.inputs[1])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (0.035, 0.014, 0.008, 1); cr.color_ramp.elements[1].color = (0.11, 0.045, 0.022, 1)
    nt.links.new(mx.outputs[0], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.42; b.inputs['Coat Weight'].default_value = 0.5; b.inputs['Coat Roughness'].default_value = 0.18
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.12; nt.links.new(mx.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
def rail():
    reset(S); w = wood_mat(); sm = mat('screwm', (0.62, 0.62, 0.64), rough=0.32, metal=1.0, bump=0.05)
    box('w', 0, 0, 120, 600, 0, 14, w, bev=5, seg=6, corner=10)
    for (x, y, r) in [(16, 16, 20), (104, 16, 60), (16, 584, 80), (104, 584, 10)]: screw(x, y, 3.8, 14, sm, rot=r)
    lights(key=1600, fill=260, cx=P(60), cy=-P(300), size=6, overhead=True); camera(0, 0, 120, 600, 2); render('rail-wood9@2x.png')
def coil():
    reset(S); ch = mat('c', (0.75, 0.75, 0.77), rough=0.2, metal=1.0)
    bpy.ops.mesh.primitive_torus_add(major_radius=P(9), minor_radius=P(1.6), location=(P(14), -P(12), P(0)))
    t = bpy.context.object; t.rotation_euler = (0, math.radians(90), math.radians(-12)); t.data.materials.append(ch); bpy.ops.object.shade_smooth()
    lights(key=900, fill=90, cx=P(14), cy=-P(12), size=1, overhead=False); camera(0, 0, 28, 24, 2); render('coil@2x.png')
import sys as _s
if "rail" in _s.argv: rail()
else: coil()
