/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { serialiseInstrument, deserialiseInstrument } from './persist.js';
import { fromCatalog, configFor } from '../core/instrument.js';
import { DEFAULT_WEIGHTS } from '../core/heuristics.js';

const stored = (heuristics) => ({
  id: 'inst_1',
  catalogId: '6guitar',
  label: 'Guitar · Standard',
  strings: 'E2, A2, D3, G3, B3, E4',
  fretCount: 22,
  heuristics,
});

describe('an instrument saved before a preset was renamed', () => {
  it('comes back on the preset it now goes by', () => {
    const old = { ...configFor(fromCatalog('6guitar'), 'strumming'), preset: 'standard' };
    const instrument = deserialiseInstrument(stored(old));
    expect(instrument.heuristics.preset).toBe('strumming');
  });

  it('comes back with what that preset says today', () => {
    // A named preset is its rules, so there is nothing of the user's to lose by
    // rebuilding it — and rebuilding is the only way a correction to a preset
    // reaches somebody who set their instrument up before it was made. This one
    // stopped charging for a muted string in the middle of a chord.
    const old = {
      ...configFor(fromCatalog('6guitar'), 'strumming'),
      preset: 'standard',
      weights: { ...DEFAULT_WEIGHTS, innerMute: 3.0 },
    };
    expect(deserialiseInstrument(stored(old)).heuristics.weights.innerMute).toBe(0);
  });

  it('keeps a configuration the user edited exactly as they left it', () => {
    const mine = {
      ...configFor(fromCatalog('6guitar'), 'strumming'),
      preset: 'custom',
      maxSpan: 6,
      weights: { ...DEFAULT_WEIGHTS, barre: 9 },
    };
    const heuristics = deserialiseInstrument(stored(mine)).heuristics;
    expect(heuristics.preset).toBe('custom');
    expect(heuristics.maxSpan).toBe(6);
    expect(heuristics.weights.barre).toBe(9);
  });

  it('still lets the instrument overrule the preset', () => {
    const uke = {
      id: 'inst_2',
      catalogId: 'ukulele',
      label: 'Ukulele',
      strings: 'G4, C4, E4, A4',
      fretCount: 15,
      heuristics: { ...configFor(fromCatalog('ukulele'), 'strumming'), preset: 'standard' },
    };
    expect(deserialiseInstrument(uke).heuristics.rootInBass).toBe(false);
  });

  it('round-trips an instrument through storage unchanged', () => {
    const guitar = fromCatalog('6guitar');
    const back = deserialiseInstrument(serialiseInstrument(guitar));
    expect(back.heuristics).toEqual(guitar.heuristics);
    expect(back.label).toBe(guitar.label);
    expect(back.id).toBe(guitar.id);
  });
});
