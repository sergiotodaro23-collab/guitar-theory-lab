import { describe, expect, it } from 'vitest';
import { drumRecipe } from './drumSounds';
import { BASS_RECIPES, BASS_TIMBRES, COMP_RECIPES, COMP_TIMBRES, DRUM_KIT_SOUNDS, kitRecipe, strumOffsets, type DrumKitSound } from './instruments';
import { DRUM_VOICES } from '../jam/drums';
import { GENRES } from '../jam/genres';

describe('jam timbres (D-32)', () => {
  it('every kit has a sound for every kit piece', () => {
    for (const kit of Object.keys(DRUM_KIT_SOUNDS) as DrumKitSound[]) {
      for (const { voice } of DRUM_VOICES) expect(kitRecipe(voice, kit, drumRecipe), `${kit} ${voice}`).not.toBeNull();
    }
    // The electronic kick rings longer than the acoustic one; brushes are softer.
    expect(kitRecipe('kick', 'electronic', drumRecipe)?.tone?.decay).toBeGreaterThan(drumRecipe('kick')?.tone?.decay ?? 1);
    expect(kitRecipe('snare', 'brushes', drumRecipe)?.noise?.level).toBeLessThan(drumRecipe('snare')?.noise?.level ?? 0);
  });

  it('bass and comping recipes are playable: partials, an envelope, a filter in the audible range', () => {
    for (const recipe of [...Object.values(BASS_RECIPES), ...Object.values(COMP_RECIPES)]) {
      expect(recipe.partials.length).toBeGreaterThan(0);
      expect(recipe.attack).toBeGreaterThan(0);
      expect(recipe.sustain).toBeGreaterThan(0);
      expect(recipe.sustain).toBeLessThanOrEqual(1);
      expect(recipe.filter.to).toBeGreaterThanOrEqual(100);
      expect(recipe.filter.from).toBeLessThanOrEqual(12000);
    }
    expect(Object.keys(BASS_TIMBRES)).toEqual(Object.keys(BASS_RECIPES));
    expect(Object.keys(COMP_TIMBRES)).toEqual(Object.keys(COMP_RECIPES));
  });

  it('a clean guitar strums low to high; keys play the chord at once', () => {
    strumOffsets(4, COMP_RECIPES.clean).forEach((t, i) => expect(t).toBeCloseTo(i * 0.012));
    expect(strumOffsets(4, COMP_RECIPES.keys).every((t) => t === 0)).toBe(true);
  });

  it('each genre suggests sounds that exist, and they differ across genres', () => {
    for (const g of GENRES) {
      expect(DRUM_KIT_SOUNDS[g.sounds.drums]).toBeDefined();
      expect(BASS_TIMBRES[g.sounds.bass]).toBeDefined();
      expect(COMP_TIMBRES[g.sounds.comp]).toBeDefined();
    }
    expect(new Set(GENRES.map((g) => JSON.stringify(g.sounds))).size).toBeGreaterThan(4);
  });
});
