/**
 * Choosing every voicing in a song at once (docs/DESIGN.md §2.10).
 *
 * Picking shapes one chord at a time is the right way to make a decision and
 * the wrong way to make thirty of them. What a player actually wants is a
 * policy — keep it in one position, keep it open, or play the part a particular
 * idiom asks for — applied across the whole chart, with the hand's path through
 * the song taken into account rather than each chord judged alone.
 *
 * A planner is two functions: which shapes it will consider for a chord, and
 * what they cost given where the hand already is. The walk through the chart is
 * shared, greedy and in reading order, which is also the order a player meets
 * the chords in.
 *
 * Nothing here writes text. A plan is a map from voicing key to frets, and the
 * caller applies it with setVoicingForKey, so a wizard is reviewable before it
 * is accepted and undoable afterwards by the ordinary means.
 *
 * Pure and synchronous, like everything in core/ (§3.2).
 */

import { parseChord } from './notation/parse.js';
import { chordTones, bassNote } from './chord.js';
import { pitchClass } from './pitch.js';
import { midiAt, stringCount, configFor } from './instrument.js';
import { searchFingerings, allFingerings, fingeringFromFrets } from './search.js';

const pcOf = (midi) => ((midi % 12) + 12) % 12;

/** The neck a choro accompaniment works in: the guitar's "primeiro quádruplo". */
const CENTRO_LOW = 0;
const CENTRO_HIGH = 7;

/**
 * Where another instrument might put a bass note: the low string of a
 * seven-string up to the walking range above it. The thirds in the sources are
 * between two moving lines, so the octave is not fixed (§2.10).
 */
const BASS_LOW = 35;
const BASS_HIGH = 52;

function sounding(fingering) {
  return fingering.midis.filter((m) => typeof m === 'number');
}

function position(frets) {
  const fretted = frets.filter((f) => typeof f === 'number' && f > 0);
  return fretted.length > 0 ? Math.min(...fretted) : 0;
}

/** How far the hand and the top voice moved from the shape before. */
function movement(candidate, previous) {
  if (!previous) return 0;
  const hand = Math.abs(position(candidate.frets) - position(previous.frets));
  const top = Math.abs(Math.max(...sounding(candidate)) - Math.max(...sounding(previous)));
  return hand + top * 0.5;
}

/**
 * Voices spent on a note the shape already sounds.
 *
 * A four-voice grip has four notes to give a chord, and one that spends two of
 * them on the same note is a thinner chord than it looks. Doubling is normal on
 * a guitar; doubling twice over is a wasted string.
 */
function doubling(fingering) {
  const notes = sounding(fingering);
  return notes.length - new Set(notes.map(pcOf)).size;
}

/** The highest-numbered string index this shape sounds. */
function highestString(fingering) {
  let highest = -1;
  fingering.frets.forEach((fret, i) => {
    if (fret !== 'x') highest = i;
  });
  return highest;
}

/**
 * How many strings changed between sounding and silent.
 *
 * The picking hand has a pattern, and a chord that moves the strings under it
 * interrupts that pattern as surely as a jump up the neck interrupts the
 * fretting hand. Keeping the same strings is also what turns a run like
 * Gm–Gm6–Gm7 into one grip with one finger moving, rather than three shapes.
 */
function stringChange(candidate, previous) {
  if (!previous) return 0;
  let changed = 0;
  for (let i = 0; i < candidate.frets.length; i += 1) {
    if ((candidate.frets[i] === 'x') !== (previous.frets[i] === 'x')) changed += 1;
  }
  return changed;
}

/** Everything the ordinary search offers for this chord, on this instrument. */
function searched(chord, instrument, config) {
  return allFingerings(searchFingerings(chord, instrument, config));
}

/**
 * Contiguous runs of strings a thumb-and-fingers grip can use.
 *
 * Four voices is the norm in this idiom and five the occasional departure, the
 * thumb takes the lowest or second-lowest string, and the top string is left
 * spare (§2.10). On six strings that is E-A-D-G and A-D-G-B, plus the two
 * five-string runs.
 */
function centroStringSets(count) {
  const sets = [];
  for (const size of [4, 5]) {
    for (const start of [0, 1]) {
      const end = start + size - 1;
      if (end > count - 1) continue;
      // The top string stays out of a four-voice grip; a five-voice one may
      // reach it, since it is the wider texture that occasionally appears.
      if (size === 4 && end === count - 1) continue;
      sets.push(Array.from({ length: size }, (_, i) => start + i));
    }
  }
  return sets;
}

/**
 * How far above the other instrument's bass this one's may sit, in preference
 * order.
 *
 * A third is the idiom. It is not always available: a third above the seventh
 * of a dominant resolving to a major chord lands on a note the style does not
 * use, which is a case the sources name rather than a gap in the search. The
 * remedy they give for it is a sixth or an octave, so those are tried in turn
 * and only if the third yields nothing (§2.10).
 */
const CENTRO_INTERVALS = [
  [3, 4],
  [8, 9],
  [12],
];

/**
 * Shapes whose lowest note is a third above where another instrument is.
 *
 * Enumerated rather than searched, because the search drops a muted shape when
 * a fuller one is no harder (§5.2) — the right rule for a solo player and the
 * wrong one here, where the low strings are quiet because somebody else has
 * them. Only notes belonging to the chord are considered, every tone but the
 * fifth has to be present, and the strings sounded are contiguous: a grip with
 * a hole in it is a decision the player can still make, and one that needs a
 * hole cannot be undone.
 */
function centroCandidates(chord, instrument, { bassPc }) {
  const count = stringCount(instrument);
  const config = {
    ...configFor(instrument, 'fingerstyle'),
    rootInBass: false,
    requireRoot: false,
    allowRootless: true,
  };

  const tones = chordTones(chord);
  const byPc = new Map(tones.map((tone) => [tone.pitchClass, tone]));
  const needed = tones.filter((tone) => tone.role !== 'fifth').map((tone) => tone.pitchClass);

  // Per string, the frets in the window that belong to the chord at all.
  const usable = [];
  for (let s = 0; s < count; s += 1) {
    usable[s] = [];
    for (let f = CENTRO_LOW; f <= Math.min(CENTRO_HIGH, instrument.fretCount ?? CENTRO_HIGH); f += 1) {
      if (byPc.has(pcOf(midiAt(instrument, s, f)))) usable[s].push(f);
    }
  }

  const wanted = [];
  for (let m = BASS_LOW; m <= BASS_HIGH; m += 1) if (pcOf(m) === bassPc) wanted.push(m);

  // Everything playable in the window, with the interval each one makes.
  const playable = [];
  for (const set of centroStringSets(count)) {
    const frets = new Array(count).fill('x');
    const walk = (i) => {
      if (i === set.length) {
        const pcs = new Set(set.map((s) => pcOf(midiAt(instrument, s, frets[s]))));
        if (needed.some((pc) => !pcs.has(pc))) return;
        const fingering = fingeringFromFrets([...frets], chord, instrument, config);
        if (!fingering) return;
        // A note sounded three times over is a wasted string, not a fuller
        // chord. Doubling once is ordinary on a guitar; twice is a four-voice
        // grip giving the chord two notes.
        const notes = sounding(fingering);
        const counts = new Map();
        for (const note of notes) counts.set(pcOf(note), (counts.get(pcOf(note)) ?? 0) + 1);
        if ([...counts.values()].some((n) => n > 2)) return;

        const low = Math.min(...notes);
        const gaps = wanted.map((bass) => low - bass).filter((gap) => gap > 0);
        if (gaps.length > 0) playable.push({ fingering, gaps });
        return;
      }
      for (const fret of usable[set[i]]) {
        frets[set[i]] = fret;
        walk(i + 1);
      }
      frets[set[i]] = 'x';
    };
    walk(0);
  }

  for (const accepted of CENTRO_INTERVALS) {
    const out = playable
      .filter((entry) => entry.gaps.some((gap) => accepted.includes(gap)))
      .map((entry) => entry.fingering);
    if (out.length > 0) return out;
  }
  return [];
}

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
    candidates: (chord, instrument) => searched(chord, instrument),
    cost: (candidate, previous) => candidate.score.total * 0.5 + movement(candidate, previous) * 1.2,
  },
  {
    id: 'openPosition',
    // Down at the nut, where a beginner already knows the shapes and an open
    // string does the work of a finger. Also an engineering heuristic.
    sources: [],
    candidates: (chord, instrument) => searched(chord, instrument),
    cost: (candidate) =>
      candidate.score.total * 0.5 +
      position(candidate.frets) * 1.5 -
      candidate.frets.filter((f) => f === 0).length * 0.5,
  },
  {
    id: 'choroCentro',
    // The six-string's part in a choro regional, playing the centro while a
    // seven-string carries the bass line (§2.10). Only worth offering on an
    // instrument with strings to spare for a thumb-and-fingers grip.
    //
    // Unlike the other two, this one claims to reproduce a documented practice,
    // so it has to be able to say whose. See src/data/sources.js.
    sources: ['camposRamos2016', 'korver2020', 'vilelaMangueira2023', 'botelho2018', 'faria'],
    appliesTo: (instrument) => stringCount(instrument) >= 5,
    candidates: centroCandidates,
    cost: (candidate, previous, context) =>
      candidate.score.total * 0.5 +
      Math.max(0, sounding(candidate).length - 4) * 0.6 +
      movement(candidate, previous) * 1.0 +
      stringChange(candidate, previous) * 1.5 +
      doubling(candidate) * 1.2 +
      // The transcriptions put the fingers on the second, third and fourth
      // strings, so the grip reaches the second from the top. A run that stops
      // on the middle of the neck is the same notes with no top voice, which
      // under another guitar is all mud.
      (highestString(candidate) < context.strings - 2 ? 2.0 : 0),
  },
];

export function plannerById(id) {
  return PLANNERS.find((p) => p.id === id) ?? null;
}

/** Which planners make sense on this instrument. */
export function plannersFor(instrument) {
  return PLANNERS.filter((p) => !p.appliesTo || p.appliesTo(instrument));
}

/**
 * The bass note another instrument would be playing under this chord.
 *
 * What the chart says, which is the slash note where one is written and the
 * root otherwise. A chart that says `D7/F#` is telling whoever has the bass to
 * play the F#, so that is what the rest of the arrangement answers to.
 */
function chartBassPitchClass(chord) {
  return pitchClass(bassNote(chord));
}

/**
 * Choose a shape for every chord the song uses.
 *
 * Walks the chart in reading order so each choice can answer the one before
 * it, and keeps the first choice made for a key: a chord that appears in six
 * bars is one voicing, not six, because that is what the text can express.
 *
 * @param {string} plannerId
 * @param {import('./song.js').ParsedSong} song
 * @param {object} instrument
 * @param {{dialect?: string}} [options]
 * @returns {{planner: string, chosen: Map<string,(number|'x')[]>,
 *            missing: string[], unchanged: string[]}}
 *   `missing` are keys the planner found nothing for; `unchanged` are keys it
 *   chose the shape the song already had.
 */
export function planVoicings(plannerId, song, instrument, { dialect, existing } = {}) {
  const planner = plannerById(plannerId);
  if (!planner) throw new Error(`Unknown planner: ${plannerId}`);

  const chosen = new Map();
  const missing = [];
  const unchanged = [];
  const cache = new Map();
  let previous = null;

  for (const occurrence of song.occurrences) {
    if (!occurrence.valid || chosen.has(occurrence.key) || missing.includes(occurrence.key)) {
      continue;
    }
    const chord = parseChord(occurrence.symbol, dialect).chord;
    if (!chord) continue;

    const context = {
      symbol: occurrence.symbol,
      key: occurrence.key,
      bassPc: chartBassPitchClass(chord),
      strings: stringCount(instrument),
    };
    if (!cache.has(occurrence.symbol)) {
      cache.set(occurrence.symbol, planner.candidates(chord, instrument, context));
    }
    const options = cache.get(occurrence.symbol);
    if (options.length === 0) {
      missing.push(occurrence.key);
      continue;
    }

    const pick = options.reduce((best, option) =>
      planner.cost(option, previous, context) < planner.cost(best, previous, context) ? option : best
    );
    previous = pick;
    chosen.set(occurrence.key, pick.frets);

    const already = existing?.get(occurrence.key);
    if (already && already.join() === pick.frets.join()) unchanged.push(occurrence.key);
  }

  return { planner: plannerId, chosen, missing, unchanged };
}
