/**
 * A reading of the music in a chart, as against the text of it (§2.10).
 *
 * `song.js` parses, edits and round-trips the source. This looks at what the
 * source says musically: the line of bass notes the chart implies, and the
 * figures that line makes. A planner is handed one of these before it chooses
 * anything, so a rule stated over a passage — "use octaves through here rather
 * than repeat the same third twice" — has something to be stated against.
 *
 * The dividing line is that **anything one array index away is not analysis**.
 * A planner holds `line` entire, so "what does this chord resolve to" is
 * `line[at + 1]` and needs no machinery here. What earns a place is what takes
 * a scan — where a run begins and ends — or a derivation every planner would
 * otherwise repeat.
 *
 * Pure and synchronous, like everything in core/ (§3.2).
 */

import { parseChord } from './notation/parse.js';
import { bassNote } from './chord.js';
import { pitchClass } from './pitch.js';

/**
 * @typedef {object} ReadingEntry
 * @property {number} at                position in song.occurrences
 * @property {import('./song.js').ChordRef} ref
 * @property {import('./chord.js').Chord|null} chord   null if it does not parse
 * @property {number|null} bassPc       the chart's bass: slash note, else root
 *
 * @typedef {object} Span
 * @property {'walking'} kind
 * @property {number} from              inclusive `at`
 * @property {number} to                inclusive `at`
 * @property {{direction: 'up'|'down', chromatic: boolean}} detail
 *
 * @typedef {object} SongReading
 * @property {ReadingEntry[]} line
 * @property {Span[]} spans
 * @property {(at: number, kind?: string) => Span[]} spansAt
 */

/**
 * The step from one bass note to the next, as a musician hears it.
 *
 * Pitch classes wrap, so B to C is up a semitone rather than down eleven. The
 * shortest signed path says so.
 */
function step(from, to) {
  let d = (to - from) % 12;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

/** A step small enough to be a walk rather than a leap. */
function walks(d) {
  return d === 1 || d === 2 || d === -1 || d === -2;
}

/**
 * Runs where the bass walks rather than leaps.
 *
 * Not "chromatic runs". The sources describe a *baixo cromático-diatônico* — a
 * line that avoids large leaps and "offers a melody" (Campos Ramos, p.121) —
 * and the line they analyse in *Vibrações* is ré-mi-fá-fá#-sol-lá-sib, whole
 * tones and semitones mixed. That shape is what the idiom's rules answer to, so
 * that is the shape this finds; `detail.chromatic` is there for a planner that
 * wants the narrower all-semitone case.
 *
 * Three chords at least, because two chords are one step, and one step is not
 * yet a line going anywhere.
 */
function walkingSpans(line) {
  const spans = [];
  let from = null;
  let direction = 0;
  let chromatic = true;

  const close = (to) => {
    if (from !== null && to - from >= 2) {
      spans.push({
        kind: 'walking',
        from,
        to,
        detail: { direction: direction > 0 ? 'up' : 'down', chromatic },
      });
    }
    from = null;
  };

  for (let i = 1; i < line.length; i += 1) {
    const before = line[i - 1];
    const here = line[i];
    const d =
      before.bassPc === null || here.bassPc === null ? null : step(before.bassPc, here.bassPc);

    if (d === null || !walks(d)) {
      close(i - 1);
      continue;
    }
    if (from !== null && Math.sign(d) !== direction) close(i - 1);
    if (from === null) {
      from = i - 1;
      direction = Math.sign(d);
      chromatic = true;
    }
    if (Math.abs(d) !== 1) chromatic = false;
  }
  close(line.length - 1);
  return spans;
}

/**
 * Read a parsed song.
 *
 * @param {import('./song.js').ParsedSong} song
 * @param {string} [dialect]
 * @returns {SongReading}
 */
export function analyseSong(song, dialect) {
  const line = song.occurrences.map((ref, at) => {
    const chord = ref.valid ? (parseChord(ref.symbol, dialect).chord ?? null) : null;
    return { at, ref, chord, bassPc: chord ? pitchClass(bassNote(chord)) : null };
  });

  const spans = walkingSpans(line);
  return {
    line,
    spans,
    spansAt: (at, kind) =>
      spans.filter((s) => s.from <= at && at <= s.to && (kind === undefined || s.kind === kind)),
  };
}
