/**
 * Chord notation dialects (docs/DESIGN.md §4.4).
 *
 * There is one permissive parser, not one parser per dialect. Most dialect
 * differences are non-conflicting aliases — `Cmaj7`, `C∆7`, `CM7` and `C7M` can
 * all be accepted at once with no ambiguity — so the dialect is consulted only
 * for the handful of readings that genuinely conflict, and for formatting.
 */

/**
 * The genuine ambiguities. Everything else is accepted unconditionally.
 *
 * `sevenPlus` — `C7+`. Brazilian reads it as a major 7th, because a literally
 * sharpened 7th would be an octave and so the notation is free for reuse. The
 * reference's own table has `7+: 11` (docs/DESIGN.md §4.4). American reads the
 * `+` as applying to the chord: a dominant 7th with a raised 5th. Same three
 * characters, two chords differing by a semitone in two places.
 *
 * `bareNine` — `C9`. Jazz stacks it: a dominant 9th always includes the flat
 * 7th. Pop and Brazilian usage often means a plain added 9th with no 7th.
 *
 * `degreeSign` — `B°`. Read strictly it is a diminished triad, but in practice
 * the symbol nearly always means the diminished *seventh*: nobody writes a bare
 * diminished triad, and the shape every guitarist knows for "B°" (x2313x) has
 * the A♭ in it. Every dialect defaults to the seventh; the word `dim` written
 * out is the triad.
 */
export const DIALECTS = {
  brazilian: {
    id: 'brazilian',
    name: 'Brazilian (cifra)',
    readings: {
      sevenPlus: 'majorSeventh',
      bareNine: 'add',
      degreeSign: 'diminishedSeventh',
    },
  },
  american: {
    id: 'american',
    name: 'American / jazz',
    readings: {
      sevenPlus: 'dominantSharpFive',
      bareNine: 'dominant',
      degreeSign: 'diminishedSeventh',
    },
  },
  realbook: {
    id: 'realbook',
    name: 'Real Book symbols',
    readings: {
      sevenPlus: 'dominantSharpFive',
      bareNine: 'dominant',
      degreeSign: 'diminishedSeventh',
    },
  },
};

export const DEFAULT_DIALECT = 'brazilian';

export const DIALECT_IDS = Object.keys(DIALECTS);

/** @returns {typeof DIALECTS[keyof typeof DIALECTS]} */
export function getDialect(id) {
  const dialect = DIALECTS[id ?? DEFAULT_DIALECT];
  if (!dialect) throw new Error(`Unknown dialect: ${id}`);
  return dialect;
}

/**
 * Human-readable descriptions of the two competing readings, used by the
 * disambiguation chip in the UI (§2.2) so the user sees which was taken.
 */
export const READING_LABELS = {
  sevenPlus: {
    majorSeventh: 'major 7th',
    dominantSharpFive: 'dominant 7th, raised 5th',
  },
  bareNine: {
    add: 'added 9th, no 7th',
    dominant: 'dominant 9th, includes the flat 7th',
  },
  degreeSign: {
    diminishedSeventh: 'diminished 7th',
    diminishedTriad: 'diminished triad, no 7th',
  },
};
