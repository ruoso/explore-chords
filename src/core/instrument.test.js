import { describe, it, expect } from 'vitest';
import {
  instrumentInstance,
  isReentrant,
  hasBassRegister,
  configFor,
  fromCatalog,
  defaultPresetFor,
  CATALOG,
} from './instrument.js';
import { presetConfig, resolvePresetId, PRESET_IDS } from './heuristics.js';

describe('instrument instances', () => {
  it('gives every instance a distinct id', () => {
    // The id must not collide across page loads: an instrument built from a
    // shared link would otherwise reuse `inst_1` and shadow a saved one.
    const ids = new Set();
    for (let i = 0; i < 200; i += 1) {
      ids.add(instrumentInstance({ strings: 'E2, A2, D3, G3, B3, E4' }).id);
    }
    expect(ids.size).toBe(200);
  });

  it('knows which instruments have a bass register', () => {
    expect(hasBassRegister(fromCatalog('6guitar'))).toBe(true);
    expect(hasBassRegister(fromCatalog('4bass'))).toBe(true);
    expect(hasBassRegister(fromCatalog('ukulele'))).toBe(false);
    expect(hasBassRegister(fromCatalog('cavaquinho'))).toBe(false);
  });

  it('keeps instrument defaults when a preset is applied on top', () => {
    // Switching to Jazz must not turn the root-bass rule back on for a ukulele.
    const uke = fromCatalog('ukulele');
    expect(configFor(uke, 'jazz').rootInBass).toBe(false);
    expect(configFor(uke, 'strumming').rootInBass).toBe(false);
    expect(configFor(fromCatalog('6guitar'), 'strumming').rootInBass).toBe(true);
  });

  it('starts from the preset it was created with', () => {
    // How you play is asked when the instrument is set up (§2.1), so the answer
    // has to reach the instance that setup builds.
    const picked = instrumentInstance({ strings: 'E2, A2, D3, G3, B3, E4', preset: 'fingerstyle' });
    expect(picked.heuristics.preset).toBe('fingerstyle');
    expect(picked.heuristics.allowInnerMutes).toBe(true);

    // And instrument-derived defaults still win over the preset.
    const uke = instrumentInstance({
      catalogId: 'ukulele',
      strings: 'G4, C4, E4, A4',
      preset: 'fingerstyle',
    });
    expect(uke.heuristics.rootInBass).toBe(false);
  });

  it('starts a guitar on strumming and a bass on its own rules', () => {
    expect(defaultPresetFor('6guitar')).toBe('strumming');
    expect(defaultPresetFor('4bass')).toBe('bassFriendly');
    expect(instrumentInstance({ strings: 'E2, A2, D3, G3, B3, E4' }).heuristics.preset).toBe(
      'strumming'
    );
  });

  it('still understands the name Standard went by', () => {
    // Renamed when fingerstyle got a preset of its own. Anything saved or
    // linked under the old name has to keep working.
    expect(resolvePresetId('standard')).toBe('strumming');
    expect(resolvePresetId('jazz')).toBe('jazz');
    expect(presetConfig('standard').preset).toBe('strumming');
    expect(PRESET_IDS).not.toContain('standard');
    expect(PRESET_IDS).toContain('strumming');
    expect(PRESET_IDS).toContain('fingerstyle');
  });

  it('detects re-entrant tunings', () => {
    expect(isReentrant(fromCatalog('ukulele', 'Standard (re-entrant)'))).toBe(true);
    expect(isReentrant(fromCatalog('ukulele', 'Low G'))).toBe(false);
  });

  it('builds every catalog entry with every tuning', () => {
    for (const entry of CATALOG) {
      for (const tuning of entry.tunings) {
        const inst = fromCatalog(entry.id, tuning.name);
        expect(inst.strings.length).toBeGreaterThan(1);
        expect(inst.fretCount).toBe(entry.fretCount);
      }
    }
  });
});
