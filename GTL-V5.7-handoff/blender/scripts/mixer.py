import sys, os, time; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gtl3d import *
D = os.path.dirname(os.path.abspath(__file__))
BC = os.path.join(D, 'BarlowCond600.ttf')
SAMPLES = int(os.environ.get('S', '96'))
W, H = 780, 380
CX = [85, 183, 281, 379, 477, 575, 692]

def body():
    s = reset(SAMPLES)
    encl = mat('encl', (0.045, 0.045, 0.05), rough=0.42, metal=0.55, bump=0.35, bump_scale=1400)
    face = mat('face', (0.03, 0.03, 0.032), rough=0.55, metal=0.0, bump=0.12, bump_scale=2200, coat=0.15)
    slot = mat('slot', (0.004, 0.004, 0.004), rough=0.9)
    alu = mat('alu', (0.78, 0.76, 0.72), rough=0.28, metal=1.0, brushed=True, aniso=0.6)
    ink = mat('ink', (0.006, 0.006, 0.006), rough=0.6)
    silk = mat('silk', (0.82, 0.8, 0.74), rough=0.6)
    chrome = mat('chrome', (0.85, 0.85, 0.86), rough=0.18, metal=1.0)
    screwm = mat('screwm', (0.62, 0.62, 0.64), rough=0.32, metal=1.0, bump=0.05)
    # enclosure + faceplate
    e = box('encl', 0, 0, W, H, 0, 30, encl, bev=7, seg=6, corner=16)
    f = box('face', 10, 10, W - 20, H - 20, 19, 31.6, face, bev=1.2, seg=3, corner=9)
    # cutters: fader slots, button wells, LED holes, master recess
    cs = []
    for cx in CX:
        cs.append(box('cs', cx - 3, 96, 6, 168, 18, 40, corner=2.9))
        for y0 in (275, 315):
            cs.append(box('cw', cx - 31, y0, 62, 34, 29.2, 40, corner=6))
        cs.append(cyl('ch', cx + 34, 74, 3.4, 26, 40, verts=32))
    cutter = join(cs, 'cutter'); cut(f, cutter)
    import bpy as _b
    _b.context.view_layer.objects.active = f; f.select_set(True)
    for md in list(f.modifiers): _b.ops.object.modifier_apply(modifier=md.name)
    _b.ops.object.shade_flat()
    box('slotfloor', 12, 12, W - 24, H - 24, 18.0, 18.5, slot)
    # LED bezels
    for cx in CX:
        o = cyl('bez', cx + 34, 74, 5.6, 30.5, 32.6, chrome, bev=0.8, verts=48)
        h = cyl('bh', cx + 34, 74, 3.4, 29, 36, verts=32); cut(o, h)
        cyl('ledfloor', cx + 34, 74, 3.4, 29.6, 29.9, slot, verts=32)
    # brand plate
    box('plate', 30, 18, 176, 30, 31.6, 33.4, alu, bev=1.0, seg=3, corner=3)
    for x in (38, 198): screw(x, 33, 2.6, 33.4, screwm, rot=20 + x)
    t = text('GTL  MIXER', 118, 33.5, 17, 33.4, ink, extrude=0.25, font=BC)
    # silkscreen right
    text('ANALOG MIXING CONSOLE  ·  7 CH', 224, 34, 11, 31.6, silk, align='LEFT', extrude=0.05, font=BC)
    # corner screws
    for (x, y, r) in [(22, 22, 0), (758, 22, 40), (22, 358, 75), (758, 358, 15)]:
        screw(x, y, 5.2, 31.6, screwm, rot=r)
    catcher(-40, -32, 890, 490)
    lights(key=1600, fill=260, cx=P(390), cy=-P(190), size=8)
    camera(-40, -32, 890, 490, 2)
    t0 = time.time(); render('mixer-body@2x.png'); print('body', time.time() - t0)

def cap(name, color, metal):
    s = reset(SAMPLES)
    m = mat('cap', color, rough=0.3 if metal else 0.45, metal=metal, brushed=bool(metal), aniso=0.4 if metal else 0)
    dark = mat('rid', tuple(c * 0.55 for c in color), rough=0.4, metal=metal)
    line = mat('line', (0.95, 0.95, 0.92), rough=0.5, emit=(1, 1, 0.95), emit_str=0.6)
    box('stem', 27, 30, 6, 12, 0, 4, dark)
    box('cap', 15, 16, 30, 40, 4, 15, m, bev=2.2, seg=5, corner=3)
    for i, y in enumerate([19.5, 23.5, 27.5, 31.5, 40.5, 44.5, 48.5, 52.5]):
        box('r', 16.5, y, 27, 1.8, 15, 15.9, dark, bev=0.5, seg=2)
    box('ln', 16.5, 35.2, 27, 1.6, 15, 15.4, line)
    catcher(0, 0, 60, 72)
    lights(key=700, fill=90, cx=P(30), cy=-P(36), size=1.2, overhead=False)
    camera(0, 0, 60, 72, 2)
    render(name)

def btn(name, color, emit=None, es=0.0, rough=0.62):
    s = reset(SAMPLES)
    m = mat('b', color, rough=rough, emit=emit, emit_str=es, transmission=0.0, coat=0.3)
    box('b', 6, 6, 54, 26, 0, 6, m, bev=2.4, seg=5, corner=4)
    catcher(0, 0, 66, 38)
    lights(key=700, fill=90, cx=P(33), cy=-P(19), size=1.2, overhead=False)
    camera(0, 0, 66, 38, 2)
    render(name)

what = sys.argv[1] if len(sys.argv) > 1 else 'all'
if what in ('body', 'all'): body()
if what in ('parts', 'all'):
    cap('fader-cap@2x.png', (0.72, 0.72, 0.73), 0.85)
    cap('fader-cap-master@2x.png', (0.55, 0.07, 0.04), 0.35)
    btn('btn-off@2x.png', (0.035, 0.035, 0.038))
    btn('btn-mute-on@2x.png', (0.22, 0.01, 0.008), emit=(1.0, 0.06, 0.03), es=0.32, rough=0.35)
    btn('btn-solo-on@2x.png', (0.35, 0.2, 0.01), emit=(1.0, 0.55, 0.06), es=0.3, rough=0.35)
