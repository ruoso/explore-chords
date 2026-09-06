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
import { scoreFingering, difficultyBucket } from './score.js';
import { optionalRoles } from './heuristics.js';

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
  const results = [];
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

      const midis = frets.map((f, i) => (f === 'x' ? null : midiAt(instrument, i, f)));
      const soundingPcs = new Set(
        midis.filter((m) => m !== null).map((m) => (((m % 12) + 12) % 12))
      );
      const omittedRoles = req.tones
        .filter((t) => !soundingPcs.has(t.pitchClass))
        .map((t) => t.role);

      const lowest = midis.filter((m) => m !== null).reduce((a, b) => Math.min(a, b));
      const bassIsRoot = (((lowest % 12) + 12) % 12) === pitchClass(chord.root);

      const score = scoreFingering({
        frets,
        hand,
        omittedRoles,
        bassIsRoot,
        bassRequested: hasDistinctBass(chord),
        config,
      });

      results.push({
        frets,
        fingers: hand.fingers,
        barre: hand.barre,
        midis,
        omittedRoles,
        position: hand.lowestFret,
        score,
        difficulty: difficultyBucket(score.total),
        shorthand: frets.map((f) => (f === 'x' ? 'x' : f)).join(''),
      });
    }
  }

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

/** Flatten a search result back to a plain ranked list. */
export function allFingerings(result) {
  return result.groups.flatMap((g) => g.fingerings);
}

/** Convenience for tests and fixtures. */
export function shorthands(result) {
  return allFingerings(result).map((f) => f.shorthand);
}

export { openMidis };
