"""
Procedural materials of the Studio's hardware. Each function returns a new
material built from shader nodes only. Textures are evaluated in object
space, so the grain keeps its scale whatever the size of the part: sizes
below are in CSS pixels (`grain=1.2` means a grain about 1.2 px wide).
"""
import bpy

from .scene import U


def _new(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    return m, nt, nt.nodes['Principled BSDF']


def _set(b, color, rough, metal=0.0, spec=0.5, coat=0.0, aniso=0.0):
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.08
    if aniso:
        b.inputs['Anisotropic'].default_value = aniso


def _coords(nt, scale=(1, 1, 1)):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    return mp.outputs['Vector']


def _noise(nt, vector, grain_px, detail=6.0, rough=0.6):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = 1.0 / (grain_px * U)
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    nt.links.new(vector, n.inputs['Vector'])
    return n.outputs['Fac']


def _bump(nt, b, height, strength, distance_px=0.25):
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = distance_px * U
    nt.links.new(height, bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return bp


def _range(nt, value, lo, hi):
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = lo
    mr.inputs['To Max'].default_value = hi
    nt.links.new(value, mr.inputs['Value'])
    return mr.outputs['Result']


def _mix_color(nt, fac, a, b):
    mx = nt.nodes.new('ShaderNodeMix')
    mx.data_type = 'RGBA'
    mx.inputs[6].default_value = (*a, 1)
    mx.inputs[7].default_value = (*b, 1)
    nt.links.new(fac, mx.inputs['Factor'])
    return mx.outputs[2]


def plain(name, color, rough=0.5, metal=0.0, coat=0.0, spec=0.5):
    m, _, b = _new(name)
    _set(b, color, rough, metal, spec, coat)
    return m


def tolex(name='tolex', color=(0.022, 0.021, 0.02), grain=1.6):
    """Black pebbled vinyl covering of an amplifier cabinet."""
    m, nt, b = _new(name)
    _set(b, color, 0.58, spec=0.45)
    v = _coords(nt)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.feature = 'F1'
    vor.inputs['Scale'].default_value = 1.0 / (grain * U)
    nt.links.new(v, vor.inputs['Vector'])
    fine = _noise(nt, v, grain * 0.35, detail=3)
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    nt.links.new(vor.outputs['Distance'], add.inputs[0])
    nt.links.new(_range(nt, fine, 0.0, 0.25), add.inputs[1])
    _bump(nt, b, add.outputs[0], 0.85, 0.5)
    nt.links.new(_range(nt, vor.outputs['Distance'], 0.45, 0.72), b.inputs['Roughness'])
    return m


def grille_cloth(name='cloth', color=(0.26, 0.2, 0.12), dark=(0.04, 0.03, 0.02), thread=2.2):
    """Woven grille cloth: two sets of threads crossing, with a little irregularity."""
    m, nt, b = _new(name)
    _set(b, color, 0.9, spec=0.2)
    v = _coords(nt)
    waves = []
    for axis in ('X', 'Y'):
        w = nt.nodes.new('ShaderNodeTexWave')
        w.wave_type = 'BANDS'
        w.bands_direction = axis
        w.wave_profile = 'SIN'
        # Blender's wave is sin(20 * scale * x): one thread every `thread` px
        w.inputs['Scale'].default_value = 6.2831853 / (20.0 * thread * U)
        w.inputs['Distortion'].default_value = 0.6
        w.inputs['Detail'].default_value = 1.0
        w.inputs['Detail Scale'].default_value = 0.4
        nt.links.new(v, w.inputs['Vector'])
        waves.append(w.outputs['Fac'])
    mx = nt.nodes.new('ShaderNodeMath')
    mx.operation = 'MULTIPLY'
    nt.links.new(waves[0], mx.inputs[0])
    nt.links.new(waves[1], mx.inputs[1])
    _bump(nt, b, mx.outputs[0], 0.9, 0.6)
    tint = _noise(nt, v, 40, detail=2)
    fac = nt.nodes.new('ShaderNodeMath')
    fac.operation = 'MULTIPLY'
    nt.links.new(mx.outputs[0], fac.inputs[0])
    nt.links.new(_range(nt, tint, 0.75, 1.15), fac.inputs[1])
    nt.links.new(_mix_color(nt, fac.outputs[0], dark, color), b.inputs['Base Color'])
    return m


def brushed(name, color, rough=0.3, direction='X', aniso=0.0, streak=0.5):
    """
    Brushed metal: fine streaks along `direction` in bump and roughness. The
    streaks do the work; `aniso` stays 0 by default because Blender's default
    tangent is radial and paints a spun, conical highlight on a flat plate.
    """
    m, nt, b = _new(name)
    _set(b, color, rough, metal=1.0, aniso=aniso)
    stretch = (0.012, 1, 1) if direction == 'X' else (1, 0.012, 1)
    v = _coords(nt, stretch)
    n = _noise(nt, v, streak, detail=4)
    _bump(nt, b, n, 0.22, 0.2)
    nt.links.new(_range(nt, n, rough * 0.75, min(1.0, rough * 1.35)), b.inputs['Roughness'])
    return m


def bakelite(name='bakelite', color=(0.018, 0.017, 0.016), rough=0.34):
    """Moulded black plastic of knobs and switches: smooth, slightly uneven gloss."""
    m, nt, b = _new(name)
    _set(b, color, rough, spec=0.55, coat=0.25)
    n = _noise(nt, _coords(nt), 6, detail=3)
    nt.links.new(_range(nt, n, rough * 0.8, rough * 1.3), b.inputs['Roughness'])
    return m


def knurled(name, color, ridges=48, rough=0.36, metal=0.0, strength=0.7):
    """Radial ridges around the object's own Z axis (the grip of a knob skirt)."""
    m, nt, b = _new(name)
    _set(b, color, rough, metal, coat=0.0 if metal else 0.2)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    g = nt.nodes.new('ShaderNodeTexGradient')
    g.gradient_type = 'RADIAL'
    nt.links.new(tc.outputs['Object'], g.inputs['Vector'])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = ridges * 6.2831853
    sin = nt.nodes.new('ShaderNodeMath')
    sin.operation = 'SINE'
    nt.links.new(g.outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs[0], sin.inputs[0])
    _bump(nt, b, sin.outputs[0], strength, 0.2)
    return m


def chrome(name='chrome', rough=0.14):
    return plain(name, (0.86, 0.86, 0.87), rough, metal=1.0)


def nickel(name='nickel', rough=0.3):
    m, nt, b = _new(name)
    _set(b, (0.62, 0.61, 0.6), rough, metal=1.0)
    n = _noise(nt, _coords(nt), 3, detail=4)
    nt.links.new(_range(nt, n, rough * 0.8, rough * 1.3), b.inputs['Roughness'])
    return m


def piping(name='piping', color=(0.78, 0.71, 0.55)):
    """Cream vinyl piping around a grille."""
    m, nt, b = _new(name)
    _set(b, color, 0.5, spec=0.4)
    _bump(nt, b, _noise(nt, _coords(nt), 0.8, detail=3), 0.2, 0.15)
    return m


def ink(name='ink', color=(0.03, 0.022, 0.015)):
    """Filled engraving on a metal plate: matte, almost black."""
    return plain(name, color, 0.75, spec=0.2)


def enamel(name, color, rough=0.3):
    """Paint on a pointer line or an indicator."""
    return plain(name, color, rough, coat=0.4)


def jewel(name, color, lit=False, strength=0.45):
    """Faceted glass of a pilot lamp. Lit: the glass itself emits its colour."""
    m, nt, b = _new(name)
    _set(b, color, 0.06, spec=0.8, coat=1.0)
    b.inputs['Transmission Weight'].default_value = 0.55
    b.inputs['IOR'].default_value = 1.5
    if lit:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def void(name='void'):
    """The inside of a hole."""
    return plain(name, (0.003, 0.003, 0.003), 0.95, spec=0.0)
