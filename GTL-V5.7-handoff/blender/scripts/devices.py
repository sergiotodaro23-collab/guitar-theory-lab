import sys, os, time; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gtl3d import *
from gtl3d import _bsdf
D = os.path.dirname(os.path.abspath(__file__)); BC = os.path.join(D, 'BarlowCond600.ttf'); CG = os.path.join(D, 'Cormorant600.ttf')
S = int(os.environ.get('S', '64'))

def weave_mat(name, color):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = 0.85
    tc = nt.nodes.new('ShaderNodeTexCoord')
    w1 = nt.nodes.new('ShaderNodeTexWave'); w1.wave_type = 'BANDS'; w1.bands_direction = 'X'; w1.inputs['Scale'].default_value = 260
    w2 = nt.nodes.new('ShaderNodeTexWave'); w2.wave_type = 'BANDS'; w2.bands_direction = 'Y'; w2.inputs['Scale'].default_value = 260
    for w in (w1, w2): nt.links.new(tc.outputs['Object'], w.inputs['Vector'])
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'; nt.links.new(w1.outputs['Fac'], mx.inputs[0]); nt.links.new(w2.outputs['Fac'], mx.inputs[1])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.8; bp.inputs['Distance'].default_value = 0.003
    nt.links.new(mx.outputs[0], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    cr = nt.nodes.new('ShaderNodeMixRGB'); cr.inputs['Color1'].default_value = (*[c * 0.55 for c in color], 1); cr.inputs['Color2'].default_value = (*color, 1)
    nt.links.new(mx.outputs[0], cr.inputs['Fac']); nt.links.new(cr.outputs['Color'], b.inputs['Base Color'])
    return m

def common_mats():
    return dict(
        screw=mat('screwm', (0.62, 0.62, 0.64), rough=0.32, metal=1.0, bump=0.05),
        chrome=mat('chrome', (0.85, 0.85, 0.86), rough=0.16, metal=1.0),
        hole=mat('hole', (0.004, 0.004, 0.004), rough=0.9),
        alu=mat('alu', (0.78, 0.76, 0.72), rough=0.28, metal=1.0, brushed=True, aniso=0.6),
        ink=mat('ink', (0.01, 0.01, 0.01), rough=0.6),
        glass=mat('glass', (0.01, 0.012, 0.014), rough=0.04, coat=1.0, spec=0.8))

def jack(x, y, M, r=11):
    cyl('jn', x, y, r + 4, 0, 1, M['chrome'], verts=6, bev=0.5).location.z = 0  # placeholder replaced below
def jack_at(x, y, z, M, r=10):
    o = cyl('jnut', x, y, r + 4, z, z + 3, mat('nut', (0.7, 0.7, 0.72), rough=0.25, metal=1.0), verts=6, bev=0.6)
    cyl('jring', x, y, r + 1, z + 3, z + 5, M['chrome'], bev=0.8)
    cyl('jhole', x, y, r * 0.42, z + 4.6, z + 5.4, M['hole'], verts=32)

def amp():
    reset(S); M = common_mats()
    W, H = 820, 300
    tolex = mat('tolex', (0.028, 0.026, 0.024), rough=0.62, bump=0.9, bump_scale=420)
    pipe = mat('pipe', (0.86, 0.8, 0.64), rough=0.45)
    gold = mat('gold', (0.8, 0.62, 0.3), rough=0.3, metal=1.0, brushed=True, aniso=0.5)
    cloth = weave_mat('cloth', (0.085, 0.075, 0.062))
    logo = mat('logo', (0.86, 0.78, 0.6), rough=0.35, metal=0.3, coat=0.5)
    en = box('encl', 0, 0, W, H, 0, 60, tolex, bev=10, seg=6, corner=18)
    cut(en, box('gcut', 30, 34, W - 60, 136, 52, 70, corner=6))
    box('cloth', 30, 34, W - 60, 136, 51, 53, cloth, corner=6)
    fr = box('pipe', 26, 30, W - 52, 144, 56, 61, pipe, bev=1.2, seg=3, corner=8)
    cut(fr, box('pc', 30, 34, W - 60, 136, 50, 70, corner=6))
    text('GTL · 45', W / 2, 102, 58, 54, logo, extrude=1.5, font=CG)
    # control plate
    pl = box('plate', 28, 186, W - 56, 96, 57, 60.5, gold, bev=1.4, seg=3, corner=5)
    for (x, y) in [(40, 198), (W - 40, 198), (40, 270), (W - 40, 270)]: screw(x, y, 3.6, 60.5, M['screw'], rot=x + y)
    jack_at(158, 246, 60.5, M)
    # jewel lamp base (glass dome dark red)
    cyl('lampbz', 110, 246, 10, 60.5, 63, M['chrome'], bev=1.0)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=P(7.5), location=(P(110), -P(246), P(62)))
    j = bpy.context.object; j.scale.z = 0.6; j.data.materials.append(mat('jewel', (0.35, 0.03, 0.02), rough=0.08, coat=1.0, transmission=0.3)); bpy.ops.object.shade_smooth()
    # rocker well
    box('rw', 47, 225, 36, 50, 59, 61, M['hole'], bev=1, corner=4)
    # corner caps
    for (x, y, rx, ry) in [(0, 0, 1, 1), (W, 0, -1, 1), (0, H, 1, -1), (W, H, -1, -1)]:
        c = box('cc', min(x, x + rx * 34), min(y, y + ry * 34), 34, 34, 0, 63, M['chrome'], bev=4, seg=5, corner=12)
        cut(c, box('ccut', min(x + rx * 12, x + rx * 40), min(y + ry * 12, y + ry * 40), 28, 28, -5, 80))
    catcher(-40, -32, W + 110, H + 102); lights(key=1600, fill=260, cx=P(W / 2), cy=-P(H / 2), size=8)
    camera(-40, -32, W + 110, H + 102, 2); t = time.time(); render('amp-body@2x.png'); print('amp', time.time() - t)

def tuner():
    reset(S); M = common_mats()
    W, H = 380, 360
    paint = mat('crinkle', (0.03, 0.03, 0.032), rough=0.55, metal=0.2, bump=1.1, bump_scale=700)
    box('encl', 0, 0, W, H, 0, 44, paint, bev=8, seg=6, corner=16)
    # panel seam: lower half slightly lower deck
    box('seam', 14, 196, W - 28, 2, 43.6, 44.2, M['hole'])
    # display recess + glass
    d = box('dbez', 26, 26, W - 52, 148, 44, 46, M['chrome'], bev=1.2, seg=3, corner=8)
    cut(d, box('dbc', 32, 32, W - 64, 136, 30, 60, corner=6))
    box('dglass', 32, 32, W - 64, 136, 40, 41, M['glass'], corner=6)
    # calib knob well and LED bezels
    for (y) in (220, 246, 272):
        o = cyl('lb', 300, y, 6.5, 44, 46, M['chrome'], bev=0.8, verts=40); cut(o, cyl('lbc', 300, y, 4.2, 40, 50, verts=32))
        cyl('lf', 300, y, 4.2, 43.6, 43.9, M['hole'], verts=32)
    # brand plates
    box('bp', 26, 318, 110, 24, 44, 45.6, M['alu'], bev=0.8, corner=2)
    for x in (33, 129): screw(x, 330, 2.2, 45.6, M['screw'], rot=x)
    text('GTL · TUNE', 81, 330.5, 13, 45.6, M['ink'], extrude=0.2, font=BC)
    for (x, y, r) in [(18, 18, 10), (W - 18, 18, 40), (18, H - 18, 70), (W - 18, H - 18, 20)]: screw(x, y, 5, 44, M['screw'], rot=r)
    catcher(-40, -32, W + 110, H + 102); lights(key=1600, fill=260, cx=P(W / 2), cy=-P(H / 2), size=6)
    camera(-40, -32, W + 110, H + 102, 2); t = time.time(); render('tuner-body@2x.png'); print('tuner', time.time() - t)

def iface():
    reset(S); M = common_mats()
    W, H = 620, 210
    anod = mat('anod', (0.05, 0.05, 0.055), rough=0.33, metal=1.0, brushed=True, aniso=0.5)
    endc = mat('endc', (0.02, 0.02, 0.02), rough=0.7, bump=0.4, bump_scale=900)
    box('body', 0, 0, W, H, 0, 40, anod, bev=6, seg=6, corner=12)
    for x in (0, W - 18): box('end', x, -2, 18, H + 4, 0, 44, endc, bev=4, seg=4, corner=6)
    # combo connectors (XLR+TRS)
    for cx in (70, 160):
        o = cyl('cmb', cx, 96, 30, 40, 44, mat('cp', (0.04, 0.04, 0.04), rough=0.5), bev=1.2, verts=64)
        cyl('cmbin', cx, 96, 22, 43.2, 43.6, M['hole'])
        jack_at(cx, 96, 41, M, r=9)
        for a in (90, 210, 330):
            cyl('pin', cx + 15 * math.cos(math.radians(a)), 96 - 15 * math.sin(math.radians(a)), 2.4, 43.0, 43.8, mat('pinh', (0.2, 0.17, 0.08), rough=0.4, metal=1), verts=16)
        cyl('latch', cx, 62, 4, 43.5, 45.5, M['chrome'], verts=24)
    # display window
    d = box('win', 380, 140, 210, 46, 40, 41.5, M['chrome'], bev=0.8, corner=5)
    cut(d, box('wc', 384, 144, 202, 38, 30, 50, corner=4)); box('wg', 384, 144, 202, 38, 37, 38, M['glass'], corner=4)
    box('logo', 24, 22, 120, 22, 40, 41.4, M['alu'], bev=0.6, corner=2)
    text('GTL · 2i', 84, 33.5, 14, 41.4, M['ink'], extrude=0.2, font=BC)
    catcher(-40, -32, W + 110, H + 102); lights(key=1600, fill=260, cx=P(W / 2), cy=-P(H / 2), size=6)
    camera(-40, -32, W + 110, H + 102, 2); t = time.time(); render('iface-body@2x.png'); print('iface', time.time() - t)

for w in (sys.argv[1:] or ['amp', 'tuner', 'iface']): globals()[w]()
