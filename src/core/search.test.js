import { describe, it, expect } from 'vitest';
import { parseChord } from './notation/parse.js';
import {
  instrumentInstance,
  fromCatalog,
  isReentrant,
  configFor,
} from './instrument.js';
import {
  searchFingerings,
  allFingerings,
  shorthandOf,
  fingeringFromFrets,
  positionOf,
} from './search.js';
import { handProblem } from './fingers.js';
import { pitchClass } from './pitch.js';
import { bassNote } from './chord.js';

const guitar = () =>
  instrumentInstance({
    catalogId: '6guitar',
    label: 'Guitar · Standard',
    strings: 'E2, A2, D3, G3, B3, E4',
    fretCount: 22,
  });

const ukulele = () =>
  instrumentInstance({
    catalogId: 'ukulele',
    label: 'Ukulele · Standard',
    strings: 'G4, C4, E4, A4',
    fretCount: 15,
  });

const search = (symbol, instrument, preset = 'strumming') =>
  searchFingerings(parseChord(symbol).chord, instrument, configFor(instrument, preset));

const shapes = (result) => allFingerings(result).map((f) => f.shorthand);

/** Rank of a shape in the overall ranked list, or -1. */
const rankOf = (result, shorthand) => shapes(result).indexOf(shorthand);

describe('standard guitar shapes', () => {
  // The phase 3 acceptance criteria from DESIGN.md section 10: real shapes a
  // player would recognise, not synthetic cases.
  it('finds the open C major shape and ranks it near the top', () => {
    const result = search('C', guitar());
    expect(shapes(result)).toContain('x32010');

    const open = result.groups.find((g) => g.position === 0);
    expect(open.fingerings.map((f) => f.shorthand)).toContain('x32010');
    expect(rankOf(result, 'x32010')).toBeLessThan(2);
  });

  it('finds the F major barre shape and flags the barre', () => {
    const result = search('F', guitar());
    expect(shapes(result)).toContain('133211');

    const f = allFingerings(result).find((x) => x.shorthand === '133211');
    expect(f.barre).not.toBeNull();
    expect(f.barre.fret).toBe(1);
    expect(f.barre.fromString).toBe(0);
    expect(f.barre.toString).toBe(5);
  });

  it.each([
    ['Am', 'x02210'],
    ['D', 'xx0232'],
    ['E', '022100'],
    ['G', '320003'],
    ['A', 'x02220'],
    ['Em', '022000'],
  ])('finds the standard %s shape (%s)', (symbol, shorthand) => {
    expect(shapes(search(symbol, guitar()))).toContain(shorthand);
  });

  it('assigns the expected fingers to open C', () => {
    const f = allFingerings(search('C', guitar())).find((x) => x.shorthand === 'x32010');
    // Ring on the A string, middle on the D string, index on the B string.
    expect(f.fingers).toEqual([null, 3, 2, null, 1, null]);
  });

  it('assigns the expected fingers to open D', () => {
    const f = allFingerings(search('D', guitar())).find((x) => x.shorthand === 'xx0232');
    // Index on G, ring on B, middle on the high E: the standard D shape.
    expect(f.fingers).toEqual([null, null, null, 1, 3, 2]);
  });
});

describe('re-entrant tunings', () => {
  // This is the direct regression test for the reference's strictly-ascending
  // pitch rule, which returns almost nothing on a standard ukulele (§4.3).
  it('knows a standard ukulele is re-entrant', () => {
    expect(isReentrant(ukulele())).toBe(true);
    expect(isReentrant(guitar())).toBe(false);
  });

  it.each([
    ['C', '0003'],
    ['F', '2010'],
    ['G', '0232'],
    ['Am', '2000'],
  ])('finds the standard ukulele %s shape (%s)', (symbol, shorthand) => {
    expect(shapes(search(symbol, ukulele()))).toContain(shorthand);
  });

  it('finds a useful number of shapes rather than almost none', () => {
    const result = search('C', ukulele());
    expect(result.count).toBeGreaterThan(3);
  });

  it('allows a duplicated pitch, which re-entrant chords require', () => {
    // Ukulele F is 2010: A4, C4, F4, A4. Forbidding duplicate pitches, as the
    // reference did, would reject the instrument's most common F shape.
    const f = allFingerings(search('F', ukulele())).find((x) => x.shorthand === '2010');
    expect(f).toBeDefined();
    const sounding = f.midis.filter((m) => m !== null);
    expect(new Set(sounding).size).toBeLessThan(sounding.length);
  });
});

describe('slash chords', () => {
  it('puts the requested bass note lowest, always', () => {
    const chord = parseChord('C/E').chord;
    const instrument = guitar();
    const result = searchFingerings(chord, instrument, configFor(instrument, 'strumming'));
    expect(result.count).toBeGreaterThan(0);
    const wanted = pitchClass(bassNote(chord));
    for (const f of allFingerings(result)) {
      const lowest = Math.min(...f.midis.filter((m) => m !== null));
      expect(((lowest % 12) + 12) % 12).toBe(wanted);
    }
  });
});

describe('every emitted hand is physically possible', () => {
  const cases = [
    ['C', guitar()],
    ['F', guitar()],
    ['Cmaj7#11', guitar()],
    ['G7', guitar()],
    ['Bm7b5', guitar()],
    ['C', ukulele()],
    ['F', ukulele()],
    ['D7', fromCatalog('cavaquinho')],
    ['A', fromCatalog('mandolin')],
    ['E', fromCatalog('4bass')],
  ];

  it.each(cases)('%s produces only playable hands', (symbol, instrument) => {
    const result = searchFingerings(parseChord(symbol).chord, instrument);
    for (const f of allFingerings(result)) {
      const problem = handProblem(f.frets, {
        fingers: f.fingers,
        barre: f.barre,
      });
      expect(problem, `${symbol} ${f.shorthand}: ${problem}`).toBeNull();
    }
  });

  it('never uses more than four fingers', () => {
    for (const [symbol, instrument] of cases) {
      const result = searchFingerings(parseChord(symbol).chord, instrument);
      for (const f of allFingerings(result)) {
        const used = new Set(f.fingers.filter((x) => x !== null));
        expect(used.size).toBeLessThanOrEqual(4);
      }
    }
  });

  it('never exceeds the configured span', () => {
    const instrument = guitar();
    const config = configFor(instrument, 'strumming');
    const result = searchFingerings(parseChord('Cmaj7').chord, instrument, config);
    for (const f of allFingerings(result)) {
      const fretted = f.frets.filter((x) => typeof x === 'number' && x > 0);
      if (fretted.length > 1) {
        expect(Math.max(...fretted) - Math.min(...fretted) + 1).toBeLessThanOrEqual(
          config.maxSpan
        );
      }
    }
  });
});

describe('grouping and ranking', () => {
  it('groups by lowest fretted fret, open first', () => {
    const result = search('C', guitar());
    const positions = result.groups.map((g) => g.position);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('sorts within a group by ascending difficulty', () => {
    const result = search('G', guitar());
    for (const group of result.groups) {
      const totals = group.fingerings.map((f) => f.score.total);
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
  });

  it('keeps every fingering but reports how many to show first', () => {
    // The group holds all of them so "Show more" can expand it (section 2.3);
    // displayCount is how many appear before the user asks for the rest.
    const instrument = guitar();
    const config = configFor(instrument, 'strumming');
    const result = searchFingerings(parseChord('C').chord, instrument, config);
    for (const group of result.groups) {
      expect(group.displayCount).toBeLessThanOrEqual(config.maxResultsPerGroup);
      expect(group.displayCount).toBeLessThanOrEqual(group.fingerings.length);
    }
  });

  it('labels difficulty with a word, never a bare number', () => {
    for (const f of allFingerings(search('C', guitar()))) {
      expect(['easy', 'medium', 'hard']).toContain(f.difficulty);
    }
  });
});

describe('strumming and fingerstyle', () => {
  it('differ by whether a chord may have a hole in it', () => {
    // The one rule the distinction rests on. A strumming hand crosses every
    // string between the lowest and the highest; a picking hand can leave one
    // out, so it can play shapes the other cannot reach.
    const strumming = search('Gm', guitar(), 'strumming');
    const fingerstyle = search('Gm', guitar(), 'fingerstyle');

    expect(shapes(strumming)).not.toContain('3x0333');
    expect(shapes(fingerstyle)).toContain('3x0333');
    expect(fingerstyle.count).toBeGreaterThan(strumming.count);
  });

  it('offers the fingerstyle G minor before anything else in open position', () => {
    const result = search('Gm', guitar(), 'fingerstyle');
    expect(result.groups[0].fingerings[0].shorthand).toBe('3x0333');
  });

  it('agree on everything else', () => {
    const strumming = configFor(guitar(), 'strumming');
    const fingerstyle = configFor(guitar(), 'fingerstyle');
    const differences = Object.keys(strumming).filter(
      (key) => key !== 'preset' && key !== 'weights' && strumming[key] !== fingerstyle[key]
    );
    expect(differences).toEqual(['allowInnerMutes']);
    expect(fingerstyle.weights).toEqual(strumming.weights);
  });
});

describe('heuristics change the results', () => {
  it('finds no barre shapes for a beginner', () => {
    const result = search('F', guitar(), 'beginner');
    for (const f of allFingerings(result)) {
      expect(f.barre).toBeNull();
    }
  });

  it('allows rootless voicings only in the jazz preset', () => {
    const standard = search('Cmaj7', guitar(), 'strumming');
    for (const f of allFingerings(standard)) {
      expect(f.omittedRoles).not.toContain('root');
    }
    const jazz = search('Cmaj7', guitar(), 'jazz');
    expect(jazz.count).toBeGreaterThan(standard.count);
  });

  it('never omits an altered fifth, even when omitting fifths is allowed', () => {
    // Dropping the #5 from an augmented chord leaves a chord that is not the
    // one that was asked for.
    const chord = parseChord('C+').chord;
    const instrument = guitar();
    const result = searchFingerings(chord, instrument, configFor(instrument, 'strumming'));
    expect(result.count).toBeGreaterThan(0);
    for (const f of allFingerings(result)) {
      const pcs = new Set(f.midis.filter((m) => m !== null).map((m) => ((m % 12) + 12) % 12));
      expect(pcs.has(8)).toBe(true); // G#, the raised fifth of C
    }
  });
});

describe('a muted string has to be forced', () => {
  const withInnerMutes = (symbol, instrument) => search(symbol, instrument, 'fingerstyle');

  it('mutes the D string of a G minor only when it cannot ring', () => {
    // 3xx333 and 3x0333 are the same hand. The first damps a D string that
    // would have sounded a D, which the chord wants; the second lets it ring.
    // Nobody plays the first, and the app should not offer it.
    const result = withInnerMutes('Gm', guitar());
    expect(shapes(result)).toContain('3x0333');
    expect(shapes(result)).not.toContain('3xx333');

    // The A string is a different matter: it can sound nothing belonging to G
    // minor without the hand leaving the shape, so damping it is forced.
    const kept = allFingerings(result).find((f) => f.shorthand === '3x0333');
    expect(kept.frets[1]).toBe('x');
  });

  it('never mutes a string that could have rung open', () => {
    // The invariant behind the rule: at the default weights an open string
    // costs no finger and nothing else, so a shape and the same shape with one
    // of its open strings damped can never both be worth showing. Only a fill
    // that renames the bass is exempt, so the comparison is limited to shapes
    // whose lowest note agrees.
    for (const symbol of ['C', 'D', 'G', 'Am', 'F', 'B7', 'Cmaj7', 'Gm']) {
      const result = withInnerMutes(symbol, guitar());
      const emitted = allFingerings(result);
      const byFrets = new Map(emitted.map((f) => [f.frets.join(' '), f]));

      for (const f of emitted) {
        const bassOf = (x) => Math.min(...x.midis.filter((m) => m !== null)) % 12;
        for (let i = 0; i < f.frets.length; i += 1) {
          if (f.frets[i] !== 'x') continue;
          const rung = f.frets.slice();
          rung[i] = 0;
          const fuller = byFrets.get(rung.join(' '));
          if (!fuller || bassOf(fuller) !== bassOf(f)) continue;
          throw new Error(`${symbol}: ${f.shorthand} damps an open string that ${fuller.shorthand} rings`);
        }
      }
    }
  });

  it('drops a fragment the fuller shape covers for free', () => {
    // x320xx is open C with the top two strings damped for nothing.
    const result = search('C', guitar());
    expect(shapes(result)).toContain('x32010');
    expect(shapes(result)).not.toContain('x320xx');
    expect(shapes(result)).not.toContain('x3201x');
  });

  it('drops a fragment whose fingers go down easily', () => {
    // x3x0x0 sounds C, E and G and is easier than open C by every measure the
    // app has: one finger, three open strings. It is still a fragment of a
    // chord two ordinary fingers away, and not worth offering beside it.
    const result = search('C', guitar(), 'fingerstyle');
    expect(shapes(result)).toContain('x32010');
    expect(shapes(result)).not.toContain('x3x0x0');
    expect(shapes(result)).not.toContain('x320xx');
    expect(shapes(result)).not.toContain('x3201x');
  });

  it('keeps an open shape when filling it means reaching', () => {
    // Every mute can be filled somewhere: fretting the A string at the fifth
    // turns xx0232 into x50232. That is not a reason to stop offering the open
    // D chord. Fingers are free, a reach is not — x50232 spans four frets where
    // the open D spans two, and nobody plays it.
    const result = search('D', guitar(), 'fingerstyle');
    const found = shapes(result);
    expect(found).toContain('xx0232');
    expect(found).toContain('x50232');
  });

  it('keeps a small shape when filling it means barring', () => {
    // xx3211 is the F beginners actually play. Filling its two muted strings
    // gives the full barre, which is not the same hand doing a little more.
    const result = search('F', guitar(), 'fingerstyle');
    expect(shapes(result)).toContain('xx3211');
    expect(shapes(result)).toContain('133211');
  });

  it('keeps an inversion whose bass the fuller shape would rename', () => {
    // 002210 is not A minor with a fuller voicing, it is A minor over E. Where
    // the rules admit both, muting the low string is a real choice.
    const result = search('Am', guitar(), 'jazz');
    expect(shapes(result)).toContain('x02210');
    expect(shapes(result)).toContain('002210');
  });

  it('leaves the standard open shapes alone', () => {
    // The rule is aggressive, so this is the guard on it: the shapes every
    // player knows all survive.
    const cases = [
      ['C', 'x32010'],
      ['D', 'xx0232'],
      ['E', '022100'],
      ['G', '320003'],
      ['A', 'x02220'],
      ['Am', 'x02210'],
      ['Dm', 'xx0231'],
      ['F', '133211'],
      ['B7', 'x21202'],
      ['Cmaj7', 'x32000'],
    ];
    for (const [symbol, shorthand] of cases) {
      expect(shapes(withInnerMutes(symbol, guitar()))).toContain(shorthand);
    }
    expect(shapes(search('C', ukulele()))).toContain('0003');
    expect(shapes(search('F', ukulele()))).toContain('2010');
  });

  it('still rebuilds a shape somebody saved', () => {
    // The search declines to offer 3xx333; a user who wrote it down still gets
    // it back, because a stored pattern is rebuilt, not re-searched (§8.2).
    const instrument = guitar();
    const saved = fingeringFromFrets(
      [3, 'x', 'x', 3, 3, 3],
      parseChord('Gm').chord,
      instrument,
      configFor(instrument, 'fingerstyle')
    );
    expect(saved).not.toBeNull();
    expect(saved.shorthand).toBe('3xx333');
  });
});

describe('an inner mute is not a difficulty', () => {
  it('costs nothing by default', () => {
    // A mute that survives the search is a forced one, and a string you simply
    // do not pick is free. Charging for it double-counted.
    const result = search('Gm', guitar(), 'fingerstyle');
    const f = allFingerings(result).find((x) => x.shorthand === '3x0333');
    expect(f.frets[1]).toBe('x');
    expect(f.score.parts.innerMutes).toBe(0);
  });

  it('can be priced back in by a strummer', () => {
    // The weight stays in the panel, so someone whose picking hand has to cross
    // the gap can make it cost again.
    const instrument = guitar();
    const config = configFor(instrument, 'fingerstyle');
    const plain = allFingerings(searchFingerings(parseChord('Gm').chord, instrument, config)).find(
      (f) => f.shorthand === '3x0333'
    );
    const strummed = allFingerings(
      searchFingerings(parseChord('Gm').chord, instrument, {
        ...config,
        weights: { ...config.weights, innerMute: 3.0 },
      })
    ).find((f) => f.shorthand === '3x0333');

    expect(strummed.score.parts.innerMutes).toBe(3.0);
    expect(strummed.score.total).toBeGreaterThan(plain.score.total);
  });
});

describe('impossible requests come back empty, not wrong', () => {
  it('finds nothing for a chord with more notes than the instrument has strings', () => {
    const result = search('C13#11', ukulele());
    expect(result.count).toBe(0);
    expect(result.groups).toEqual([]);
  });
});

describe('performance', () => {
  it('stays within the node budget on a six-string search', () => {
    const instrument = guitar();
    const result = searchFingerings(
      parseChord('Cmaj7').chord,
      instrument,
      configFor(instrument, 'strumming'),
      { windowBudget: 20000 }
    );
    expect(result.nodesExhausted).toBe(false);
    expect(result.count).toBeGreaterThan(0);
  });

  it('still covers the open position when the budget is tight', () => {
    // The budget is per window and windows run from the nut outward, so
    // truncation costs the high voicings, not the open ones that score best.
    const instrument = guitar();
    const tight = searchFingerings(
      parseChord('C').chord,
      instrument,
      configFor(instrument, 'strumming'),
      { windowBudget: 400 }
    );
    expect(tight.nodesExhausted).toBe(true);
    expect(shapes(tight)).toContain('x32010');
  });
});

describe('shorthand stays readable', () => {
  it('runs single-digit frets together, as players write them', () => {
    expect(shorthandOf(['x', 3, 2, 0, 1, 0])).toBe('x32010');
    expect(shorthandOf([1, 3, 3, 2, 1, 1])).toBe('133211');
  });

  it('hyphenates once any fret reaches double digits', () => {
    // [8,10,10,0,8,0] run together would read as "81010080".
    expect(shorthandOf([8, 10, 10, 0, 8, 0])).toBe('8-10-10-0-8-0');
    expect(shorthandOf(['x', 12, 14, 14, 'x', 'x'])).toBe('x-12-14-14-x-x');
  });
});

describe('rebuilding a fingering from stored frets', () => {
  it('refuses a pattern with the wrong number of strings', () => {
    // A guitar shape on a ukulele would index past the tuning and throw.
    const chord = parseChord('C').chord;
    const uke = instrumentInstance({ catalogId: 'ukulele', strings: 'G4, C4, E4, A4' });
    expect(() => fingeringFromFrets(['x', 3, 2, 0, 1, 0], chord, uke)).not.toThrow();
    expect(fingeringFromFrets(['x', 3, 2, 0, 1, 0], chord, uke)).toBeNull();
    expect(fingeringFromFrets([0, 0, 0, 3], chord, uke)).not.toBeNull();
  });

  it('refuses rubbish', () => {
    const chord = parseChord('C').chord;
    const guitar = instrumentInstance({ catalogId: '6guitar', strings: 'E2, A2, D3, G3, B3, E4' });
    expect(fingeringFromFrets(null, chord, guitar)).toBeNull();
    expect(fingeringFromFrets([], chord, guitar)).toBeNull();
  });
});

describe('position is where the hand is', () => {
  const hand = (frets) => ({
    lowestFret: Math.min(...frets.filter((f) => typeof f === 'number' && f > 0)),
  });
  const pos = (frets) => positionOf(frets, hand(frets));

  it('calls the textbook open chords open', () => {
    expect(pos(['x', 3, 2, 0, 1, 0])).toBe(0); // C
    expect(pos([3, 2, 0, 0, 0, 3])).toBe(0); // G
    expect(pos(['x', 'x', 0, 2, 3, 2])).toBe(0); // D
    expect(pos([0, 2, 2, 1, 0, 0])).toBe(0); // E
  });

  it('does not call a barre at the nut open', () => {
    // No open strings: the hand is doing something different from an open
    // chord, even though it sits at fret 1.
    expect(pos([1, 3, 3, 2, 1, 1])).toBe(1);
  });

  it('files a high shape by where the hand is, even with a string ringing open', () => {
    // The complaint that prompted this: an open string is incidental to a hand
    // sitting at the twelfth fret.
    expect(pos(['x', 'x', 12, 13, 0, 13])).toBe(12);
    expect(pos(['x', 0, 'x', 5, 5, 0])).toBe(5);
  });

  it('draws the line at the fourth fret', () => {
    expect(pos([0, 0, 4, 4, 4, 'x'])).toBe(0);
    expect(pos([0, 0, 5, 5, 5, 'x'])).toBe(5);
  });

  it('keeps a high open-string shape out of the open group in a real search', () => {
    const instrument = guitar();
    const result = searchFingerings(parseChord('B°').chord, instrument);
    const open = result.groups.find((g) => g.position === 0);
    for (const f of open?.fingerings ?? []) {
      const fretted = f.frets.filter((x) => typeof x === 'number' && x > 0);
      expect(Math.max(...fretted), f.shorthand).toBeLessThanOrEqual(4);
    }
    const high = allFingerings(result).find((f) => f.shorthand === 'x-x-12-13-0-13');
    if (high) expect(high.position).toBe(12);
  });
});
