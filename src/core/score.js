/**
 * Difficulty scoring (docs/DESIGN.md §5.4).
 *
 * A weighted sum, where every weight is exposed in the expert panel. The total
 * orders fingerings within a position group; the badge shows a bucketed word,
 * never a raw number, and never colour alone (§6.1).
 */

/**
 * @param {object} args
 * @param {(number|'x')[]} args.frets
 * @param {import('./fingers.js').Hand} args.hand
 * @param {string[]} args.omittedRoles
 * @param {boolean} args.bassIsRoot
 * @param {boolean} args.bassRequested
 * @param {import('./heuristics.js').HeuristicConfig} args.config
 */
export function scoreFingering({
  frets,
  hand,
  omittedRoles,
  bassIsRoot,
  bassRequested,
  config,
}) {
  const w = config.weights;
  const parts = {};

  parts.span = hand.span > 1 ? w.spanPerFret * (hand.span - 1) : 0;

  if (hand.barre) {
    const width = hand.barre.toString - hand.barre.fromString + 1;
    parts.barre = w.barre + (width === frets.length ? w.fullBarre : 0);
  } else {
    parts.barre = 0;
  }

  parts.fingers = w.perFinger * hand.fingerCount;

  parts.innerMutes = w.innerMute * countInnerMutes(frets);

  parts.position = w.positionPerFret * hand.lowestFret;

  parts.omissions =
    (omittedRoles.includes('fifth') ? w.omittedFifth : 0) +
    (omittedRoles.includes('root') ? w.rootless : 0);

  parts.bass = !bassIsRoot && !bassRequested ? w.nonRootBass : 0;

  parts.open = w.openString * frets.filter((f) => f === 0).length;

  parts.muted = (w.mutedString ?? 0) * frets.filter((f) => f === 'x').length;

  // A four-fret reach is materially harder than a compact shape.
  parts.stretch = hand.span >= 4 ? w.nonAdjacentStretch : 0;

  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}

/** Muted strings with sounding strings on both sides need deliberate damping. */
export function countInnerMutes(frets) {
  const first = frets.findIndex((f) => f !== 'x');
  const last = frets.length - 1 - [...frets].reverse().findIndex((f) => f !== 'x');
  if (first === -1) return 0;
  let count = 0;
  for (let i = first + 1; i < last; i += 1) {
    if (frets[i] === 'x') count += 1;
  }
  return count;
}

/**
 * Bucketed difficulty. A word, so the badge never depends on colour alone.
 *
 * Thresholds calibrated against real shapes on a standard guitar (§11): open E
 * and G land around 0.5, A minor 1.6, open C 2.6, open D 2.8, and the F barre
 * 5.5. A beginner's first chords should not read as "medium".
 *
 * @returns {'easy'|'medium'|'hard'}
 */
export function difficultyBucket(total) {
  if (total <= 3.0) return 'easy';
  if (total <= 5.0) return 'medium';
  return 'hard';
}

export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
