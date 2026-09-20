/**
 * What a planner can measure about a shape (§2.10).
 *
 * Utilities, not a contract. Nothing here is called by the framework; a planner
 * imports what it wants and ignores the rest. That is the point — a shared
 * *interface* for scoring would be the two-function planner again, and it is
 * the shape we decided against.
 */

const pcOf = (midi) => ((midi % 12) + 12) % 12;

/** The notes a shape actually sounds. */
export function sounding(fingering) {
  return fingering.midis.filter((m) => typeof m === 'number');
}

/** Where the hand is: the lowest fretted fret, 0 for a shape held open. */
export function position(frets) {
  const fretted = frets.filter((f) => typeof f === 'number' && f > 0);
  return fretted.length > 0 ? Math.min(...fretted) : 0;
}

/** The lowest note a shape sounds. */
export function lowest(fingering) {
  return Math.min(...sounding(fingering));
}

/** How far the hand and the top voice moved from the shape before. */
export function movement(candidate, previous) {
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
export function doubling(fingering) {
  const notes = sounding(fingering);
  return notes.length - new Set(notes.map(pcOf)).size;
}

/** The highest-numbered string index this shape sounds. */
export function highestString(fingering) {
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
 * Gm–Gm6–Gm7 into one grip with one finger moving.
 */
export function stringChange(candidate, previous) {
  if (!previous) return 0;
  let changed = 0;
  for (let i = 0; i < candidate.frets.length; i += 1) {
    if ((candidate.frets[i] === 'x') !== (previous.frets[i] === 'x')) changed += 1;
  }
  return changed;
}

/**
 * The cheapest of some candidates.
 *
 * Ties go to the earlier one, so a planner that cares how its ties fall says so
 * by the order it hands them over — which is the planner breaking its own ties,
 * rather than a framework breaking them silently by enumeration order.
 *
 * @template T
 * @param {T[]} candidates
 * @param {(candidate: T) => number} cost
 * @returns {T|null}
 */
export function best(candidates, cost) {
  let chosen = null;
  let lowestCost = Infinity;
  for (const candidate of candidates) {
    const c = cost(candidate);
    if (c < lowestCost) {
      lowestCost = c;
      chosen = candidate;
    }
  }
  return chosen;
}
