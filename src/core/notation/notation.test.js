import { describe, it, expect } from 'vitest';
import { parseNote } from '../pitch.js';
import { chord, describeChordTones, sameChord } from '../chord.js';
import { parseChord } from './parse.js';
import { formatChord } from './format.js';
import { DIALECT_IDS } from './dialects.js';

const n = parseNote;
/** Parse and return the tones, for readable assertions. */
const tones = (text, dialect) => {
  const r = parseChord(text, dialect);
  if (!r.chord) throw new Error(`failed to parse ${text}: ${r.errors[0]?.message}`);
  return describeChordTones(r.chord);
};

describe('the same chord across dialects', () => {
  // Acceptance criterion: C7M, Cmaj7 and C∆7 are one chord.
  it('parses a major 7th written four ways to the same chord', () => {
    const forms = ['C7M', 'Cmaj7', 'C∆7', 'CM7'];
    const parsed = forms.map((f) => parseChord(f).chord);
    for (const c of parsed) expect(c).not.toBeNull();
    for (const c of parsed) expect(sameChord(c, parsed[0])).toBe(true);
    expect(describeChordTones(parsed[0])).toBe('C E G B');
  });

  it('parses minor written four ways to the same chord', () => {
    const forms = ['Cm7', 'Cmin7', 'C−7', 'C-7'];
    const parsed = forms.map((f) => parseChord(f).chord);
    for (const c of parsed) expect(sameChord(c, parsed[0])).toBe(true);
    expect(describeChordTones(parsed[0])).toBe('C Eb G Bb');
  });

  it('parses half-diminished written three ways to the same chord', () => {
    const forms = ['Cm7b5', 'Cø7', 'Cm7(5-)'];
    const parsed = forms.map((f) => parseChord(f).chord);
    for (const c of parsed) expect(sameChord(c, parsed[0])).toBe(true);
    expect(describeChordTones(parsed[0])).toBe('C Eb Gb Bb');
  });

  it('parses diminished sevenths written three ways', () => {
    for (const form of ['Cdim7', 'C°7', 'Cdim7']) {
      expect(tones(form)).toBe('C Eb Gb Bbb');
    }
  });
});

describe('case is never normalised', () => {
  // Acceptance criterion: CM7 and Cm7 must not collide.
  it('reads CM7 as major and Cm7 as minor', () => {
    expect(tones('CM7')).toBe('C E G B');
    expect(tones('Cm7')).toBe('C Eb G Bb');
  });

  it('reads Bb as a flat root, not B with a flat five', () => {
    expect(parseChord('Bb').chord.root).toEqual({ letter: 'B', accidental: -1 });
    expect(parseChord('B').chord.root).toEqual({ letter: 'B', accidental: 0 });
  });
});

describe('the slash is overloaded', () => {
  // Acceptance criterion: C/E is a bass note, C6/9 is a compound quality.
  it('reads C/E as a slash bass', () => {
    const c = parseChord('C/E').chord;
    expect(c.bass).toEqual({ letter: 'E', accidental: 0 });
    expect(describeChordTones(c)).toBe('C E G');
  });

  it('reads C6/9 as a compound quality with no bass', () => {
    const c = parseChord('C6/9').chord;
    expect(c.bass).toBeNull();
    expect(describeChordTones(c)).toBe('C E G A D');
  });

  it('handles a compound quality that also has a bass', () => {
    const c = parseChord('C6/9/E').chord;
    expect(c.bass).toEqual({ letter: 'E', accidental: 0 });
    expect(describeChordTones(c)).toBe('C E G A D');
  });
});

describe('the C7+ ambiguity', () => {
  // Acceptance criterion: dialect-dependent, and reported either way.
  it('reads C7+ as a major 7th in Brazilian', () => {
    expect(tones('C7+', 'brazilian')).toBe('C E G B');
  });

  it('reads C7+ as a dominant 7th with a raised 5th in American', () => {
    expect(tones('C7+', 'american')).toBe('C E G# Bb');
  });

  it('reports the ambiguity rather than choosing silently', () => {
    for (const dialect of DIALECT_IDS) {
      const r = parseChord('C7+', dialect);
      expect(r.ambiguities).toHaveLength(1);
      expect(r.ambiguities[0].kind).toBe('sevenPlus');
      expect(r.ambiguities[0].alternatives).toHaveLength(1);
    }
  });

  it('does not treat 5+ or 9+ as ambiguous, since those are plain sharps', () => {
    expect(tones('C7(5+)')).toBe('C E G# Bb');
    expect(parseChord('C7(5+)').ambiguities).toHaveLength(0);
    expect(tones('C7(9+)')).toBe('C E G Bb D#');
  });
});

describe('the C9 ambiguity', () => {
  it('reads C9 as an added 9th in Brazilian', () => {
    expect(tones('C9', 'brazilian')).toBe('C E G D');
  });

  it('reads C9 as a dominant 9th in American and Real Book', () => {
    expect(tones('C9', 'american')).toBe('C E G Bb D');
    expect(tones('C9', 'realbook')).toBe('C E G Bb D');
  });

  it('reports both readings', () => {
    const r = parseChord('C9', 'brazilian');
    expect(r.ambiguities[0]).toMatchObject({ kind: 'bareNine', chosen: 'add' });
    expect(r.ambiguities[0].alternatives).toEqual(['dominant']);
  });

  it('is unambiguous once a 7th is stated', () => {
    expect(parseChord('C7(9)').ambiguities).toHaveLength(0);
    expect(parseChord('Cmaj9').ambiguities).toHaveLength(0);
    expect(parseChord('Cadd9').ambiguities).toHaveLength(0);
    expect(tones('Cmaj9')).toBe('C E G B D');
    expect(tones('Cadd9')).toBe('C E G D');
  });
});

describe('extensions and alterations', () => {
  it.each([
    ['C', 'C E G'],
    ['Cm', 'C Eb G'],
    ['C7', 'C E G Bb'],
    ['C6', 'C E G A'],
    ['Cm6', 'C Eb G A'],
    ['C5', 'C G'],
    ['Csus4', 'C F G'],
    ['Csus2', 'C D G'],
    ['C4', 'C F G'],
    ['Caug', 'C E G#'],
    ['C+', 'C E G#'],
    ['C°', 'C Eb Gb'],
    ['Cmaj7#11', 'C E G B F#'],
    ['C7b9', 'C E G Bb Db'],
    ['C13', 'C E G Bb D A'],
    ['C11', 'C E G Bb D F'],
    ['Cm7b5', 'C Eb Gb Bb'],
    ['C7#5', 'C E G# Bb'],
    ['C7#9', 'C E G Bb D#'],
    ['Cm(maj7)', 'C Eb G B'],
    ['C7M9', 'C E G B D'],
  ])('%s is %s', (text, expected) => {
    expect(tones(text)).toBe(expected);
  });

  it('accepts parenthesised Brazilian alterations', () => {
    expect(tones('C7(9-)')).toBe('C E G Bb Db');
    expect(tones('Cm7(9)')).toBe('C Eb G Bb D');
  });
});

describe('errors are returned, never thrown', () => {
  it.each(['', '   ', 'H7', 'xyz', 'C##bb7', '7', 'Cmaj/'])(
    'rejects %s without throwing',
    (bad) => {
      let result;
      expect(() => {
        result = parseChord(bad);
      }).not.toThrow();
      expect(result.chord).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toBeTruthy();
    }
  );
});

// --- the round-trip matrix ------------------------------------------------

/**
 * A corpus of canonical chords. Every one must survive being formatted in a
 * dialect and parsed back in that dialect. This is the contract that keeps
 * formatters from emitting spellings the parser cannot read.
 */
const CORPUS = [
  chord(n('C')),
  chord(n('Db')),
  chord(n('F#')),
  chord(n('Bb'), 'minor'),
  chord(n('A'), 'minor'),
  chord(n('B'), 'dim'),
  chord(n('C'), 'aug'),
  chord(n('C'), 'sus2'),
  chord(n('C'), 'sus4'),
  chord(n('C'), 'power'),
  chord(n('C'), 'major', [{ degree: 7 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'minor', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'minor', [{ degree: 7 }]),
  chord(n('C'), 'dim', [{ degree: 7, alter: -2 }]),
  chord(n('C'), 'dim', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'aug', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'major', [{ degree: 6 }]),
  chord(n('C'), 'minor', [{ degree: 6 }]),
  chord(n('C'), 'major', [{ degree: 6 }, { degree: 9 }]),
  chord(n('C'), 'major', [{ degree: 9 }]),
  chord(n('Eb'), 'major', [{ degree: 7 }, { degree: 9 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9 }, { degree: 13 }]),
  chord(n('C'), 'major', [{ degree: 7 }, { degree: 11, alter: 1 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9, alter: -1 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9, alter: 1 }]),
  chord(n('G'), 'major', [{ degree: 7, alter: -1 }], n('B')),
  chord(n('C'), 'major', [], n('E')),
  chord(n('A'), 'minor', [{ degree: 7, alter: -1 }], n('G')),
];

describe('round-trip matrix', () => {
  for (const dialect of DIALECT_IDS) {
    describe(dialect, () => {
      it.each(CORPUS.map((c) => [formatChord(c, dialect), c]))(
        'round-trips %s',
        (text, original) => {
          const result = parseChord(text, dialect);
          expect(result.errors).toEqual([]);
          expect(result.chord).not.toBeNull();
          // Compare by sound as well as structure: a formatter that loses a
          // tone would otherwise slip through a structural comparison.
          expect(describeChordTones(result.chord)).toBe(describeChordTones(original));
          expect(sameChord(result.chord, original)).toBe(true);
        }
      );
    });
  }

  it('formats each dialect distinctly where they genuinely differ', () => {
    const maj7 = chord(n('C'), 'major', [{ degree: 7 }]);
    expect(formatChord(maj7, 'brazilian')).toBe('C7M');
    expect(formatChord(maj7, 'american')).toBe('Cmaj7');
    expect(formatChord(maj7, 'realbook')).toBe('C∆7');

    const halfDim = chord(n('C'), 'dim', [{ degree: 7, alter: -1 }]);
    expect(formatChord(halfDim, 'brazilian')).toBe('Cm7(5-)');
    expect(formatChord(halfDim, 'american')).toBe('Cm7b5');
    expect(formatChord(halfDim, 'realbook')).toBe('Cø7');
  });

  it('carries a slash bass through every dialect', () => {
    const c = chord(n('C'), 'major', [], n('E'));
    for (const dialect of DIALECT_IDS) {
      expect(formatChord(c, dialect)).toBe('C/E');
    }
  });
});

describe('cross-dialect reading', () => {
  it('reads a chord written in one dialect while set to another', () => {
    // The payoff of a dialect-free canonical model: a shared link written in
    // Brazilian reads correctly for someone set to American notation.
    const written = formatChord(chord(n('C'), 'major', [{ degree: 7 }]), 'brazilian');
    const readBack = parseChord(written, 'american').chord;
    expect(describeChordTones(readBack)).toBe('C E G B');
    expect(formatChord(readBack, 'american')).toBe('Cmaj7');
  });
});
