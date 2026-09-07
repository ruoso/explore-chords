/**
 * Fingering search (docs/DESIGN.md §5).
 *
 * Three stages: generate candidates, assign fingers, score. Synchronous
 * throughout — the reference awaited a data lookup inside its innermost DFS
 * loop, which dominated its runtime (§5.1).
 */

import { chordTones, bassNote, hasDistinctBass } from './chord.js';
import { pitchClass } from './pitch.js';
import { midiAt, openMidis } from './instrument.js';
import { assignFingers } from './fingers.js';
import { scoreFingering, difficultyBucket, STRETCH_SPAN } from './score.js';
import { optionalRoles } from './heuristics.js';
import { shorthandOf } from './fretstring.js';

/** Nodes explored per fret window before that window gives up. */
export const DEFAULT_WINDOW_BUDGET = 20000;

/** Upper bound on fingerings retained per position group, to bound memory. */
export const HARD_CAP_PER_GROUP = 50;

/**
 * @typedef {object} Fingering
 * @property {(number|'x')[]} frets
 * @property {(number|null)[]} fingers
 * @property {object|null} barre
 * @property {(number|null)[]} midis
 * @property {string[]} omittedRoles
 * @property {number} position    lowest fretted fret, 0 for open
 * @property {{total:number, parts:object}} score
 * @property {string} difficulty
 * @property {string} shorthand
 */

/**
 * Which pitch classes a voicing must contain, and which it may.
 *
 * An altered fifth is never optional even when `omitFifth` is on: dropping the
 * #5 from an augmented chord leaves something that is not the chord asked for.
 */
function toneRequirements(chord, config) {
  const tones = chordTones(chord);
  const optional = optionalRoles(config);

  const required = new Map();
  const allowed = new Set();
  for (const tone of tones) {
    allowed.add(tone.pitchClass);
    const isAlteredFifth = tone.role === 'fifth' && tone.alter !== 0;
    if (optional.has(tone.role) && !isAlteredFifth) continue;
    required.set(tone.pitchClass, tone.role);
  }

  const bass = bassNote(chord);
  allowed.add(pitchClass(bass));
  if (config.rootInBass) required.set(pitchClass(bass), 'root');

  return { tones, required, allowed, optional };
}

/**
 * Depth-first over strings, one fret window at a time.
 *
 * Pruned during descent rather than only at the leaf: once the strings that
 * remain cannot supply the tones still missing, the branch is abandoned.
 */
function generateForWindow(chord, instrument, config, lo, hi, req, out, budget) {
  const stringCount = instrument.strings.length;

  // Per string, the frets that produce a chord tone at all.
  const options = [];
  for (let s = 0; s < stringCount; s += 1) {
    const list = [];
    const openPc = ((midiAt(instrument, s, 0) % 12) + 12) % 12;
    if (req.allowed.has(openPc)) list.push(0);
    for (let f = lo; f <= hi; f += 1) {
      if (f === 0) continue;
      if (f > instrument.fretCount) break;
      const pc = ((midiAt(instrument, s, f) % 12) + 12) % 12;
      if (req.allowed.has(pc)) list.push(f);
    }
    options.push(list);
  }

  const assignment = new Array(stringCount);
  let nodes = 0;
  let exhausted = false;

  const walk = (s, covered) => {
    if (exhausted) return;
    nodes += 1;
    if (nodes > budget) {
      exhausted = true;
      return;
    }

    if (s === stringCount) {
      let missing = 0;
      for (const pc of req.required.keys()) if (!covered.has(pc)) missing += 1;
      if (missing === 0) out.push(assignment.slice());
      return;
    }

    // Prune: can the strings that remain still cover what is missing?
    let missing = 0;
    for (const pc of req.required.keys()) if (!covered.has(pc)) missing += 1;
    if (missing > stringCount - s) return;

    for (const fret of options[s]) {
      const pc = ((midiAt(instrument, s, fret) % 12) + 12) % 12;
      assignment[s] = fret;
      const had = covered.has(pc);
      if (!had) covered.add(pc);
      walk(s + 1, covered);
      if (!had) covered.delete(pc);
      if (exhausted) return;
    }

    assignment[s] = 'x';
    walk(s + 1, covered);
  };

  walk(0, new Set());
  return exhausted;
}

/** Fretted notes no higher than this can be played with the hand at the nut. */
export const OPEN_POSITION_LIMIT = 4;

/**
 * Where the hand is, which is what a player browses by.
 *
 * Open position is the textbook one: every fretted note within the first four
 * frets, and at least one open string. So x32010, 320003 and xx0232 are open,
 * while 133211 is fret 1 — no open strings, the hand is doing something else —
 * and x-x-12-13-0-13 is fret 12. That last one is why "uses an open string" is
 * not the definition: the open string is incidental to where the hand sits.
 *
 * @returns {number} 0 for open position, else the lowest fretted fret
 */
export function positionOf(frets, hand) {
  const fretted = frets.filter((f) => typeof f === 'number' && f > 0);
  const hasOpen = frets.includes(0);
  const highest = fretted.length ? Math.max(...fretted) : 0;
  if (hasOpen && highest <= OPEN_POSITION_LIMIT) return 0;
  return hand.lowestFret;
}

/** Reject candidates that break a rule no amount of finger skill can fix. */
function candidateProblem(frets, instrument, chord, config, req) {
  const sounding = [];
  for (let i = 0; i < frets.length; i += 1) {
    if (frets[i] !== 'x') sounding.push({ string: i, midi: midiAt(instrument, i, frets[i]) });
  }

  if (sounding.length < config.minSoundingStrings) return 'too few strings';

  if (!config.allowInnerMutes) {
    const first = sounding[0].string;
    const last = sounding[sounding.length - 1].string;
    for (let i = first; i <= last; i += 1) {
      if (frets[i] === 'x') return 'inner mute';
    }
  }

  if (!config.allowDuplicatePitch) {
    const seen = new Set();
    for (const s of sounding) {
      if (seen.has(s.midi)) return 'duplicate pitch';
      seen.add(s.midi);
    }
  }

  if (!config.allowDoubling) {
    const seen = new Set();
    for (const s of sounding) {
      const pc = ((s.midi % 12) + 12) % 12;
      if (seen.has(pc)) return 'doubled tone';
      seen.add(pc);
    }
  }

  if (config.rootInBass) {
    const lowest = sounding.reduce((a, b) => (b.midi < a.midi ? b : a));
    const wantPc = pitchClass(bassNote(chord));
    if ((((lowest.midi % 12) + 12) % 12) !== wantPc) return 'wrong bass';
  }

  void req;
  return null;
}

/**
 * Score a shape from its frets alone.
 *
 * Which roles a shape leaves out, and whether its lowest note is the root, are
 * derived here rather than passed in, so every shape is scored by exactly the
 * same path whether it came from a search or from a song someone wrote.
 */
function scoreOf(frets, hand, instrument, chord, config, tones) {
  const midis = frets.map((f, i) => (f === 'x' ? null : midiAt(instrument, i, f)));
  const sounding = midis.filter((m) => m !== null);
  const soundingPcs = new Set(sounding.map((m) => ((m % 12) + 12) % 12));
  const omittedRoles = tones
    .filter((t) => !soundingPcs.has(t.pitchClass))
    .map((t) => t.role);
  const lowest = Math.min(...sounding);

  return {
    midis,
    omittedRoles,
    score: scoreFingering({
      frets,
      hand,
      omittedRoles,
      bassIsRoot: (((lowest % 12) + 12) % 12) === pitchClass(chord.root),
      bassRequested: hasDistinctBass(chord),
      config,
    }),
  };
}

/**
 * Drop shapes that mute a string for no reason (docs/DESIGN.md §5.2).
 *
 * Damping a string is something a player does because the alternative is a
 * wrong note, never because it saves effort: fingerstyle, a string that could
 * ring is a string that should. So a shape goes when the same shape with one of
 * its muted strings sounding is on offer too and the fingers that fill it go
 * down easily — 3xx333 to 3x0333, whose open D string needs no finger at all,
 * and x3x0x0 to x32010, which is two ordinary fingers away.
 *
 * **Easily** means the hand does not have to do anything it was not already
 * doing. Fingers are free: this rule exists to say that putting one down beats
 * damping a string. A *reach* is not, and neither is a *barre*, because both
 * change what the hand is doing rather than merely how much of it. That line is
 * what keeps the open chords: xx0232 can be filled, by fretting the A string at
 * the fifth to give x50232, but that shape spans four frets where the open D
 * spans two, and nobody plays it. The small F, xx3211, survives the F barre for
 * the same reason.
 *
 * Difficulty deliberately does not come into it. Whether the fuller shape
 * scores better is a question about weights that are still guesses (§11), and
 * answering it that way kept x3x0x0 — a fragment of open C — on the grounds
 * that a fragment is easier than the chord. It is. It is also not worth
 * offering.
 *
 * A fuller shape that renames the bass is never a reason to mute: it voices a
 * different chord. x02210 against 002210 is A minor against its first
 * inversion, and where the rules admit both, both are worth showing. Dropping
 * the same bass by an octave, as x07555 does to xx7555, renames nothing.
 *
 * Only shapes the search actually found count as an alternative, so a shape is
 * only ever dropped for one the user could otherwise have seen.
 */
function dropUnjustifiedMutes(results) {
  // One entry per shape: which strings sound, as a bit per string, how far the
  // hand spans, and where the bass is. Comparing two shapes then starts with a
  // single mask test, which is what keeps this affordable over a few thousand
  // candidates.
  const entries = results.map((f) => {
    let mask = 0;
    let sounding = 0;
    let bass = Infinity;
    for (let i = 0; i < f.frets.length; i += 1) {
      if (f.frets[i] === 'x') continue;
      mask |= 1 << i;
      sounding += 1;
      if (f.midis[i] < bass) bass = f.midis[i];
    }
    return {
      f,
      mask,
      sounding,
      span: spanOf(f.frets),
      bassPc: ((bass % 12) + 12) % 12,
      full: sounding === f.frets.length,
    };
  });

  // Grouped by bass note and ordered widest first, so the scan for a fuller
  // shape can stop once the rest can no longer be one.
  const byBass = new Map();
  for (const e of entries) {
    if (!byBass.has(e.bassPc)) byBass.set(e.bassPc, []);
    byBass.get(e.bassPc).push(e);
  }
  for (const list of byBass.values()) list.sort((a, b) => b.sounding - a.sounding);

  const kept = [];
  for (const e of entries) {
    if (e.full) {
      kept.push(e.f);
      continue;
    }
    let displaced = false;
    for (const other of byBass.get(e.bassPc)) {
      if (other.sounding <= e.sounding) break;
      // Sounds everything this one does, and at least one string more.
      if ((other.mask & e.mask) !== e.mask) continue;
      // A reach or a barre the shape did not already ask for is not "easily".
      if (other.span >= STRETCH_SPAN && e.span < STRETCH_SPAN) continue;
      if (other.f.barre && !e.f.barre) continue;
      if (fretsAgree(e.f.frets, other.f.frets, e.mask)) {
        displaced = true;
        break;
      }
    }
    if (!displaced) kept.push(e.f);
  }
  return kept;
}

/** How many frets a shape covers, 0 when nothing is fretted. */
function spanOf(frets) {
  let lowest = Infinity;
  let highest = 0;
  for (const f of frets) {
    if (typeof f !== 'number' || f === 0) continue;
    if (f < lowest) lowest = f;
    if (f > highest) highest = f;
  }
  return lowest === Infinity ? 0 : highest - lowest + 1;
}

/** Do two shapes fret every sounding string in `mask` identically? */
function fretsAgree(a, b, mask) {
  for (let i = 0; i < a.length; i += 1) {
    if (mask & (1 << i) && a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Search for fingerings of a chord on an instrument.
 *
 * @param {import('./chord.js').Chord} chord
 * @param {object} instrument
 * @param {import('./heuristics.js').HeuristicConfig} config
 * @returns {{ groups: {position:number, fingerings:Fingering[], total:number}[],
 *             count:number, truncated:boolean, nodesExhausted:boolean }}
 */
export function searchFingerings(chord, instrument, config, options = {}) {
  // Heuristics belong to the instrument (§2.4), so that is the default.
  config = config ?? instrument.heuristics;
  const budget = options.windowBudget ?? DEFAULT_WINDOW_BUDGET;
  const req = toneRequirements(chord, config);
  const tonesByPc = new Map();
  for (const t of req.tones) if (!tonesByPc.has(t.pitchClass)) tonesByPc.set(t.pitchClass, t);

  const seen = new Set();
  /** @type {Fingering[]} */
  let results = [];
  let nodesExhausted = false;

  const maxLo = Math.max(1, instrument.fretCount - config.maxSpan + 1);
  // Windows are searched from the nut outward, and the budget is per window, so
  // running out of nodes costs the high, hard voicings rather than the open
  // ones that score best (§5.5).
  const windows = [[0, config.maxSpan]];
  for (let lo = 1; lo <= maxLo; lo += 1) windows.push([lo, lo + config.maxSpan - 1]);

  for (const [lo, hi] of windows) {
    const raw = [];
    if (generateForWindow(chord, instrument, config, lo, hi, req, raw, budget)) {
      nodesExhausted = true;
    }

    for (const frets of raw) {
      const key = frets.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);

      if (candidateProblem(frets, instrument, chord, config, req)) continue;

      const hand = assignFingers(frets, config);
      if (!hand) continue;

      const { midis, omittedRoles, score } = scoreOf(
        frets,
        hand,
        instrument,
        chord,
        config,
        req.tones
      );

      results.push({
        frets,
        fingers: hand.fingers,
        barre: hand.barre,
        midis,
        omittedRoles,
        position: positionOf(frets, hand),
        score,
        difficulty: difficultyBucket(score.total),
        shorthand: shorthandOf(frets),
      });
    }
  }

  // Before ranking and grouping, because a shape and the fuller one that
  // displaces it need not share a position: 3xx333 sits at the third fret while
  // 3x0333, which has an open string, is an open-position shape.
  results = dropUnjustifiedMutes(results);

  results.sort((a, b) => a.score.total - b.score.total || a.position - b.position);

  // Group by position, open first, then ascending. Deliberately not CAGED
  // roman numerals: those assume a guitar in standard tuning (§2.3).
  const byPosition = new Map();
  for (const f of results) {
    if (!byPosition.has(f.position)) byPosition.set(f.position, []);
    byPosition.get(f.position).push(f);
  }

  // Groups carry every fingering they found, ranked; `displayCount` is how many
  // to show before "Show more" (§2.3). Capping inside the search would make
  // expanding a group impossible. HARD_CAP only bounds memory.
  let truncated = false;
  const groups = [...byPosition.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([position, fingerings]) => {
      const kept = fingerings.slice(0, HARD_CAP_PER_GROUP);
      if (kept.length < fingerings.length) truncated = true;
      return {
        position,
        fingerings: kept,
        total: fingerings.length,
        displayCount: Math.min(config.maxResultsPerGroup, kept.length),
      };
    });

  return { groups, count: results.length, truncated, nodesExhausted };
}

/**
 * Rebuild one fingering from a stored fret pattern.
 *
 * Favourites and song sheets store the frets, not a snapshot of the rendered
 * fingering: finger assignment and scoring are recomputed, so a saved shape
 * never drifts out of date when those rules change.
 *
 * @returns {Fingering|null} null when the pattern is not playable
 */
export function fingeringFromFrets(frets, chord, instrument, config) {
  config = config ?? instrument.heuristics;

  // A pattern from another instrument has the wrong number of strings, and
  // would otherwise index past the tuning and throw. Song sheets carry their
  // own tuning to prevent this (core/song.js), but a stored or hand-written
  // pattern should never be able to break a render.
  if (!Array.isArray(frets) || frets.length !== instrument.strings.length) return null;

  const hand = assignFingers(frets, config);
  if (!hand) return null;
  if (frets.every((f) => f === 'x')) return null;

  // Deliberately no mute-justification check (§5.2): a shape someone saved or
  // wrote down stays exactly as they wrote it, even if the search would now
  // prefer a fuller one.
  const { midis, omittedRoles, score } = scoreOf(
    frets,
    hand,
    instrument,
    chord,
    config,
    chordTones(chord)
  );

  return {
    frets,
    fingers: hand.fingers,
    barre: hand.barre,
    midis,
    omittedRoles,
    position: positionOf(frets, hand),
    score,
    difficulty: difficultyBucket(score.total),
    shorthand: shorthandOf(frets),
  };
}

/** Flatten a search result back to a plain ranked list. */
export function allFingerings(result) {
  return result.groups.flatMap((g) => g.fingerings);
}

/** Convenience for tests and fixtures. */
export function shorthands(result) {
  return allFingerings(result).map((f) => f.shorthand);
}

export { openMidis, shorthandOf };
