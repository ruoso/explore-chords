import { describe, it, expect } from 'vitest';
import { instrumentInstance, isReentrant, hasBassRegister, configFor, fromCatalog, CATALOG } from './instrument.js';

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
    expect(configFor(uke, 'standard').rootInBass).toBe(false);
    expect(configFor(fromCatalog('6guitar'), 'standard').rootInBass).toBe(true);
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
