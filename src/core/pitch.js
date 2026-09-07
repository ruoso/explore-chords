/**
 * Pitch and note spelling.
 *
 * The central decision here (docs/DESIGN.md §4.1) is that a note's *name* is
 * kept separate from its pitch class. The reference implementation normalised
 * everything to sharps, so a Db chord came out spelled `C# F G#`. Here a
 * SpelledNote carries a letter and an accidental, and pitch class is derived
 * from it rather than the other way round.
 *
 * Everything in this file is synchronous and free of I/O. See §3.2.
 */

import { fault } from './errors.js';

/** Letter names in scale order, so index arithmetic is diatonic. */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Pitch class of each natural letter. */
const NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Semitones above the tonic for each degree of a major scale. */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

const ACCIDENTAL_NAMES = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };

/**
 * @typedef {{ letter: string, accidental: number }} SpelledNote
 * `accidental` is in semitones: -1 is flat, +1 is sharp.
 *
 * @typedef {{ letterSteps: number, semitones: number }} Interval
 * A diatonic interval. `letterSteps` is how far the letter name moves, which
 * is what makes correct spelling possible: transposing by semitones alone
 * cannot tell F# from Gb. See §4.5.
 *
 * @typedef {{ note: SpelledNote, octave: number }} Pitch
 */

/** @returns {SpelledNote} */
export function note(letter, accidental = 0) {
  const upper = String(letter).toUpperCase();
  if (!(upper in NATURAL_PC)) throw new Error(`Bad letter: ${letter}`);
  if (!Number.isInteger(accidental) || accidental < -2 || accidental > 2) {
    throw new Error(`Bad accidental: ${accidental}`);
  }
  return { letter: upper, accidental };
}

/**
 * Parse a note name such as `C`, `F#`, `Bb`, `Ebb`.
 * Case-sensitive on the accidental: `b` is flat, `B` is the letter B.
 * @returns {SpelledNote}
 */
export function parseNote(text) {
  const m = /^([A-Ga-g])(bb|##|[b#])?$/.exec(String(text).trim());
  if (!m) throw fault('badNote', { text }, `Cannot parse note: ${text}`);
  const accidental = { bb: -2, b: -1, '#': 1, '##': 2 }[m[2]] ?? 0;
  return note(m[1], accidental);
}

/** @param {SpelledNote} n */
export function formatNote(n) {
  return n.letter + ACCIDENTAL_NAMES[String(n.accidental)];
}

/** @param {SpelledNote} n @returns {number} 0-11 */
export function pitchClass(n) {
  return (((NATURAL_PC[n.letter] + n.accidental) % 12) + 12) % 12;
}

/** @param {SpelledNote} a @param {SpelledNote} b */
export function sameNote(a, b) {
  return a.letter === b.letter && a.accidental === b.accidental;
}

/** True when two spellings sound the same, e.g. F# and Gb. */
export function isEnharmonic(a, b) {
  return pitchClass(a) === pitchClass(b);
}

/** @returns {Interval} */
export function interval(letterSteps, semitones) {
  return { letterSteps, semitones };
}

/**
 * The interval from the root to a chord degree.
 *
 * Degrees are 1-based and may exceed an octave: 9, 11 and 13 are the 2nd, 4th
 * and 6th an octave up. `alter` is in semitones, so a #11 is
 * `degreeToInterval(11, 1)`.
 *
 * @returns {Interval}
 */
export function degreeToInterval(degree, alter = 0) {
  if (!Number.isInteger(degree) || degree < 1) {
    throw new Error(`Bad degree: ${degree}`);
  }
  const zeroBased = degree - 1;
  const octaves = Math.floor(zeroBased / 7);
  const index = zeroBased % 7;
  return interval(index, MAJOR_SCALE[index] + 12 * octaves + alter);
}

/**
 * Transpose a note by a diatonic interval, keeping the spelling correct.
 *
 * The letter moves by `letterSteps`, then the accidental is whatever is needed
 * to land on the right pitch class. This is why `Bb` up a major third is `D`
 * and not `C##`.
 *
 * @param {SpelledNote} n @param {Interval} iv @returns {SpelledNote}
 */
export function transposeNote(n, iv) {
  const fromIndex = LETTERS.indexOf(n.letter);
  const toIndex = (((fromIndex + iv.letterSteps) % 7) + 7) % 7;
  const letter = LETTERS[toIndex];

  const targetPc = (((pitchClass(n) + iv.semitones) % 12) + 12) % 12;
  let accidental = targetPc - NATURAL_PC[letter];
  // Choose the representative nearest zero: crossing the octave boundary
  // (B -> C, or C -> B) otherwise yields absurd accidentals like +11.
  if (accidental > 6) accidental -= 12;
  if (accidental < -6) accidental += 12;

  return note(letter, accidental);
}

/**
 * Parse scientific pitch notation such as `E2`, `F#3`, `Bb1`.
 * @returns {Pitch}
 */
export function parsePitch(text) {
  const m = /^([A-Ga-g](?:bb|##|[b#])?)(-?\d+)$/.exec(String(text).trim());
  if (!m) throw fault('badPitch', { text }, `Cannot parse pitch: ${text}`);
  return { note: parseNote(m[1]), octave: Number(m[2]) };
}

/** @param {Pitch} p */
export function formatPitch(p) {
  return formatNote(p.note) + p.octave;
}

/**
 * MIDI number for a pitch, where C4 is 60.
 *
 * The accidental is applied to the MIDI number rather than folded into a pitch
 * class first, so notes that cross an octave boundary land correctly: Cb4 is
 * B3 (59), and B#3 is C4 (60).
 *
 * @param {Pitch} p @returns {number}
 */
export function pitchToMidi(p) {
  return (p.octave + 1) * 12 + NATURAL_PC[p.note.letter] + p.note.accidental;
}

/** Pitch class of a Pitch, respecting octave-crossing accidentals. */
export function pitchToPitchClass(p) {
  return (((pitchToMidi(p) % 12) + 12) % 12);
}

/**
 * Transpose a Pitch, keeping spelling and octave correct.
 * @param {Pitch} p @param {Interval} iv @returns {Pitch}
 */
export function transposePitch(p, iv) {
  const transposed = transposeNote(p.note, iv);
  const targetMidi = pitchToMidi(p) + iv.semitones;
  // Derive the octave from the resulting MIDI number so that, for example,
  // B3 up a minor second is C4 rather than C3.
  const octave =
    Math.round(
      (targetMidi - NATURAL_PC[transposed.letter] - transposed.accidental) / 12
    ) - 1;
  return { note: transposed, octave };
}

export { LETTERS, NATURAL_PC, MAJOR_SCALE };
