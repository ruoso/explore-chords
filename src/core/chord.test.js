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
