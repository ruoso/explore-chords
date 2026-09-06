/**
 * Finger assignment (docs/DESIGN.md §5.3).
 *
 * The reference only counted roughly: if a fret needed four or more strings it
 * declared a barre and bailed if anything sat below it. Here we assign actual
 * fingers, which is what lets the diagrams show 1-4 and what makes difficulty
 * scoring mean anything.
 *
 * Returns null when no hand can make the shape.
 */

/**
 * @typedef {object} Hand
 * @property {(number|null)[]} fingers  per string: 1-4, 0 for thumb, null if open or muted
 * @property {{fret:number, fromString:number, toString:number, finger:number}|null} barre
 * @property {number} fingerCount       distinct fingers used
 * @property {number} span              frets covered, 0 when all open
 * @property {number} lowestFret        lowest fretted fret, 0 when all open
 */

const MAX_FINGERS = 4;

/**
 * @param {(number|'x')[]} frets
 * @param {import('./heuristics.js').HeuristicConfig} config
 * @returns {Hand|null}
 */
export function assignFingers(frets, config) {
  const fretted = [];
  for (let i = 0; i < frets.length; i += 1) {
    const f = frets[i];
    if (typeof f === 'number' && f > 0) fretted.push({ string: i, fret: f });
  }

  const fingers = frets.map(() => null);

  if (fretted.length === 0) {
    return { fingers, barre: null, fingerCount: 0, span: 0, lowestFret: 0 };
  }

  const lowestFret = Math.min(...fretted.map((x) => x.fret));
  const highestFret = Math.max(...fretted.map((x) => x.fret));
  const span = highestFret - lowestFret + 1;
  if (span > config.maxSpan) return null;

  // A shape needing no more fingers than a hand has does not need a barre.
  if (fretted.length <= MAX_FINGERS) {
    const hand = assignWithoutBarre(fretted, fingers.slice());
    if (hand) {
      return { ...hand, barre: null, span, lowestFret };
    }
  }

  if (!config.allowBarre) return null;
  return assignWithBarre(frets, fretted, lowestFret, span, config);
}

/**
 * One finger per fretted string, lowest fret first. A higher-numbered finger
 * may never sit on a lower fret than a lower-numbered one, which falls out of
 * assigning in ascending fret order.
 */
function assignWithoutBarre(fretted, fingers) {
  const sorted = [...fretted].sort((a, b) => a.fret - b.fret || a.string - b.string);
  let next = 1;
  for (const { string, fret } of sorted) {
    // Strings at the same fret adjacent to the previous one can share a finger
    // only via a barre; without one, each needs its own.
    if (next > MAX_FINGERS) return null;
    fingers[string] = next;
    next += 1;
    void fret;
  }
  return { fingers, fingerCount: next - 1 };
}

/**
 * Barre with the index finger at the lowest fretted fret, then fingers 2-4
 * above it.
 *
 * The barre spans only from the lowest to the highest string that needs that
 * fret — a partial barre. An open string inside that span is impossible,
 * because the barring finger would stop it; a muted string inside is fine.
 */
function assignWithBarre(frets, fretted, barreFret, span, config) {
  const atBarreFret = fretted.filter((x) => x.fret === barreFret);
  if (atBarreFret.length < 2) return null; // nothing to gain from a barre

  const fromString = Math.min(...atBarreFret.map((x) => x.string));
  const toString = Math.max(...atBarreFret.map((x) => x.string));

  for (let i = fromString; i <= toString; i += 1) {
    if (frets[i] === 0) return null; // the barre would stop this open string
    if (typeof frets[i] === 'number' && frets[i] < barreFret) return null;
  }

  const fingers = frets.map(() => null);
  for (let i = fromString; i <= toString; i += 1) {
    if (frets[i] === barreFret) fingers[i] = 1;
  }

  // Anything above the barre needs its own finger, in ascending fret order.
  const above = fretted
    .filter((x) => x.fret > barreFret)
    .sort((a, b) => a.fret - b.fret || a.string - b.string);

  let next = 2;
  let previousFret = null;
  let previousFinger = null;
  for (const { string, fret } of above) {
    // Two strings at the same fret, side by side, can share one finger laid
    // flat across them.
    if (
      previousFret === fret &&
      previousFinger !== null &&
      Math.abs(string - lastStringOf(fingers, previousFinger)) === 1
    ) {
      fingers[string] = previousFinger;
      continue;
    }
    if (next > MAX_FINGERS) return null;
    fingers[string] = next;
    previousFret = fret;
    previousFinger = next;
    next += 1;
  }

  // Any fretted string at the barre fret outside the barre span still needs
  // covering, which the index finger cannot reach.
  for (const { string, fret } of fretted) {
    if (fret === barreFret && fingers[string] === null) return null;
  }

  const used = new Set(fingers.filter((f) => f !== null));
  if (used.size > MAX_FINGERS) return null;
  void config;

  return {
    fingers,
    barre: { fret: barreFret, fromString, toString, finger: 1 },
    fingerCount: used.size,
    span,
    lowestFret: barreFret,
  };
}

function lastStringOf(fingers, finger) {
  for (let i = fingers.length - 1; i >= 0; i -= 1) {
    if (fingers[i] === finger) return i;
  }
  return -1;
}

/**
 * Check that a hand is physically possible. Used as a property assertion in
 * tests: no fingering the search emits may ever fail this.
 *
 * @returns {string|null} a reason, or null when the hand is fine
 */
export function handProblem(frets, hand) {
  if (!hand) return 'no hand';
  const { fingers, barre } = hand;

  const fretOfFinger = new Map();
  for (let i = 0; i < fingers.length; i += 1) {
    const finger = fingers[i];
    if (finger === null) {
      if (typeof frets[i] === 'number' && frets[i] > 0) {
        return `string ${i} is fretted but has no finger`;
      }
      continue;
    }
    if (typeof frets[i] !== 'number' || frets[i] === 0) {
      return `string ${i} has a finger but is not fretted`;
    }
    if (fretOfFinger.has(finger) && fretOfFinger.get(finger) !== frets[i]) {
      return `finger ${finger} is on two different frets`;
    }
    fretOfFinger.set(finger, frets[i]);
  }

  if (fretOfFinger.size > MAX_FINGERS) return 'more than four fingers';

  // A higher-numbered finger must not sit below a lower-numbered one.
  const entries = [...fretOfFinger.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i][1] < entries[i - 1][1]) {
      return `finger ${entries[i][0]} sits below finger ${entries[i - 1][0]}`;
    }
  }

  if (barre) {
    if (barre.fret !== Math.min(...entries.map((e) => e[1]))) {
      return 'barre is not at the lowest fretted fret';
    }
    for (let i = barre.fromString; i <= barre.toString; i += 1) {
      if (frets[i] === 0) return `open string ${i} lies inside the barre`;
    }
  }

  return null;
}
