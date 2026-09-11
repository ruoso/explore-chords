import { describe, it, expect } from 'vitest';
import { parseSong } from './song.js';
import { parseChord } from './notation/parse.js';
import { chordTones, bassNote, voicedAs } from './chord.js';
import { pitchClass, formatNote } from './pitch.js';
import { fromCatalog, instrumentInstance } from './instrument.js';
import { fingeringFromFrets } from './search.js';
import { shorthandOf } from './fretstring.js';
import { PLANNERS, plannerById, plannersFor, planVoicings } from './voicing-plan.js';

const guitar = fromCatalog('6guitar');
const ukulele = fromCatalog('ukulele');

/** The A section of Dominante, which is what this was built against. */
const DOMINANTE = [
  '# A',
  'Gm | A7 | Dm | % | E7 | Dm | % | Gm',
  'A7 | Dm | Dm6 E7 | A F#m | Bm | E7 | A | Gm6 ( C7 )',
  'F | Dm | G7 | % | Gm | C7 | F | D7/F#',
  'Gm | Gm6 | Dm | % | Eb | A7 | Dm',
].join('\n');

const plan = (id, text, instrument = guitar) =>
  planVoicings(id, parseSong(text, 'brazilian'), instrument, { dialect: 'brazilian' });

const shapes = (result) => new Map([...result.chosen].map(([k, f]) => [k, shorthandOf(f)]));

describe('planning a whole song at once', () => {
  it('chooses one shape per distinct chord, not per bar', () => {
    // Gm appears in four bars and Dm in six; the text can hold one shape each.
    const result = plan('smoothest', DOMINANTE);
    expect(result.chosen.size).toBe(14);
    expect(result.missing).toEqual([]);
  });

  it('refuses a planner it does not have', () => {
    expect(() => plan('mystery', 'C | G')).toThrow(/Unknown planner/);
  });

  it('skips a chord nothing can parse rather than failing the song', () => {
    const result = plan('smoothest', 'C | Zq9 | G');
    expect([...result.chosen.keys()]).toEqual(['C', 'G']);
  });

  it('says which shapes the song already had', () => {
    const first = plan('smoothest', DOMINANTE);
    const again = planVoicings('smoothest', parseSong(DOMINANTE, 'brazilian'), guitar, {
      dialect: 'brazilian',
      existing: first.chosen,
    });
    expect(again.unchanged.length).toBe(again.chosen.size);
  });

  it('gives every chord a playable shape, whichever planner', () => {
    for (const planner of PLANNERS) {
      const result = plan(planner.id, DOMINANTE);
      expect(result.missing, planner.id).toEqual([]);
      for (const [key, frets] of result.chosen) {
        const chord = parseChord(key.replace(/\/[A-G][b#]?$/, ''), 'brazilian').chord;
        expect(fingeringFromFrets(frets, chord, guitar), `${planner.id} ${key}`).toBeTruthy();
      }
    }
  });
});

describe('the planners differ from each other', () => {
  it('open position sits lower on the neck than the smoothest path', () => {
    const low = (result) => {
      const positions = [...result.chosen.values()].map((frets) => {
        const fretted = frets.filter((f) => typeof f === 'number' && f > 0);
        return fretted.length > 0 ? Math.min(...fretted) : 0;
      });
      return positions.reduce((a, b) => a + b, 0) / positions.length;
    };
    expect(low(plan('openPosition', DOMINANTE))).toBeLessThanOrEqual(low(plan('smoothest', DOMINANTE)));
  });

  it('the choro texture is not what either of the others would pick', () => {
    const centro = shapes(plan('choroCentro', DOMINANTE));
    const smooth = shapes(plan('smoothest', DOMINANTE));
    const open = shapes(plan('openPosition', DOMINANTE));
    const differs = [...centro].filter(([k, v]) => smooth.get(k) !== v && open.get(k) !== v);
    expect(differs.length).toBeGreaterThan(centro.size / 2);
  });
});

/**
 * The six-string's part in a choro regional: it plays the centro while a
 * seven-string carries the bass line, so it takes a different inversion rather
 * than doubling what the other guitar is already playing (docs/DESIGN.md §2.10).
 */
describe('the choro centro planner', () => {
  const result = plan('choroCentro', DOMINANTE);

  it('puts its bass a third above where the other instrument is', () => {
    for (const [key, frets] of result.chosen) {
      const chord = parseChord(key, 'brazilian').chord;
      const bassPc = pitchClass(bassNote(chord));
      const fingering = fingeringFromFrets(frets, chord, guitar);
      const low = Math.min(...fingering.midis.filter((m) => m !== null));

      // A third above whichever octave the other guitar is playing in.
      const gaps = [];
      for (let bass = 35; bass <= 52; bass += 1) {
        if (((bass % 12) + 12) % 12 === bassPc && low - bass > 0) gaps.push(low - bass);
      }
      expect(gaps.some((gap) => gap === 3 || gap === 4), key).toBe(true);
    }
  });

  it('sounds four notes or five, on strings next to each other', () => {
    for (const [key, frets] of result.chosen) {
      const played = frets.map((f, i) => (f === 'x' ? -1 : i)).filter((i) => i >= 0);
      expect(played.length, key).toBeGreaterThanOrEqual(4);
      expect(played.length, key).toBeLessThanOrEqual(5);
      // Contiguous: no muted string inside the grip.
      expect(played[played.length - 1] - played[0], key).toBe(played.length - 1);
      // A thumb on the lowest or second-lowest string.
      expect(played[0], key).toBeLessThanOrEqual(1);
    }
  });

  it('stays in the first quarter of the neck', () => {
    for (const [key, frets] of result.chosen) {
      for (const fret of frets) {
        if (typeof fret === 'number') expect(fret, key).toBeLessThanOrEqual(7);
      }
    }
  });

  it('keeps the root, and drops the fifth when it drops anything', () => {
    for (const [key, frets] of result.chosen) {
      const chord = parseChord(key.replace(/\/[A-G][b#]?$/, ''), 'brazilian').chord;
      const fingering = fingeringFromFrets(frets, chord, guitar);
      const pcs = new Set(
        fingering.midis.filter((m) => m !== null).map((m) => ((m % 12) + 12) % 12)
      );
      for (const tone of chordTones(chord)) {
        if (tone.role === 'fifth') continue;
        expect(pcs.has(tone.pitchClass), `${key} is missing its ${tone.role}`).toBe(true);
      }
    }
  });

  it('makes the minor family one grip with one finger moving', () => {
    // Gm, Gm6 and Gm7 all take the same Bb underneath, because that is the
    // third above the G the other guitar is playing. So they land on the same
    // strings and differ by a single note.
    const out = plan('choroCentro', 'Gm | Gm6 | Gm7');
    const [gm, gm6, gm7] = ['Gm', 'Gm6', 'Gm7'].map((key) => out.chosen.get(key));
    const differences = (a, b) => a.filter((fret, i) => fret !== b[i]).length;
    expect(differences(gm, gm6)).toBe(1);
    expect(differences(gm, gm7)).toBe(1);
    expect(differences(gm6, gm7)).toBe(1);
  });

  it('falls back to a sixth where a third is not a chord tone', () => {
    // A third above the seventh of F7 is G, which is not in the chord. The
    // sources name that case and give the sixth as the answer.
    const out = plan('choroCentro', 'F7/Eb | Bb/F');
    expect(out.missing).toEqual([]);
    for (const [key, frets] of out.chosen) {
      const chord = parseChord(key, 'brazilian').chord;
      const fingering = fingeringFromFrets(frets, chord, guitar);
      const low = Math.min(...fingering.midis.filter((m) => m !== null));
      const bassPc = pitchClass(bassNote(chord));
      const gaps = [];
      for (let bass = 35; bass <= 52; bass += 1) {
        if (((bass % 12) + 12) % 12 === bassPc && low - bass > 0) gaps.push(low - bass);
      }
      expect(gaps.some((g) => g === 8 || g === 9), key).toBe(true);
    }
  });

  it('names the inversion it chose, so the legend can show it', () => {
    const out = plan('choroCentro', 'Gm | Cm | Dm6');
    const expected = { Gm: 'Bb', Cm: 'Eb', Dm6: 'F' };
    for (const [key, frets] of out.chosen) {
      const chord = parseChord(key, 'brazilian').chord;
      const fingering = fingeringFromFrets(frets, chord, guitar);
      expect(formatNote(voicedAs(chord, fingering.midis).bass), key).toBe(expected[key]);
    }
  });
});

describe('a planner is offered only where it makes sense', () => {
  it('keeps the choro texture off an instrument with no strings to spare', () => {
    expect(plannersFor(ukulele).map((p) => p.id)).not.toContain('choroCentro');
    expect(plannersFor(guitar).map((p) => p.id)).toContain('choroCentro');
  });

  it('offers the neck-wide planners everywhere', () => {
    for (const instrument of [guitar, ukulele]) {
      const ids = plannersFor(instrument).map((p) => p.id);
      expect(ids).toContain('smoothest');
      expect(ids).toContain('openPosition');
    }
  });

  it('works on a seven-string too, which has the strings for it', () => {
    const seven = instrumentInstance({
      catalogId: '7guitar',
      label: 'Seven',
      strings: 'B1, E2, A2, D3, G3, B3, E4',
      fretCount: 22,
    });
    expect(plannersFor(seven).map((p) => p.id)).toContain('choroCentro');
    const result = plan('choroCentro', 'Gm | C7 | F', seven);
    expect(result.missing).toEqual([]);
  });

  it('has a planner for every id it advertises', () => {
    for (const planner of PLANNERS) expect(plannerById(planner.id)).toBe(planner);
    expect(plannerById('nope')).toBe(null);
  });
});
