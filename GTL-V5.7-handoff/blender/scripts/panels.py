import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gtl3d import *
S = int(os.environ.get('S', '64'))
def nolights_scene():
    s = reset(S); return s
def plate():
    reset(S)
    anod = mat('anod', (0.09, 0.09, 0.095), rough=0.38, metal=1.0, brushed=True, aniso=0.0)
    sm = mat('screwm', (0.62, 0.62, 0.64), rough=0.32, metal=1.0, bump=0.05)
    box('rim', 0, 0, 400, 160, 0, 10, mat('rim', (0.1, 0.1, 0.11), rough=0.3, metal=1.0), bev=3, seg=5, corner=8)
    box('face', 5, 5, 390, 150, 10, 12, anod, bev=1.0, seg=3, corner=5)
    for (x, y, r) in [(16, 16, 20), (384, 16, 60), (16, 144, 80), (384, 144, 10)]: screw(x, y, 4.2, 12, sm, rot=r)
    lights(key=1600, fill=300, cx=P(200), cy=-P(80), size=6, overhead=True); camera(0, 0, 400, 160, 2); render('plate9@2x.png')
def lcdbezel():
    reset(S)
    fr = box('fr', 0, 0, 300, 100, 0, 6, mat('bz', (0.02, 0.02, 0.022), rough=0.4, metal=0.6), bev=2.5, seg=5, corner=7)
    cut(fr, box('c', 8, 8, 284, 84, -5, 20, corner=4))
    box('glass', 8, 8, 284, 84, 2, 3, mat('gl', (0.0, 0.0, 0.0), rough=0.03, coat=1.0, spec=0.9), corner=4)
    lights(key=1600, fill=0.001, cx=P(150), cy=-P(50), size=4, overhead=False); camera(0, 0, 300, 100, 2); render('lcd9@2x.png')
def key(name, color, emit=None, es=0.0, rough=0.42, metal=0.5):
    reset(S)
    box('k', 0, 0, 60, 52, 0, 8, mat('k', color, rough=rough, metal=metal, emit=emit, emit_str=es, coat=0.25, bump=0.1, bump_scale=1600), bev=3.2, seg=6, corner=6)
    lights(key=900, fill=0.001, cx=P(30), cy=-P(26), size=1.2, overhead=False); camera(0, 0, 60, 52, 2); render(name)
for w in (sys.argv[1:] or ['plate', 'lcd', 'keys']):
    if w == 'plate': plate()
    if w == 'lcd': lcdbezel()
    if w == 'keys':
        key('key-up@2x.png', (0.07, 0.07, 0.075))
        key('key-down@2x.png', (0.045, 0.045, 0.05), rough=0.5)
        key('key-lit@2x.png', (0.6, 0.18, 0.02), emit=(1.0, 0.42, 0.08), es=0.35, rough=0.3, metal=0.0)
