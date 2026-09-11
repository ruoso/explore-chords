import { describe, it, expect } from 'vitest';
import { parseNote, formatNote } from './pitch.js';
import {
  chord,
  chordTones,
  chordPitchClasses,
  roleForDegree,
  bassNote,
  hasDistinctBass,
  describeChordTones,
  sameChord,
  voicedAs,
  QUALITIES,
} from './chord.js';

const n = parseNote;
const spell = (c) => describeChordTones(c);

describe('triads spell correctly', () => {
  // The headline acceptance criterion from DESIGN.md section 10, phase 1.
  it('spells Db major as Db F Ab, never C# F G#', () => {
    expect(spell(chord(n('Db'), 'major'))).toBe('Db F Ab');
  });

  it.each([
    ['C', 'major', 'C E G'],
    ['G', 'major', 'G B D'],
    ['F#', 'major', 'F# A# C#'],
    ['Bb', 'major', 'Bb D F'],
    ['A', 'minor', 'A C E'],
    ['C', 'minor', 'C Eb G'],
    ['F#', 'minor', 'F# A C#'],
    ['B', 'dim', 'B D F'],
    ['C', 'dim', 'C Eb Gb'],
    ['C', 'aug', 'C E G#'],
    ['C', 'sus2', 'C D G'],
    ['C', 'sus4', 'C F G'],
    ['C', 'power', 'C G'],
  ])('%s %s is %s', (root, quality, expected) => {
    expect(spell(chord(n(root), quality))).toBe(expected);
  });

  it('rejects an unknown quality', () => {
    expect(() => chord(n('C'), 'wobbly')).toThrow(/quality/i);
  });
});

describe('extensions', () => {
  it('adds a major 7th', () => {
    expect(spell(chord(n('C'), 'major', [{ degree: 7 }]))).toBe('C E G B');
  });

  it('adds a dominant 7th', () => {
    expect(spell(chord(n('C'), 'major', [{ degree: 7, alter: -1 }]))).toBe('C E G Bb');
  });

  it('spells a #11 as F# on C', () => {
    const c = chord(n('C'), 'major', [{ degree: 7 }, { degree: 11, alter: 1 }]);
    expect(spell(c)).toBe('C E G B F#');
  });

  it('replaces a base tone of the same degree rather than doubling it', () => {
    // m7b5 must alter the fifth, not sound a natural G and a Gb at once.
    const c = chord(n('C'), 'minor', [
      { degree: 5, alter: -1 },
      { degree: 7, alter: -1 },
    ]);
    expect(spell(c)).toBe('C Eb Gb Bb');
    expect(chordTones(c).filter((t) => t.degree === 5)).toHaveLength(1);
  });

  it('orders tones by degree regardless of input order', () => {
    const c = chord(n('C'), 'major', [
      { degree: 13 },
      { degree: 7, alter: -1 },
      { degree: 9 },
    ]);
    expect(chordTones(c).map((t) => t.degree)).toEqual([1, 3, 5, 7, 9, 13]);
  });

  it('rejects malformed extensions', () => {
    expect(() => chord(n('C'), 'major', [{ degree: 0 }])).toThrow();
    expect(() => chord(n('C'), 'major', [{ degree: 7, alter: 9 }])).toThrow();
  });
});

describe('tone roles', () => {
  it.each([
    [1, 'root'],
    [3, 'third'],
    [5, 'fifth'],
    [7, 'seventh'],
    [9, 'extension'],
    [11, 'extension'],
    [13, 'extension'],
  ])('degree %i has role %s', (degree, role) => {
    expect(roleForDegree(degree)).toBe(role);
  });

  it('tags every tone of a complex chord', () => {
    const c = chord(n('C'), 'major', [
      { degree: 7 },
      { degree: 9 },
      { degree: 11, alter: 1 },
    ]);
    expect(chordTones(c).map((t) => t.role)).toEqual([
      'root',
      'third',
      'fifth',
      'seventh',
      'extension',
      'extension',
    ]);
  });

  it('gives sus chords no third, so the "3rd required" rule is vacuous', () => {
    for (const quality of ['sus2', 'sus4', 'power']) {
      const roles = chordTones(chord(n('C'), quality)).map((t) => t.role);
      expect(roles).not.toContain('third');
    }
  });
});

describe('pitch classes', () => {
  it('collects the distinct sounds of a chord', () => {
    expect([...chordPitchClasses(chord(n('C'), 'major'))].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('collapses tones that are enharmonically the same sound', () => {
    // A b5 and a #11 are spelled differently but sound alike; the search
    // matches on sound, so the set must not double-count them.
    const c = chord(n('C'), 'major', [{ degree: 5, alter: -1 }, { degree: 11, alter: 1 }]);
    // Four tones: root, third, flat fifth (replacing the fifth), sharp
    // eleventh. But Gb and F# are one sound, so only three pitch classes.
    expect(chordTones(c).map((t) => t.degree)).toEqual([1, 3, 5, 11]);
    expect(chordPitchClasses(c).size).toBe(3);
  });
});

describe('slash chords', () => {
  it('reports the bass note, defaulting to the root', () => {
    expect(formatNote(bassNote(chord(n('C'), 'major')))).toBe('C');
    expect(formatNote(bassNote(chord(n('C'), 'major', [], n('E'))))).toBe('E');
  });

  it('knows when the bass is genuinely distinct', () => {
    expect(hasDistinctBass(chord(n('C'), 'major'))).toBe(false);
    expect(hasDistinctBass(chord(n('C'), 'major', [], n('C')))).toBe(false);
    expect(hasDistinctBass(chord(n('C'), 'major', [], n('E')))).toBe(true);
  });
});

describe('sameChord', () => {
  it('ignores extension ordering', () => {
    const a = chord(n('C'), 'major', [{ degree: 7 }, { degree: 9 }]);
    const b = chord(n('C'), 'major', [{ degree: 9 }, { degree: 7 }]);
    expect(sameChord(a, b)).toBe(true);
  });

  it('distinguishes spelling, quality, extensions and bass', () => {
    const base = chord(n('C'), 'major', [{ degree: 7 }]);
    expect(sameChord(base, chord(n('C'), 'minor', [{ degree: 7 }]))).toBe(false);
    expect(sameChord(base, chord(n('C'), 'major', [{ degree: 7, alter: -1 }]))).toBe(false);
    expect(sameChord(base, chord(n('C'), 'major', [{ degree: 7 }], n('E')))).toBe(false);
    // Enharmonic roots are different chords, because spelling is meaningful.
    expect(sameChord(chord(n('Db')), chord(n('C#')))).toBe(false);
  });
});

describe('every declared quality is usable', () => {
  it.each(Object.keys(QUALITIES))('%s builds and spells', (quality) => {
    const tones = chordTones(chord(n('C'), quality));
    expect(tones.length).toBeGreaterThanOrEqual(2);
    expect(tones[0].role).toBe('root');
    for (const t of tones) {
      expect(t.pitchClass).toBeGreaterThanOrEqual(0);
      expect(t.pitchClass).toBeLessThan(12);
    }
  });
});

/**
 * The symbol says what the harmony is; the shape says what you hear. When
 * another instrument has the bass, the difference between them is the
 * arrangement (docs/DESIGN.md §6.2).
 */
describe('what a shape sounds, as against what the symbol says', () => {
  // Midi numbers per string, low to high, null where a string is muted.
  const gm7 = chord(n('G'), 'minor', [{ degree: 7, alter: -1 }]);

  it('says nothing when the bass is the root', () => {
    // G on the low E string at fret 3, so the shape sounds what it is called.
    const v = voicedAs(chord(n('G')), [43, 47, 50, 55, 59, 67]);
    expect(v.asWritten).toBe(true);
    expect(v.rootless).toBe(false);
    expect(formatNote(v.bass)).toBe('G');
  });

  it('says nothing when a slash chord puts its own bass lowest', () => {
    // C/E asked for E underneath and got it. Comparing against the root instead
    // would label every slash chord with the bass it was told to play.
    const v = voicedAs(chord(n('C'), 'major', [], n('E')), [null, null, 52, 57, 60, 64]);
    expect(v.asWritten).toBe(true);
    expect(formatNote(v.bass)).toBe('E');
  });

  it('names the bass of an inversion', () => {
    // Bb D G D: the third underneath, which is how a six-string sits under a
    // seven-string playing the G.
    const v = voicedAs(gm7, [null, 46, 50, 55, 62, null]);
    expect(v.asWritten).toBe(false);
    expect(formatNote(v.bass)).toBe('Bb');
  });

  it('reports a missing root', () => {
    // Bb D F Bb — a Gm7 with no G in it at all.
    const v = voicedAs(gm7, [null, null, 58, 62, 65, 70]);
    expect(v.rootless).toBe(true);
    expect(formatNote(v.bass)).toBe('Bb');
  });

  it('spells the bass from the chord, not from a pitch-class table', () => {
    // The seventh of Db7 is Cb. Spelled off a table of flats it would come back
    // as B, which is the same sound and the wrong note.
    const db7 = chord(n('Db'), 'major', [{ degree: 7, alter: -1 }]);
    expect(formatNote(voicedAs(db7, [null, null, 47, 53, 56, 61]).bass)).toBe('Cb');
    // And the third of E7 is G#, not Ab.
    const e7 = chord(n('E'), 'major', [{ degree: 7, alter: -1 }]);
    expect(formatNote(voicedAs(e7, [44, 50, 52, 59, null, null]).bass)).toBe('G#');
    // A major's third is C#, even though the shape is full of flats elsewhere.
    expect(formatNote(voicedAs(chord(n('A')), [null, 49, 52, 57, 61, null]).bass)).toBe('C#');
  });

  it('falls back to the chord\'s own accidental for a foreign bass', () => {
    // Someone wrote a voicing with a note the chord does not contain. There is
    // no functional spelling to borrow, so a flat chord keeps flats.
    const bb = chord(n('Bb'));
    expect(formatNote(voicedAs(bb, [null, null, 51, 58, 62, null]).bass)).toBe('Eb');
    const a = chord(n('A'));
    expect(formatNote(voicedAs(a, [null, null, 51, 57, 61, null]).bass)).toBe('D#');
  });

  it('has nothing to say about a shape that sounds nothing', () => {
    expect(voicedAs(chord(n('G')), [null, null, null, null, null, null])).toBe(null);
    expect(voicedAs(chord(n('G')), undefined)).toBe(null);
  });
});
