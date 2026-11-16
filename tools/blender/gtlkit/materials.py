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


def grille_cloth(name='cloth', color=(0.26, 0.2, 0.12), dark=(0.04, 0.03, 0.02), thread=2.2, open_weave=0.0):
    """Woven grille cloth: two sets of threads crossing, with a little irregularity. `open_weave` > 0 leaves the gaps between threads see-through, so what is behind the cloth shows faintly."""
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
    if open_weave > 0:
        gap = nt.nodes.new('ShaderNodeMath')
        gap.operation = 'GREATER_THAN'
        gap.inputs[1].default_value = open_weave
        nt.links.new(mx.outputs[0], gap.inputs[0])
        nt.links.new(gap.outputs[0], b.inputs['Alpha'])
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


def jewel(name, color, lit=False, strength=1.7, glow=(1.0, 0.035, 0.012)):
    """Faceted glass of a pilot lamp. Lit: the glass emits `glow`, strong enough to burn towards white at its centre as a real lamp does."""
    m, nt, b = _new(name)
    _set(b, color, 0.06, spec=0.8, coat=1.0)
    b.inputs['Transmission Weight'].default_value = 0.55
    b.inputs['IOR'].default_value = 1.5
    if lit:
        b.inputs['Emission Color'].default_value = (*glow, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def void(name='void'):
    """The inside of a hole."""
    return plain(name, (0.003, 0.003, 0.003), 0.95, spec=0.0)


def srgb(hex_color):
    """'#2f6fb0' as the linear RGB Blender wants: a spec can carry the colours the interface uses."""
    h = hex_color.lstrip('#')
    def lin(c):
        c = int(c, 16) / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(h[0:2]), lin(h[2:4]), lin(h[4:6]))


def deepen(color, saturation=1.35, value=0.8):
    """A paint colour for rendering: the view transform and the clear coat wash colours out, so the pigment goes in richer than the swatch."""
    import colorsys
    h, sat, v = colorsys.rgb_to_hsv(*color)
    return colorsys.hsv_to_rgb(h, min(1.0, sat * saturation), v * value)


def painted(name, color, finish='gloss'):
    """
    Paint on a die-cast enclosure, under a clear coat.
      gloss     solid colour with a faint orange peel
      metallic  fine metal flakes under the coat
      hammered  the dimpled finish of hammer-tone paint
      matte     no coat: wrinkle-free powder paint
    """
    m, nt, b = _new(name)
    v = _coords(nt)
    if finish == 'metallic':
        _set(b, color, 0.42, metal=0.55, coat=1.0)
        flakes = nt.nodes.new('ShaderNodeTexVoronoi')
        flakes.inputs['Scale'].default_value = 1.0 / (0.45 * U)
        nt.links.new(v, flakes.inputs['Vector'])
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(flakes.outputs['Color'], sep.inputs[0])
        _bump(nt, b, sep.outputs[0], 0.2, 0.12)
        nt.links.new(_range(nt, sep.outputs[1], 0.3, 0.55), b.inputs['Roughness'])
    elif finish == 'hammered':
        _set(b, color, 0.4, metal=0.45, coat=0.7)
        dimples = nt.nodes.new('ShaderNodeTexVoronoi')
        dimples.feature = 'SMOOTH_F1'
        dimples.inputs['Scale'].default_value = 1.0 / (4.5 * U)
        dimples.inputs['Smoothness'].default_value = 0.6
        nt.links.new(v, dimples.inputs['Vector'])
        _bump(nt, b, dimples.outputs['Distance'], 0.5, 1.2)
    elif finish == 'matte':
        _set(b, color, 0.62, spec=0.35)
        _bump(nt, b, _noise(nt, v, 0.7, detail=3), 0.12, 0.15)
    else:
        _set(b, color, 0.32, coat=1.0)
        _bump(nt, b, _noise(nt, v, 3.0, detail=2), 0.035, 0.3)
    return m


def anodized(name, color=(0.045, 0.047, 0.052), rough=0.42):
    """Anodised aluminium: a metal with a satin, very finely brushed dyed surface."""
    m, nt, b = _new(name)
    _set(b, color, rough, metal=0.85)
    n = _noise(nt, _coords(nt, (0.02, 1, 1)), 0.4, detail=3)
    _bump(nt, b, n, 0.08, 0.15)
    nt.links.new(_range(nt, n, rough * 0.85, rough * 1.2), b.inputs['Roughness'])
    return m


def rubber(name='rubber', color=(0.012, 0.012, 0.012)):
    m, nt, b = _new(name)
    _set(b, color, 0.72, spec=0.3)
    _bump(nt, b, _noise(nt, _coords(nt), 0.6, detail=3), 0.15, 0.15)
    return m


def cone_paper(name='cone-paper', color=(0.03, 0.028, 0.026)):
    """Pressed paper of a loudspeaker cone: matte, fibrous."""
    m, nt, b = _new(name)
    _set(b, color, 0.85, spec=0.25)
    _bump(nt, b, _noise(nt, _coords(nt), 1.2, detail=5), 0.3, 0.3)
    return m


def led_lens(name, color, lit=False, strength=1.1):
    """Diffused plastic lens of an LED. Lit: it emits; off: the dark tinted plastic."""
    m, nt, b = _new(name)
    if lit:
        _set(b, color, 0.25, spec=0.5, coat=0.6)
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = strength
    else:
        _set(b, tuple(c * 0.16 for c in color), 0.22, spec=0.6, coat=0.8)
    return m


def key_cap(name, color, lit=False, strength=0.3):
    """Translucent moulded key of a console. Off: the dark tinted plastic. Lit: the lamp under it glows through, brighter at the centre."""
    m, nt, b = _new(name)
    if not lit:
        _set(b, color, 0.38, spec=0.5, coat=0.35)
        return m
    _set(b, color, 0.34, spec=0.5, coat=0.35)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    grad = nt.nodes.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (2.2, 4.0, 1.0)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
    nt.links.new(_range(nt, grad.outputs['Fac'], strength * 0.45, strength), b.inputs['Emission Strength'])
    b.inputs['Emission Color'].default_value = (*color, 1)
    return m


def wood(name, light, dark, grain=1.4, along='X', figure=0.0, pores=0.0, rough=0.4, coat=0.0, contrast=1.0):
    """
    Wood seen on its face, grain running along `along`. Three layers, all
    procedural: long streaks of early and late wood, a slow drift of tone
    across the board, and optionally `figure` (the cross-grain shimmer of
    flamed maple) and `pores` (the short dark dashes of open-pored woods such
    as rosewood and walnut). `grain` is the streak width in CSS px.
    """
    m, nt, b = _new(name)
    _set(b, light, rough, spec=0.4, coat=coat)
    long_axis = (0.035, 1, 1) if along == 'X' else (1, 0.035, 1)
    v = _coords(nt, long_axis)
    streaks = _noise(nt, v, grain, detail=6, rough=0.62)
    drift = _noise(nt, _coords(nt, (0.2, 1, 1) if along == 'X' else (1, 0.2, 1)), 38, detail=2)
    mix = nt.nodes.new('ShaderNodeMath')
    mix.operation = 'MULTIPLY_ADD'
    mix.inputs[1].default_value = 0.72
    nt.links.new(streaks, mix.inputs[0])
    nt.links.new(_range(nt, drift, -0.1, 0.38), mix.inputs[2])
    tone = mix.outputs[0]
    if figure > 0:
        wave = nt.nodes.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = along
        wave.inputs['Scale'].default_value = 6.2831853 / (20.0 * 26 * U)
        wave.inputs['Distortion'].default_value = 7.0
        wave.inputs['Detail'].default_value = 2.0
        wave.inputs['Detail Scale'].default_value = 0.6
        nt.links.new(_coords(nt), wave.inputs['Vector'])
        add = nt.nodes.new('ShaderNodeMath')
        add.operation = 'MULTIPLY_ADD'
        add.inputs[1].default_value = figure
        nt.links.new(wave.outputs['Fac'], add.inputs[0])
        nt.links.new(tone, add.inputs[2])
        tone = add.outputs[0]
    if pores > 0:
        dash = _noise(nt, _coords(nt, (0.12, 1, 1) if along == 'X' else (1, 0.12, 1)), 0.55, detail=2, rough=0.5)
        cut = nt.nodes.new('ShaderNodeMath')
        cut.operation = 'GREATER_THAN'
        cut.inputs[1].default_value = 0.66
        nt.links.new(dash, cut.inputs[0])
        sub = nt.nodes.new('ShaderNodeMath')
        sub.operation = 'MULTIPLY_ADD'
        sub.inputs[1].default_value = -pores
        nt.links.new(cut.outputs[0], sub.inputs[0])
        nt.links.new(tone, sub.inputs[2])
        tone = sub.outputs[0]
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = 0.5 - 0.3 / contrast
    ramp.inputs['From Max'].default_value = 0.5 + 0.3 / contrast
    nt.links.new(tone, ramp.inputs['Value'])
    nt.links.new(_mix_color(nt, ramp.outputs['Result'], dark, light), b.inputs['Base Color'])
    _bump(nt, b, streaks, 0.06 if coat else 0.18, 0.2)
    return m


def maple(name='maple'):
    """Lacquered hard maple of a fretboard: pale gold, faint flame."""
    return wood(name, (0.93, 0.6, 0.24), (0.62, 0.33, 0.09), grain=1.3, figure=0.07, rough=0.32, coat=0.3, contrast=1.5)


def rosewood(name='rosewood'):
    """Oiled rosewood of a fretboard: dark chocolate with near-black streaks and open pores."""
    return wood(name, (0.13, 0.062, 0.035), (0.03, 0.014, 0.01), grain=1.6, pores=0.25, rough=0.5, contrast=1.3)


def walnut(name='walnut', along='Y'):
    """Satin walnut of the studio's furniture."""
    return wood(name, (0.105, 0.05, 0.026), (0.028, 0.013, 0.008), grain=2.0, along=along, pores=0.12, rough=0.45, coat=0.15, contrast=1.2)
