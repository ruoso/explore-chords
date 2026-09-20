import { describe, it, expect } from 'vitest';
import { parseSong } from '../song.js';
import { parseChord } from '../notation/parse.js';
import { chordTones, bassNote, voicedAs } from '../chord.js';
import { pitchClass, formatNote } from '../pitch.js';
import { fromCatalog, instrumentInstance } from '../instrument.js';
import { fingeringFromFrets } from '../search.js';
import { shorthandOf } from '../fretstring.js';
import { PLANNERS, plannerById, plannersFor, optionDefaults, planVoicings } from './index.js';
import { centroCandidates } from './candidates.js';

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

const plan = (id, text, instrument = guitar, choices) =>
  planVoicings(id, parseSong(text, 'brazilian'), instrument, { dialect: 'brazilian', choices });

/**
 * A plan is per bar; most of what we want to assert is per chord. This is the
 * reconciliation the caller does for real, done crudely for a test.
 */
const byKey = (result) => {
  const out = new Map();
  for (const [at, frets] of result.shapes) out.set(result.reading.line[at].ref.key, frets);
  return out;
};

const shapes = (result) => new Map([...byKey(result)].map(([k, f]) => [k, shorthandOf(f)]));

describe('planning a whole song at once', () => {
  it('gives a shape to every bar, not to every chord', () => {
    // Gm is in four bars and Dm in six. A plan speaks per bar; what collapses
    // them back into one voicing each is the text, afterwards.
    const result = plan('smoothest', DOMINANTE);
    const song = parseSong(DOMINANTE, 'brazilian');
    expect(result.shapes.size).toBe(song.occurrences.length);
    expect(byKey(result).size).toBe(14);
    expect(result.missing).toEqual([]);
  });

  it('keeps a chord to one shape where nothing asks it to differ', () => {
    const result = plan('smoothest', DOMINANTE);
    const perKey = new Map();
    for (const [at, frets] of result.shapes) {
      const key = result.reading.line[at].ref.key;
      if (!perKey.has(key)) perKey.set(key, new Set());
      perKey.get(key).add(shorthandOf(frets));
    }
    for (const [key, distinct] of perKey) expect(distinct.size, key).toBe(1);
  });

  it('refuses a planner it does not have', () => {
    expect(() => plan('mystery', 'C | G')).toThrow(/Unknown planner/);
  });

  it('skips a chord nothing can parse rather than failing the song', () => {
    const result = plan('smoothest', 'C | Zq9 | G');
    expect([...byKey(result).keys()]).toEqual(['C', 'G']);
  });

  it('says which shapes the song already had', () => {
    const first = plan('smoothest', DOMINANTE);
    const again = planVoicings('smoothest', parseSong(DOMINANTE, 'brazilian'), guitar, {
      dialect: 'brazilian',
      existing: byKey(first),
    });
    expect(again.unchanged.length).toBe(again.shapes.size);
  });

  it('gives every chord a playable shape, whichever planner', () => {
    for (const planner of PLANNERS) {
      const result = plan(planner.id, DOMINANTE);
      expect(result.missing, planner.id).toEqual([]);
      for (const [key, frets] of byKey(result)) {
        const chord = parseChord(key.replace(/\/[A-G][b#]?$/, ''), 'brazilian').chord;
        expect(fingeringFromFrets(frets, chord, guitar), `${planner.id} ${key}`).toBeTruthy();
      }
    }
  });
});

describe('the planners differ from each other', () => {
  it('open position sits lower on the neck than the smoothest path', () => {
    const low = (result) => {
      const positions = [...byKey(result).values()].map((frets) => {
        const fretted = frets.filter((f) => typeof f === 'number' && f > 0);
        return fretted.length > 0 ? Math.min(...fretted) : 0;
      });
      return positions.reduce((a, b) => a + b, 0) / positions.length;
    };
    expect(low(plan('openPosition', DOMINANTE))).toBeLessThanOrEqual(
      low(plan('smoothest', DOMINANTE))
    );
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
    for (const [key, frets] of byKey(result)) {
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
    for (const [key, frets] of byKey(result)) {
      const played = frets.map((f, i) => (f === 'x' ? -1 : i)).filter((i) => i >= 0);
      // Contiguous either way: no muted string inside the grip.
      expect(played[played.length - 1] - played[0], key).toBe(played.length - 1);
      if (played.length === 3) {
        // The idiom's other texture: the thumb up on the fourth string.
        expect(played[0], key).toBe(2);
      } else {
        expect(played.length, key).toBeGreaterThanOrEqual(4);
        expect(played.length, key).toBeLessThanOrEqual(5);
        // A thumb on the lowest or second-lowest string.
        expect(played[0], key).toBeLessThanOrEqual(1);
      }
    }
  });

  it('plays a dominant as three notes where the grip sits on the fourth string', () => {
    // The idiom's other texture (p.128-129): with the bass up on the fourth
    // string the low string goes, and what is lost is a root or a fifth. The
    // tritone has to sound, which is the whole reason it costs nothing.
    const out = plan('choroCentro', 'Eb | Bb7/Ab | Eb');
    const frets = byKey(out).get('Bb7/Ab');
    expect(frets.map((f, i) => (f === 'x' ? -1 : i)).filter((i) => i >= 0)).toEqual([2, 3, 4]);

    const chord = parseChord('Bb7/Ab', 'brazilian').chord;
    const fingering = fingeringFromFrets(frets, chord, guitar);
    const pcs = new Set(fingering.midis.filter((m) => m !== null).map((m) => ((m % 12) + 12) % 12));
    for (const tone of chordTones(chord)) {
      if (tone.role === 'third' || tone.role === 'seventh') {
        expect(pcs.has(tone.pitchClass), `no ${tone.role}, so no tritone`).toBe(true);
      }
    }
  });

  it('will not thin a chord that has no seventh to make a tritone with', () => {
    // The sources give the three-note texture for dominants, and the reason
    // they give is the tritone. A triad has none to keep.
    for (const symbol of ['C', 'F', 'Gm', 'Eb']) {
      const chord = parseChord(symbol, 'brazilian').chord;
      const all = centroCandidates(chord, guitar, { bassPc: pitchClass(bassNote(chord)) });
      for (const candidate of all) {
        expect(candidate.fingering.midis.filter((m) => m !== null).length, symbol).toBeGreaterThan(3);
      }
    }
  });

  it('stays in the first quarter of the neck', () => {
    for (const [key, frets] of byKey(result)) {
      for (const fret of frets) {
        if (typeof fret === 'number') expect(fret, key).toBeLessThanOrEqual(7);
      }
    }
  });

  it('keeps the root, and drops the fifth when it drops anything', () => {
    for (const [key, frets] of byKey(result)) {
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

  it('keeps an altered fifth, which is not the note the idiom drops', () => {
    // F#° is F#-A-C-Eb. Dropping the C left A-F#-A-Eb: four strings, no
    // tritone, and one of them spent doubling the third.
    const out = plan('choroCentro', 'F | F#°');
    const chord = parseChord('F#°', 'brazilian').chord;
    const fingering = fingeringFromFrets(byKey(out).get('F#°'), chord, guitar);
    const pcs = new Set(fingering.midis.filter((m) => m !== null).map((m) => ((m % 12) + 12) % 12));
    for (const tone of chordTones(chord)) {
      expect(pcs.has(tone.pitchClass), `F#° is missing its ${tone.role}`).toBe(true);
    }
  });

  it('makes the minor family one grip with one finger moving', () => {
    // Gm, Gm6 and Gm7 all take the same Bb underneath, because that is the
    // third above the G the other guitar is playing. So they land on the same
    // strings and differ by a single note.
    const out = byKey(plan('choroCentro', 'Gm | Gm6 | Gm7'));
    const [gm, gm6, gm7] = ['Gm', 'Gm6', 'Gm7'].map((key) => out.get(key));
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
    for (const [key, frets] of byKey(out)) {
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
    const out = byKey(plan('choroCentro', 'Gm | Cm | Dm6'));
    const expected = { Gm: 'Bb', Cm: 'Eb', Dm6: 'F' };
    for (const [key, frets] of out) {
      const chord = parseChord(key, 'brazilian').chord;
      const fingering = fingeringFromFrets(frets, chord, guitar);
      expect(formatNote(voicedAs(chord, fingering.midis).bass), key).toBe(expected[key]);
    }
  });

  it('drops below where nothing above the other guitar will do', () => {
    // C7/Bb heading to a major chord. The third above Bb is Db or D, neither in
    // C7; the sixth and the octave land where the thumb cannot reach. The
    // sources give this case a third *below* — resting on the fifth, C7/G —
    // and name the recording it comes from (§2.10).
    const out = plan('choroCentro', 'C7/Bb | F');
    expect(out.missing).toEqual([]);
    const chord = parseChord('C7/Bb', 'brazilian').chord;
    const fingering = fingeringFromFrets(byKey(out).get('C7/Bb'), chord, guitar);
    const low = Math.min(...fingering.midis.filter((m) => m !== null));
    // G below the Bb the other guitar is on, not the G a sixth above it.
    expect(formatNote(voicedAs(chord, fingering.midis).bass)).toBe('G');
    expect(low).toBeLessThan(46);
  });
});

/**
 * A stylistic question has no right answer, only a preference, so the planner
 * declares it and the player decides (docs/DESIGN.md §2.10).
 */
describe('stylistic choices', () => {
  const WALK = 'F | F#° | Gm';

  it('answers an unasked question with the default', () => {
    const centro = plannerById('choroCentro');
    expect(optionDefaults(centro)).toEqual({ whenThirdRepeats: 'repeat' });
    expect(shapes(plan('choroCentro', WALK))).toEqual(
      shapes(plan('choroCentro', WALK, guitar, { whenThirdRepeats: 'repeat' }))
    );
  });

  it('repeats the third by default, because the sources defend it', () => {
    // Under F and F#° the other guitar walks F to F#, and A is the only chord
    // tone a third above either, so the centro sits on A twice.
    const out = byKey(plan('choroCentro', WALK));
    const lows = ['F', 'F#°'].map((key) => {
      const chord = parseChord(key, 'brazilian').chord;
      const fingering = fingeringFromFrets(out.get(key), chord, guitar);
      return Math.min(...fingering.midis.filter((m) => m !== null)) % 12;
    });
    expect(lows[0]).toBe(lows[1]);
  });

  it('drops to a third below instead when asked to', () => {
    // G walks to G# to A, and B is a third above both G and G#, so the centro
    // would sit on B twice. Asked to, it takes F underneath the G#° instead.
    const run = 'G | G#\u00b0 | Am';
    const repeated = shapes(plan('choroCentro', run));
    const dropped = shapes(plan('choroCentro', run, guitar, { whenThirdRepeats: 'thirdBelow' }));
    expect(dropped.get('G#\u00b0')).not.toBe(repeated.get('G#\u00b0'));
    // Only where the third would have repeated. The first chord of the run has
    // nothing before it, and by the third the bass has moved on.
    expect(dropped.get('G')).toBe(repeated.get('G'));
    expect(dropped.get('Am')).toBe(repeated.get('Am'));
  });

  it('leaves the third alone where it does not repeat', () => {
    // Dm-D#°-Em walks too, but the centro's own line moves with it: F, F#, G.
    // Nothing repeats, so there is nothing for the preference to answer.
    const run = 'Dm | D#\u00b0 | Em';
    expect(shapes(plan('choroCentro', run, guitar, { whenThirdRepeats: 'thirdBelow' }))).toEqual(
      shapes(plan('choroCentro', run))
    );
  });

  it('leaves a chord alone where the bass is not walking', () => {
    // A leap, so the option has nothing to answer to.
    const leap = 'C | Ab | C';
    expect(shapes(plan('choroCentro', leap, guitar, { whenThirdRepeats: 'thirdBelow' }))).toEqual(
      shapes(plan('choroCentro', leap))
    );
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
