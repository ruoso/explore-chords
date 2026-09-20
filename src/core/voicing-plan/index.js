/**
 * Choosing every voicing in a song at once (docs/DESIGN.md §2.10).
 *
 * Picking shapes one chord at a time is the right way to make a decision and
 * the wrong way to make thirty of them. What a player actually wants is a
 * policy — keep it in one position, keep it open, or play the part a particular
 * idiom asks for — applied across the whole chart, with the hand's path through
 * the song taken into account rather than each chord judged alone.
 *
 * A planner is *one* function. It is handed the whole song, already read
 * (`core/song-analysis.js`), and gives back a shape per chord occurrence. It is
 * not handed one chord at a time, and there is deliberately no second, easier
 * API for the planners that would be happy with that: a shared walk taking a
 * candidate function and a cost function is the design we rejected, and leaving
 * it available would leave the wrong shape as the easy road. What is shared is
 * utilities — `./candidates.js` and `./shape.js` — which a planner calls or
 * ignores as it likes. The price is that each planner writes its own loop.
 *
 * Nothing here writes text. A plan is a map from occurrence to frets, and the
 * caller applies it with setVoicingsForOccurrences, so a wizard is reviewable
 * before it is accepted and undoable afterwards by the ordinary means.
 *
 * Pure and synchronous, like everything in core/ (§3.2).
 */

import { analyseSong } from '../song-analysis.js';
import { stringCount } from '../instrument.js';
import { shorthandOf } from '../fretstring.js';
import { searched, centroCandidates } from './candidates.js';
import {
  best,
  doubling,
  highestString,
  lowest,
  movement,
  position,
  sounding,
  stringChange,
} from './shape.js';

/**
 * Where the centro's own bass sits, measured off Becker's transcriptions of the
 * Época de Ouro six-string: nothing below E2, the weight of it between G2 and
 * D3, and a thin tail above. Letting the grip climb past that is what opening
 * the fourth string to a four-voice thumb would otherwise do.
 */
const CENTRO_BASS_HIGH = 50;

/**
 * @typedef {object} PlanRequest
 * @property {import('../song.js').ParsedSong} song
 * @property {import('../song-analysis.js').SongReading} reading
 * @property {object} instrument
 * @property {string} [dialect]
 * @property {Record<string,string>} choices   answers to `options`, defaults filled
 *
 * @typedef {object} PlanResult
 * @property {Map<number,(number|'x')[]>} shapes   `at` -> frets
 * @property {number[]} missing                    `at` of chords it could not voice
 */

/**
 * The policies on offer.
 *
 * `appliesTo` keeps a planner off an instrument it makes no sense on rather
 * than letting it return nothing and look broken.
 */
export const PLANNERS = [
  {
    id: 'smoothest',
    // The hand's path through the song, rather than each chord judged alone.
    // Two easy shapes at opposite ends of the neck are harder to play in
    // sequence than two middling ones next to each other.
    //
    // No sources: this is an engineering heuristic about hands, not a claim
    // about how anybody's music is played.
    sources: [],
    plan({ reading, instrument }) {
      const shapes = new Map();
      const missing = [];
      const already = new Map();
      let previous = null;

      for (const entry of reading.line) {
        if (!entry.chord) continue;
        // A chord that appears in six bars is one voicing, not six, unless the
        // planner has a reason to differ — and keeping a hand still is not one.
        const settled = already.get(entry.ref.key);
        if (settled) {
          shapes.set(entry.at, settled.frets);
          previous = settled;
          continue;
        }
        const options = searched(entry.chord, instrument);
        if (options.length === 0) {
          missing.push(entry.at);
          continue;
        }
        const pick = best(
          options,
          (c) => c.score.total * 0.5 + movement(c, previous) * 1.2
        );
        previous = pick;
        already.set(entry.ref.key, pick);
        shapes.set(entry.at, pick.frets);
      }
      return { shapes, missing };
    },
  },
  {
    id: 'openPosition',
    // Down at the nut, where a beginner already knows the shapes and an open
    // string does the work of a finger. Also an engineering heuristic.
    sources: [],
    plan({ reading, instrument }) {
      const shapes = new Map();
      const missing = [];
      const already = new Map();

      for (const entry of reading.line) {
        if (!entry.chord) continue;
        const settled = already.get(entry.ref.key);
        if (settled) {
          shapes.set(entry.at, settled.frets);
          continue;
        }
        const options = searched(entry.chord, instrument);
        if (options.length === 0) {
          missing.push(entry.at);
          continue;
        }
        // Nothing about where the hand has been: the whole policy is "low".
        const pick = best(
          options,
          (c) =>
            c.score.total * 0.5 +
            position(c.frets) * 1.5 -
            c.frets.filter((f) => f === 0).length * 0.5
        );
        already.set(entry.ref.key, pick);
        shapes.set(entry.at, pick.frets);
      }
      return { shapes, missing };
    },
  },
  {
    id: 'choroCentro',
    // The six-string's part in a choro regional, playing the centro while a
    // seven-string carries the bass line (§2.10). Only worth offering on an
    // instrument with strings to spare for a thumb-and-fingers grip.
    //
    // Unlike the other two, this one claims to reproduce a documented practice,
    // so it has to be able to say whose. See src/data/sources.js.
    sources: [
      'camposRamos2016',
      'becker1996',
      'korver2020',
      'vilelaMangueira2023',
      'botelho2018',
      'faria',
    ],
    appliesTo: (instrument) => stringCount(instrument) >= 5,
    options: [
      {
        // Which remedy, where a third above the other guitar's bass is not in
        // the chord. Campos names a sixth or an octave first and then, "em
        // alguns casos", a third below onto the fifth — all three for the same
        // situation, so which one a player wants is a preference and not a
        // fact (§2.10).
        id: 'whenNoThirdAbove',
        values: ['sixth', 'thirdBelow'],
        default: 'sixth',
        sources: ['camposRamos2016'],
      },
    ],
    plan({ reading, instrument, choices }) {
      const shapes = new Map();
      const missing = [];
      const already = new Map();
      const strings = stringCount(instrument);
      let previous = null;

      for (const entry of reading.line) {
        if (!entry.chord) continue;
        const settled = already.get(entry.ref.key);
        if (settled) {
          shapes.set(entry.at, settled.frets);
          previous = settled;
          continue;
        }

        const all = centroCandidates(entry.chord, instrument, { bassPc: entry.bassPc });
        const wanted = intervalOrder(choices);

        let options = [];
        for (const interval of wanted) {
          options = all.filter((c) => c.intervals.includes(interval));
          if (options.length > 0) break;
        }
        if (options.length === 0) {
          missing.push(entry.at);
          continue;
        }

        // Ties go to the earlier candidate, so the order decides them: lower
        // on the neck first, and a fuller chord ahead of a doubled one at the
        // same position. Both are stated in "How it works".
        const ordered = [...options].sort(
          (a, b) =>
            position(a.fingering.frets) - position(b.fingering.frets) ||
            doubling(a.fingering) - doubling(b.fingering)
        );
        const pick = best(ordered, (c) => centroCost(c.fingering, previous, strings)).fingering;

        previous = pick;
        already.set(entry.ref.key, pick);
        shapes.set(entry.at, pick.frets);
      }
      return { shapes, missing };
    },
  },
];

/** What one centro shape costs, given where the hand already is. */
function centroCost(candidate, previous, strings) {
  return (
    candidate.score.total * 0.5 +
    Math.max(0, sounding(candidate).length - 4) * 0.6 +
    // Four voices is the norm. Five is the occasional departure and three the
    // other texture entirely, so both cost something to reach for.
    Math.max(0, 4 - sounding(candidate).length) * 0.8 +
    movement(candidate, previous) * 1.0 +
    stringChange(candidate, previous) * 1.5 +
    doubling(candidate) * 1.2 +
    // A grip whose own bass climbs above the register the transcriptions show.
    (Math.max(0, lowest(candidate) - CENTRO_BASS_HIGH) / 12) * 3.0 +
    // The transcriptions put the fingers on the second, third and fourth
    // strings, so the grip reaches the second from the top. A run that stops
    // on the middle of the neck is the same notes with no top voice, which
    // under another guitar is all mud.
    (highestString(candidate) < strings - 2 ? 2.0 : 0)
  );
}

/**
 * Which relations to the other guitar's bass this chord may use, in preference
 * order.
 *
 * The third is the idiom, always first. What follows it is the player's, since
 * the literature gives three remedies for the same situation and no ranking
 * between them beyond the order it happens to list them in (§2.10).
 */
function intervalOrder(choices) {
  return choices.whenNoThirdAbove === 'thirdBelow'
    ? ['third', 'thirdBelow', 'sixth', 'octave']
    : ['third', 'sixth', 'octave', 'thirdBelow'];
}

export function plannerById(id) {
  return PLANNERS.find((p) => p.id === id) ?? null;
}

/** Which planners make sense on this instrument. */
export function plannersFor(instrument) {
  return PLANNERS.filter((p) => !p.appliesTo || p.appliesTo(instrument));
}

/** A planner's options at their defaults, which is what an unasked question means. */
export function optionDefaults(planner) {
  const out = {};
  for (const option of planner?.options ?? []) out[option.id] = option.default;
  return out;
}

/**
 * Choose a shape for every chord in the song.
 *
 * Thin on purpose: read the song, hand it to the planner, and say afterwards
 * which of its choices the song already had. The deciding is all the planner's.
 *
 * @param {string} plannerId
 * @param {import('../song.js').ParsedSong} song
 * @param {object} instrument
 * @param {{dialect?: string, existing?: Map<string,(number|'x')[]>,
 *          choices?: Record<string,string>}} [options]
 * @returns {{planner: string, reading: object, shapes: Map<number,(number|'x')[]>,
 *            missing: number[], unchanged: number[]}}
 */
export function planVoicings(plannerId, song, instrument, { dialect, existing, choices } = {}) {
  const planner = plannerById(plannerId);
  if (!planner) throw new Error(`Unknown planner: ${plannerId}`);

  const reading = analyseSong(song, dialect);
  const { shapes, missing } = planner.plan({
    song,
    reading,
    instrument,
    dialect,
    choices: { ...optionDefaults(planner), ...choices },
  });

  const unchanged = [];
  for (const [at, frets] of shapes) {
    const already = existing?.get(reading.line[at].ref.key);
    if (already && shorthandOf(already) === shorthandOf(frets)) unchanged.push(at);
  }

  return { planner: plannerId, reading, shapes, missing, unchanged };
}
