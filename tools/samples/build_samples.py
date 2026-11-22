#!/usr/bin/env python3
"""
Build the Jam Studio multisample sets (J2, D-60) from their public sources.

Every source is pinned to a commit and carries a licence compatible with
GPL-3.0-or-later (CC0, or CC BY 3.0 for the electric piano); see docs/AUDIO_ASSETS.md. Files are fetched one
by one from raw.githubusercontent.com, decoded with ffmpeg, mixed (drum
microphones), trimmed, faded, scaled by ONE gain per instrument (so velocity
layers keep their real dynamics), checked for pitch, and encoded to Opus.

Output: public/samples/<instrument>/*.ogg and manifest.json, read by
src/audio/sampler.ts. Run from the repository root:

    python3 tools/samples/build_samples.py [--only drums,piano,ebass,upright,brushes,electronic,epiano]

Needs ffmpeg and numpy. Downloads are cached in $SAMPLES_CACHE (default
~/.cache/gtl-samples) so a rebuild does not download again.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

RATE = 48000
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'samples'
CACHE = Path(os.environ.get('SAMPLES_CACHE', Path.home() / '.cache' / 'gtl-samples'))

SOURCES = {
    'virtuosity': ('sfzinstruments/virtuosity_drums', '9f04cf9a734527edfbb0a4eee1f674e45bbf71bc'),
    'vcsl': ('sgossner/VCSL', 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e'),
    'growlybass': ('sfzinstruments/karoryfer.growlybass', '4f483268fc66b5a6d5781d421c0d11b8d08d3fc6'),
    'meatbass': ('sfzinstruments/karoryfer.meatbass', 'ac9e859564bda286ab5ec672d00ff1aa2fef2895'),
    'bigrusty': ('sfzinstruments/karoryfer.big-rusty-drums', 'f07ce00df34a46b6b08375be56fe116cf15782bc'),
    'mck': ('MckAudio/MckSamplePacks', '5db40e8fe26785c256845a5bb38921b2654a887f'),
    'sullivan': ('sfzinstruments/GregSullivan.E-Pianos', '8c3e581acda3594b553948ff0222d4f84a698376'),
}

NOTE_PC = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}


def note_midi(name: str) -> int:
    """'A#0', 'eb3', 'db2', 'gb1' → MIDI with C4 = 60."""
    m = re.fullmatch(r'([a-gA-G])(#|b)?(-?\d)', name)
    if not m:
        raise ValueError(name)
    pc = NOTE_PC[m.group(1).lower()] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + pc


def fetch(source: str, path: str) -> Path:
    repo, sha = SOURCES[source]
    target = CACHE / source / path
    if target.exists() and target.stat().st_size > 0:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f'https://raw.githubusercontent.com/{repo}/{sha}/{urllib.parse.quote(path)}'
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                data = response.read()
            tmp = target.with_suffix(target.suffix + '.part')
            tmp.write_bytes(data)
            tmp.rename(target)
            return target
        except Exception as error:  # network hiccups: retry with backoff
            if attempt == 3:
                raise RuntimeError(f'download failed: {url}: {error}') from error
            import time
            time.sleep(2 ** attempt)
    raise AssertionError


def decode(path: Path, channels: int) -> np.ndarray:
    """Float32 array (frames, channels) at RATE."""
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', str(channels), '-ar', str(RATE), '-'],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()


def mix(parts: list[tuple[np.ndarray, float]]) -> np.ndarray:
    length = max(p.shape[0] for p, _ in parts)
    out = np.zeros((length, parts[0][0].shape[1]), dtype=np.float32)
    for audio, gain in parts:
        out[: audio.shape[0]] += audio * gain
    return out


def trim(audio: np.ndarray, max_seconds: float, floor_db: float = -62.0, fade_seconds: float = 0.05) -> np.ndarray:
    """Cut leading silence (keeping the attack), the tail below `floor_db`, and anything past `max_seconds`, with a fade."""
    level = np.max(np.abs(audio), axis=1)
    peak = float(level.max()) or 1.0
    above = np.nonzero(level > peak * 10 ** (-48 / 20))[0]
    start = max(0, int(above[0]) - int(0.002 * RATE)) if above.size else 0
    tail = np.nonzero(level > peak * 10 ** (floor_db / 20))[0]
    end = int(tail[-1]) + 1 if tail.size else audio.shape[0]
    end = min(end, start + int(max_seconds * RATE))
    out = audio[start:end].copy()
    fade = min(out.shape[0], int(fade_seconds * RATE))
    if fade > 0:
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)[:, None]
    return out


def f0(audio: np.ndarray, min_hz: float = 25.0, max_hz: float = 2000.0) -> float:
    """Fundamental by autocorrelation between min_hz and max_hz, read after the attack (strings go sharp when hit hard)."""
    mono = audio.mean(axis=1)
    # At least 16 periods of the lowest note sought, for a stable reading on low strings.
    seg = mono[int(0.12 * RATE): int((0.12 + max(0.3, 16 / min_hz)) * RATE)]
    seg = seg - seg.mean()
    if seg.size < 2048 or not np.any(seg):
        return 0.0
    n = 1 << (seg.size * 2 - 1).bit_length()
    spec = np.fft.rfft(seg * np.hanning(seg.size), n)
    # Body thumps and sympathetic strings below the expected note would win the autocorrelation.
    spec[: int(min_hz * n / RATE)] = 0
    ac = np.fft.irfft(spec * np.conj(spec))[: seg.size]
    lo, hi = max(2, int(RATE / max_hz)), int(RATE / min_hz)
    # Skip the central lobe: start after the first negative value, then take the highest peak.
    negative = np.nonzero(ac[lo:hi] < 0)[0]
    first = lo + int(negative[0]) if negative.size else lo
    lag = first + int(np.argmax(ac[first:hi]))
    # Prefer the shortest lag with nearly the same strength (avoids octave-down errors).
    best = ac[lag]
    for div in (4, 3, 2):
        cand = int(round(lag / div))
        window = ac[max(first, cand - 3): cand + 4]
        if cand >= first and window.size and window.max() > 0.9 * best:
            lag = max(first, cand - 3) + int(np.argmax(window))
            break
    # Parabolic interpolation for sub-sample accuracy.
    if 0 < lag < ac.size - 1:
        a, b0, c = ac[lag - 1], ac[lag], ac[lag + 1]
        denom = a - 2 * b0 + c
        if denom != 0:
            return RATE / (lag + max(-1.0, min(1.0, 0.5 * (a - c) / denom)))
    return RATE / lag


def check_pitch(audio: np.ndarray, midi: int, label: str) -> float:
    """Cents the recording sits above its label (0 when it cannot be read); fails on a wrong note."""
    if audio.shape[0] <= int(0.45 * RATE):
        return 0.0  # too short to read after the attack: the root's sustained zones carry the check
    # Searched within half an octave of the label: this confirms the note and measures its tuning,
    # but cannot tell octaves apart (those were checked by hand on sample notes, see AUDIO_ASSETS.md).
    expected = 440 * 2 ** ((midi - 69) / 12)
    hz = f0(audio, expected * 2 ** (-6 / 12), expected * 2 ** (6 / 12))
    if hz <= 0:
        return 0.0
    measured = 69 + 12 * math.log2(hz / 440)
    # Less than 90 cents from the label (a wrong note is 100 or more away); one octave off is accepted only below E2, where a weak
    # fundamental can make autocorrelation read the octave above.
    off = measured - midi
    ok = abs(off) < 0.9 or (midi < 40 and abs(off - 12) < 0.9)
    if not ok:
        raise SystemExit(f'pitch check failed for {label}: labelled {midi}, measured {measured:.2f}')
    return round(((off + 6) % 12 - 6) * 100, 1)


def encode(audio: np.ndarray, target: Path, bitrate: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    channels = audio.shape[1]
    with tempfile.NamedTemporaryFile(suffix='.f32') as tmp:
        tmp.write(np.clip(audio, -1, 1).astype(np.float32).tobytes())
        tmp.flush()
        subprocess.run(
            ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', str(channels), '-i', tmp.name,
             '-c:a', 'libopus', '-b:a', bitrate, '-vbr', 'on', '-application', 'audio', str(target)],
            check=True,
        )


# --- Instruments -------------------------------------------------------------

def vel_ranges(layers: int) -> list[tuple[int, int]]:
    """Split 1–127 into `layers` bands, softest first."""
    edges = [round(1 + i * 127 / layers) for i in range(layers + 1)]
    return [(edges[i], edges[i + 1] - 1 if i < layers - 1 else 127) for i in range(layers)]


DRUM_MICS = {
    # Close mic gain, overhead gain, room gain: a natural "live club" mix of the Virtuosity kit.
    'kick': ('kickmic', 1.0, 0.45, 0.3),
    'snare': ('snaremic', 0.9, 0.6, 0.3),
    'cymbal': (None, 0.0, 1.0, 0.35),
    'tom': (None, 0.0, 0.9, 0.4),
}

# voice: (folder, articulation file stem, mic set, groups of velocity layers or (layers, rr), seconds)
DRUMS = [
    ('kick', 'kick', 'kick_snon', 'kick', ('vlrr', 4, 4), 1.2),
    ('snare', 'snare', 'snare_center', 'snare', ('vl', 36, 12), 1.3),
    ('crossStick', 'snare', 'snare_crossstick', 'snare', ('vl', 16, 4), 0.6),
    ('rimshot', 'snare', 'snare_rimshot', 'snare', ('vl', 12, 4), 1.3),
    ('hhClosed', 'hh', 'hh_closed', 'cymbal', ('vlrr', 4, 4), 0.7),
    ('hhHalf', 'hh', 'hh_half', 'cymbal', ('vlrr', 4, 4), 1.2),
    ('hhOpen', 'hh', 'hh_open', 'cymbal', ('vlrr', 4, 3), 2.0),
    ('hhPedal', 'hh', 'hh_pedal', 'cymbal', ('vlrr', 3, 4), 0.6),
    ('ride', 'ride', 'ride_ride', 'cymbal', ('vlrr', 3, 4), 2.5),
    ('rideBell', 'ride', 'ride_bell', 'cymbal', ('vlrr', 3, 3), 2.5),
    ('crash', 'crash', 'crash_crash', 'cymbal', ('vlrr', 3, 4), 3.0),
    ('tomHigh', 'htom', 'htom_center', 'tom', ('vl', 16, 4), 1.8),
    ('tomLow', 'ltom', 'ltom_center', 'tom', ('vl', 16, 4), 2.2),
]


def drum_hit(folder: str, stem: str, mics: str, vl: int, rr: int | None) -> np.ndarray:
    close, close_gain, oh_gain, room_gain = DRUM_MICS[mics]
    suffix = f'_vl{vl}' + (f'_rr{rr}' if rr is not None else '') + '.flac'
    parts = []
    for mic, gain in ((close, close_gain), ('oh', oh_gain), ('room', room_gain)):
        if mic and gain > 0:
            parts.append((decode(fetch('virtuosity', f'Samples/{mic}/{folder}/{mic}_{stem}{suffix}'), 2), gain))
    return mix(parts)


def build_drums() -> dict:
    jobs = []
    for voice, folder, stem, mics, layout, seconds in DRUMS:
        kind = layout[0]
        if kind == 'vlrr':
            _, layers, rrs = layout
            for v in range(1, layers + 1):
                for r in range(1, rrs + 1):
                    jobs.append((voice, folder, stem, mics, seconds, v, r, v, r))
        else:
            _, files, layers = layout
            per = files // layers
            # Neighbouring dynamics recorded one after the other stand in for round robins.
            for layer in range(1, layers + 1):
                for r in range(1, per + 1):
                    jobs.append((voice, folder, stem, mics, seconds, (layer - 1) * per + r, None, layer, r))

    def render(job):
        voice, folder, stem, mics, seconds, vl, rr, layer, r = job
        return job, trim(drum_hit(folder, stem, mics, vl, rr), seconds)

    with ThreadPoolExecutor(8) as pool:
        rendered = list(pool.map(render, jobs))
    peak = max(float(np.max(np.abs(a))) for _, a in rendered)
    gain = 10 ** (-1 / 20) / peak
    zones = []
    for job, audio in rendered:
        voice, *_rest = job
        layer, r = job[7], job[8]
        layers = next(d[4] for d in DRUMS if d[0] == voice)
        n_layers = layers[1] if layers[0] == 'vlrr' else layers[2]
        lo, hi = vel_ranges(n_layers)[layer - 1]
        name = f'{voice}_v{layer}_r{r}.ogg'
        encode(audio * gain, OUT / 'drums' / name, '96k')
        zones.append({'voice': voice, 'file': name, 'velLo': lo, 'velHi': hi, 'rr': r})
    return {
        'id': 'drums', 'name': 'Virtuosity Drums (kit jazz, mix close/overhead/room)', 'kind': 'drums',
        'source': 'https://github.com/sfzinstruments/virtuosity_drums', 'commit': SOURCES['virtuosity'][1],
        'license': 'CC0-1.0', 'author': 'Versilian Studios, drummer Austin McMahon',
        'zones': sorted(zones, key=lambda z: (z['voice'], z['velLo'], z['rr'])),
    }


def build_pitched(inst: str, source: str, entries: list[tuple[str, int, int, int, str]], seconds_at, channels: int, bitrate: str, meta: dict, retune: bool = True) -> dict:
    """entries: (path, midi, layer, rr, articulation)."""
    def render(entry):
        path, midi, layer, rr, art = entry
        audio = decode(fetch(source, path), channels)
        out = trim(audio, seconds_at(midi, art))
        return entry, out, check_pitch(out, midi, path)

    with ThreadPoolExecutor(8) as pool:
        rendered = list(pool.map(render, entries))
    peak = max(float(np.max(np.abs(a))) for _, a, _ in rendered)
    gain = 10 ** (-1 / 20) / peak
    layers_by_art: dict[str, int] = {}
    for (_, _, layer, _, art), _, _ in rendered:
        layers_by_art[art] = max(layers_by_art.get(art, 0), layer)
    # One tuning per root: the median of the zones long enough to read after the attack.
    by_root: dict[int, list[float]] = {}
    for (_, midi, _, _, art), audio, cents in rendered:
        if audio.shape[0] > int(0.45 * RATE) and art != 'staccato':
            by_root.setdefault(midi, []).append(cents)
    # A correction only where the zones agree (median absolute deviation under 8 cents); otherwise none.
    tune = {}
    for midi, values in by_root.items():
        median = float(np.median(values))
        spread = float(np.median(np.abs(np.array(values) - median)))
        tune[midi] = round(median, 1) if spread < 8 else 0.0
    zones = []
    for (path, midi, layer, rr, art), audio, _cents in rendered:
        # A piano is stretch-tuned on purpose: its measured offsets are kept, not corrected.
        cents = tune.get(midi, 0.0) if retune else 0.0
        lo, hi = vel_ranges(layers_by_art[art])[layer - 1]
        name = f'{art}_{midi}_v{layer}_r{rr}.ogg'
        encode(audio * gain, OUT / inst / name, bitrate)
        # `tune`: measured cents above the root; the sampler detunes by its opposite, so every zone plays in tune.
        zones.append({'articulation': art, 'root': midi, 'file': name, 'velLo': lo, 'velHi': hi, 'rr': rr, 'tune': cents})
    return {**meta, 'id': inst, 'commit': SOURCES[source][1], 'zones': sorted(zones, key=lambda z: (z['articulation'], z['root'], z['velLo'], z['rr']))}


def build_piano() -> dict:
    folder = 'Chordophones/Zithers/Grand Piano, Steinway B/NoSus'
    entries = []
    for octave in range(0, 8):
        for name in ('C', 'D', 'E', 'F#', 'G#', 'A#'):
            note = f'{name}{octave}'
            midi = note_midi(note)
            if midi < 21 or midi > 100:
                continue
            for layer, vl in enumerate((2, 3, 4), start=1):
                entries.append((f'{folder}/JHPiano_NoSus_Close_{note}_vl{vl}_rr1.wav', midi, layer, 1, 'sustain'))
    # Mono, and shorter in the middle and top: decoded audio is float at 48 kHz, so memory, not download, is the limit.
    return build_pitched('piano', 'vcsl', entries, lambda midi, _a: 5.0 if midi < 48 else 3.5 if midi < 72 else 2.5, 1, '56k', {
        'name': 'Steinway B (VCSL, microfoni vicini)', 'kind': 'pitched',
        # The source normalised every layer: the sampler rebuilds the dynamics with a velocity curve.
        'normalized': True,
        'source': 'https://github.com/sgossner/VCSL', 'license': 'CC0-1.0', 'author': 'Versilian Studios, VCSL',
    }, retune=False)


def build_ebass() -> dict:
    notes = ['e2', 'gb2', 'a2', 'c3', 'eb3', 'gb3', 'a3', 'c4', 'eb4', 'gb4', 'a4', 'c5', 'eb5']
    entries = []
    for note in notes:
        # The library names notes one octave up (its E2 is the open low E, MIDI 28).
        midi = note_midi(note) - 12
        for layer, dyn in enumerate(('pp', 'p', 'f', 'ff'), start=1):
            for rr in (1, 2):
                entries.append((f'sustain/{note}_{dyn}_rr{rr}.wav', midi, layer, rr, 'sustain'))
        for rr in (1, 2, 3):
            entries.append((f'staccato/{note}_staccato_rr{rr}.wav', midi, 1, rr, 'staccato'))
    return build_pitched('ebass', 'growlybass', entries, lambda midi, art: 0.9 if art == 'staccato' else 2.5, 1, '56k', {
        'name': 'Growlybass (Squier Jazz Bass, diretto)', 'kind': 'pitched', 'normalized': False,
        'source': 'https://github.com/sfzinstruments/karoryfer.growlybass', 'license': 'CC0-1.0', 'author': 'Karoryfer Lecolds',
    })


def build_upright() -> dict:
    notes = ['a0', 'c1', 'eb1', 'gb1', 'a1', 'c2', 'eb2', 'gb2', 'a2', 'c3', 'eb3', 'gb3', 'a3', 'c4']
    entries = []
    for note in notes:
        # Meatbass names notes as they sound (its a0 is MIDI 21, c2 is 36): confirmed by the pitch check.
        midi = note_midi(note)
        for layer in (1, 2, 3, 4):
            for rr in (1, 2):
                entries.append((f'Samples/pizz/{note}_vl{layer}_rr{rr}.wav', midi, layer, rr, 'pizz'))
    return build_pitched('upright', 'meatbass', entries, lambda midi, _a: 2.5, 1, '56k', {
        'name': 'Meatbass (contrabbasso pizzicato)', 'kind': 'pitched', 'normalized': False,
        'source': 'https://github.com/sfzinstruments/karoryfer.meatbass', 'license': 'CC0-1.0', 'author': 'Karoryfer Lecolds',
    })


# Brushes: Big Rusty Drums (Karoryfer, CC0). Every piece played with brushes, except the kick (a felt beater
# is what a brush player's foot uses) and the hi-hat foot. Mics: close (snare top/bottom, toms, cymbals) and overhead.
# voice: (sample folder, file stem, ((mic, gain), ...), layers, round robins, seconds)
BRUSHES = [
    ('kick', 'kick_24/kick', 'k', (('kick', 1.0), ('oh', 0.5)), 14, 4, 1.0),
    ('snare', 'snare_14/brush', 'sn_b', (('top', 1.0), ('btm', 0.25), ('oh', 0.6)), 8, 4, 1.2),
    # Cross-stick: the brush handle on the rim, as for a bossa nova.
    ('crossStick', 'snare_14/sidestick', 'sn_ss', (('top', 1.0), ('btm', 0.25), ('oh', 0.6)), 4, 4, 0.6),
    ('hhClosed', 'hihat_14/cl_brush', 'ht_cl_b', (('cl', 0.7), ('oh', 0.8)), 5, 4, 0.8),
    ('hhHalf', 'hihat_14/lc_brush', 'ht_lc_b', (('cl', 0.7), ('oh', 0.8)), 5, 4, 1.2),
    ('hhOpen', 'hihat_14/open_brush', 'ht_open_b', (('cl', 0.7), ('oh', 0.8)), 4, 4, 2.0),
    ('hhPedal', 'hihat_14/chik', 'ht_chik', (('cl', 0.7), ('oh', 0.8)), 5, 4, 0.6),
    ('ride', 'ride_22/brush', 'rd_b', (('cl', 0.6), ('oh', 0.9)), 4, 4, 2.5),
    ('crash', 'crash_17/brush', 'cr_b', (('cl', 0.6), ('oh', 0.9)), 4, 4, 3.0),
    ('tomHigh', 'tom_14/brush', 't14_b', (('cl', 1.0), ('oh', 0.6)), 5, 4, 1.5),
    ('tomLow', 'tom_18/brush', 't18_b', (('cl', 1.0), ('oh', 0.6)), 5, 4, 2.0),
]

# Peak of each voice's loudest layer, in dBFS: a brush kit as mixed for a jazz trio.
BRUSH_PEAK_DB = {'kick': -4, 'snare': -3, 'crossStick': -8, 'hhClosed': -10, 'hhHalf': -9, 'hhOpen': -8, 'hhPedal': -10,
                 'ride': -7, 'crash': -5, 'tomHigh': -4, 'tomLow': -4}


def build_brushes() -> dict:
    jobs = [(voice, folder, stem, mics, seconds, v, r, layers)
            for voice, folder, stem, mics, layers, rrs, seconds in BRUSHES
            for v in range(1, layers + 1) for r in range(1, rrs + 1)]

    def render(job):
        voice, folder, stem, mics, seconds, v, r, _layers = job
        parts = [(decode(fetch('bigrusty', f'Samples/{folder}/{mic}/{stem}_vl{v}_rr{r}.flac'), 2), gain) for mic, gain in mics]
        return job, trim(mix(parts), seconds)

    with ThreadPoolExecutor(8) as pool:
        rendered = list(pool.map(render, jobs))
    # One gain per voice, not per kit: close mics make the kick peak 25 dB over a brushed ride. Each voice's loudest
    # layer is set to its place in a mixed kit; inside a voice the layers keep their recorded dynamics.
    peaks: dict[str, float] = {}
    for (voice, *_rest), audio in rendered:
        peaks[voice] = max(peaks.get(voice, 0.0), float(np.max(np.abs(audio))))
    zones = []
    for (voice, _f, _s, _m, _sec, v, r, layers), audio in rendered:
        lo, hi = vel_ranges(layers)[v - 1]
        name = f'{voice}_v{v}_r{r}.ogg'
        gain = 10 ** (BRUSH_PEAK_DB[voice] / 20) / peaks[voice]
        encode(audio * gain, OUT / 'brushes' / name, '80k')
        zones.append({'voice': voice, 'file': name, 'velLo': lo, 'velHi': hi, 'rr': r})
    return {
        'id': 'brushes', 'name': 'Big Rusty Drums (spazzole, mix close/overhead)', 'kind': 'drums',
        'source': 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums', 'commit': SOURCES['bigrusty'][1],
        'license': 'CC0-1.0', 'author': 'Karoryfer Samples (D. Smolken)',
        'zones': sorted(zones, key=lambda z: (z['voice'], z['velLo'], z['rr'])),
    }


# Electronic kit: one-shots of a Roland TR-8 recorded by MckAudio (CC0), the 808 voices with a 909 ride.
# A drum machine has one sound per voice whatever the velocity: the sampler scales the level (`normalized`).
ELECTRONIC = [
    ('kick', 'BD/001_808_Bass_Drum_1.wav', 1.6),
    ('snare', 'SD/001_808_Snare_Drum_1.wav', 0.8),
    ('hhClosed', 'HATS/002_808_Closed_HiHat.wav', 0.5),
    ('hhOpen', 'HATS/001_808_Open_HiHat.wav', 1.2),
    ('ride', 'HATS/026_909_Ride_Cymbal.wav', 2.5),
    ('crash', 'HATS/017_808_Crash_Cymbal.wav', 3.0),
    ('clap', 'PERC/017_808_Hand_Clap.wav', 0.8),
    ('rimshot', 'PERC/008_808_Rim_Shot.wav', 0.4),
    ('tomHigh', 'TOMS/002_808_Mid_Tom.wav', 1.0),
    ('tomLow', 'TOMS/001_808_Low_Tom.wav', 1.2),
]


def build_electronic() -> dict:
    def render(entry):
        voice, path, seconds = entry
        return voice, trim(decode(fetch('mck', f'TR8/{path}'), 1), seconds, floor_db=-66.0)

    with ThreadPoolExecutor(8) as pool:
        rendered = list(pool.map(render, ELECTRONIC))
    peak = max(float(np.max(np.abs(a))) for _, a in rendered)
    gain = 10 ** (-1 / 20) / peak
    zones = []
    for voice, audio in rendered:
        name = f'{voice}.ogg'
        encode(audio * gain, OUT / 'electronic' / name, '64k')
        zones.append({'voice': voice, 'file': name, 'velLo': 1, 'velHi': 127, 'rr': 1})
    return {
        'id': 'electronic', 'name': 'Roland TR-8 (voci 808, ride 909), registrato da MckAudio', 'kind': 'drums', 'normalized': True,
        'source': 'https://github.com/MckAudio/MckSamplePacks', 'commit': SOURCES['mck'][1],
        'license': 'CC0-1.0', 'author': 'MckAudio (Henri Schaffer)',
        'zones': sorted(zones, key=lambda z: z['voice']),
    }


# Electric piano: Wurlitzer EP200 by Greg Sullivan (CC BY 3.0). Four velocity layers (pp, mp, f, ff) whose
# roots differ from layer to layer, as in the source's mapping; the sampler picks the layer first, then the root.
WURLITZER = {
    # Above C#5 the source has no pp take: its pp layer plays the mp ones, and so does this.
    1: ['a1pp', 'ab2pp', 'eb3pp', 'ab3pp', 'db4pp', 'g4pp', 'db5pp', 'g5mp', 'db6mp', 'ab6mp'],
    2: ['a1mp', 'e2mp', 'a2mp', 'eb3mp', 'ab3mp', 'db4mp', 'gb4mp', 'b4mp', 'db5mp', 'g5mp', 'db6mp', 'ab6mp'],
    3: ['a1f', 'c2f', 'f2f', 'b2f', 'e3f', 'ab3f', 'db4f', 'ab4f', 'db5f', 'g5f', 'db6f', 'ab6f'],
    # Above G5 the ff layer plays the f takes, as in the source.
    4: ['a1ff', 'c2ff', 'f2ff', 'b2ff', 'e3ff', 'ab3ff', 'db4ff', 'e4ff', 'g4ff', 'db5ff', 'g5ff', 'db6f', 'ab6f'],
}


def build_epiano() -> dict:
    entries = []
    for layer, names in WURLITZER.items():
        for name in names:
            note = re.fullmatch(r'([a-g]b?)(\d)(pp|mp|f|ff)', name)
            assert note, name
            entries.append((f'Wurlitzer EP200/Samples/{name}.flac', note_midi(note.group(1) + note.group(2)), layer, 1, 'sustain'))
    return build_pitched('epiano', 'sullivan', entries, lambda midi, _a: 4.0 if midi < 60 else 3.0, 1, '56k', {
        # Every take is peak-normalised in the source (its mapping adds no velocity tracking): the sampler sets the level.
        'name': 'Wurlitzer EP200 (Greg Sullivan)', 'kind': 'pitched', 'normalized': True, 'layerFirst': True,
        'source': 'https://github.com/sfzinstruments/GregSullivan.E-Pianos', 'license': 'CC-BY-3.0', 'author': 'Greg Sullivan',
    })


BUILDERS = {'drums': build_drums, 'piano': build_piano, 'ebass': build_ebass, 'upright': build_upright,
            'brushes': build_brushes, 'electronic': build_electronic, 'epiano': build_epiano}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', default=','.join(BUILDERS))
    args = parser.parse_args()
    for name in args.only.split(','):
        target = OUT / name
        if target.exists():
            for old in target.glob('*.ogg'):
                old.unlink()
        manifest = BUILDERS[name]()
        target.mkdir(parents=True, exist_ok=True)
        (target / 'manifest.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
        size = sum(f.stat().st_size for f in target.glob('*.ogg'))
        print(f'{name}: {len(manifest["zones"])} zones, {size / 1e6:.2f} MB', file=sys.stderr)


if __name__ == '__main__':
    main()
