"""
Audio interface of the Studio V6 rack: a dark anodised front panel between
two brushed aluminium cheeks, a combined XLR/jack input, two gain knobs
(one sprite strip for both) and a smoked window where the live HTML meter shows through.
"""
from gtlkit import export
from gtlkit import materials as M
from gtlkit import parts as P
from gtlkit.scene import camera, catcher, reset, studio_rig

NAME = 'iface'
EXPORT = 'IFACE_HW'


def frame(spec):
    m, s = spec['margin'], spec['size']
    return -m['left'], -m['top'], s['w'] + m['left'] + m['right'], s['h'] + m['top'] + m['bottom']


def body(spec, samples):
    reset(samples)
    W, H, Z, c = spec['size']['w'], spec['size']['h'], spec['height'], spec['cheek']
    alu = M.brushed('cheek-alu', (0.74, 0.74, 0.76), rough=0.34, streak=0.5, direction='Y')
    P.rbox('chassis', 0, 0, W, H, 0, Z - 1.5, alu, corner=spec['corner'], edge=2.5, segments=5)
    P.rbox('panel', c, 2.5, W - 2 * c, H - 5, Z - 3, Z, M.anodized('panel'), corner=2, edge=0.8, segments=3)
    nickel, slot, ink = M.nickel(), M.void('slot'), M.enamel('silk', (0.62, 0.62, 0.6), rough=0.5)
    for (sx, sy) in ((c / 2, 9), (c / 2, H - 9), (W - c / 2, 9), (W - c / 2, H - 9)):
        P.screw(sx, sy, 2.2, Z - 1.5, nickel, slot, turn=(sx + sy) * 4)
    j = spec['jack']
    P.combo_jack(j['x'], j['y'], j['r'], Z)
    # Two gain knobs (rig, detection): a ring of marks and a shaft hole for each.
    k, g = spec['knob'], spec['gains']
    for i in range(len(g['ids'])):
        cx = g['first'] + g['pitch'] * i
        P.tick_ring(cx, g['y'], g['tickRadius'], Z, ink, sweep=k['sweep'], start=-k['sweep'] / 2, dot=0.65)
        P.cyl('shaft-hole', cx, g['y'], g['size'] * 0.2, Z - 1, Z + 0.05, slot, verts=32)
    # Meter window: smoked glass in a thin bright bezel. A disc-and-plate on the panel, no boolean (see the amp's plate).
    m = spec['meter']
    P.rbox('window-bezel', m['x'] - 1.4, m['y'] - 1.4, m['w'] + 2.8, m['h'] + 2.8, Z - 0.2, Z + 0.7, M.chrome('bezel', 0.3), corner=3.4, edge=0.4, segments=2)
    P.rbox('window-glass', m['x'], m['y'], m['w'], m['h'], Z + 0.2, Z + 0.78, M.plain('smoked-glass', (0.004, 0.004, 0.005), 0.07, coat=1.0, spec=0.6), corner=2)
    # A fine silk-screened rule frames the control strip.
    s = spec['controls']
    P.decal('rule', s['x'], s['y'] - 3.5, s['w'], 0.6, Z, ink)
    fx, fy, fw, fh = frame(spec)
    catcher(fx, fy, fw, fh)
    studio_rig(W / 2, H / 2, W)
    camera(fx, fy, fw, fh)


def knob(spec, samples, angle):
    reset(samples)
    k = spec['knob']
    c = k['frame'] / 2
    P.skirted_knob(c, c, k['diameter'], angle=angle,
                   skirt_mat=M.knurled('alu-skirt', (0.7, 0.7, 0.72), ridges=40, rough=0.34, metal=1.0, strength=0.5),
                   cap_mat=M.brushed('alu-cap', (0.8, 0.8, 0.82), rough=0.3, streak=0.35),
                   line_mat=M.enamel('alu-line', (0.02, 0.02, 0.022)))
    catcher(0, 0, k['frame'], k['frame'])
    studio_rig(c, c, k['frame'] * 1.6)
    camera(0, 0, k['frame'], k['frame'])


def pictures(spec, samples):
    k = spec['knob']
    fx, fy, fw, fh = frame(spec)
    angles = [-k['sweep'] / 2 + k['sweep'] * i / (k['frames'] - 1) for i in range(k['frames'])]
    return [
        dict(key='body', file='iface-body@2x.webp', css=(fw, fh), quality=88, use='Audio interface: chassis, panel, input socket, meter window',
             scenes=[('iface-body', lambda: body(spec, samples))], post=lambda im: export.feather(im, 6), extra={'offset': [fx, fy]}),
        dict(key='knob', file='iface-knob-strip@2x.webp', css=(k['frame'] * k['frames'], k['frame']), quality=86, use='Aluminium gain knob at every position of its travel (sprite strip)',
             scenes=[('iface-knob' if i == len(angles) // 2 else f'iface-knob-{i:02d}', lambda a=a: knob(spec, max(32, samples // 2), a)) for i, a in enumerate(angles)],
             post=lambda im: export.vignette(im, 0.8, 0.98), extra={'frames': k['frames'], 'frame': [k['frame'], k['frame']]}),
    ]
