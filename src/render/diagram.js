/**
 * Shared diagram geometry and description (docs/DESIGN.md §6, §6.1).
 *
 * Both renderers work from the same model, so left-handed mirroring and
 * orientation are coordinate decisions rather than a second code path.
 *
 * The geometry we compute here is also exactly what a screen reader needs, so a
 * diagram can describe itself. That is what makes accessibility affordable —
 * and why it is a constraint from this phase onward rather than a retrofit.
 */

import { formatChord } from '../core/notation/format.js';
import { DIFFICULTY_LABELS } from '../core/score.js';

/** Fret rows drawn in a chord box. A 4-fret span needs 4; 5 leaves air. */
export const FRETS_SHOWN = 5;

/**
 * @typedef {object} DiagramOptions
 * @property {'vertical'|'horizontal'} [orientation]
 * @property {'right'|'left'} [handed]
 * @property {number} [size]  scale multiplier
 */

export const DEFAULT_OPTIONS = {
  orientation: 'vertical',
  handed: 'right',
  size: 1,
};

/**
 * Turn a fingering into positions to draw.
 *
 * String indices in the model are *display* indices: left-handed mirroring is
 * applied once, here, so neither renderer has to think about it.
 */
export function diagramModel(fingering, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const stringCount = fingering.frets.length;
  const fretted = fingering.frets.filter((f) => typeof f === 'number' && f > 0);

  // Start at the nut unless the shape sits too high to show from there.
  const highest = fretted.length ? Math.max(...fretted) : 0;
  const lowest = fretted.length ? Math.min(...fretted) : 0;
  const startFret = highest <= FRETS_SHOWN - 1 ? 1 : lowest;
  const showNut = startFret === 1;

  const display = (i) => (opts.handed === 'left' ? stringCount - 1 - i : i);

  const dots = [];
  const markers = [];
  for (let i = 0; i < stringCount; i += 1) {
    const fret = fingering.frets[i];
    const stringIndex = display(i);
    if (fret === 'x') {
      markers.push({ stringIndex, kind: 'muted' });
    } else if (fret === 0) {
      markers.push({ stringIndex, kind: 'open' });
    } else {
      const inBarre =
        fingering.barre &&
        fret === fingering.barre.fret &&
        i >= fingering.barre.fromString &&
        i <= fingering.barre.toString;
      if (!inBarre) {
        dots.push({ stringIndex, fret, finger: fingering.fingers[i], row: fret - startFret });
      }
    }
  }

  let barre = null;
  if (fingering.barre) {
    const a = display(fingering.barre.fromString);
    const b = display(fingering.barre.toString);
    barre = {
      fret: fingering.barre.fret,
      row: fingering.barre.fret - startFret,
      fromString: Math.min(a, b),
      toString: Math.max(a, b),
      finger: fingering.barre.finger,
    };
  }

  return {
    stringCount,
    fretsShown: FRETS_SHOWN,
    startFret,
    showNut,
    dots,
    barre,
    markers,
    orientation: opts.orientation,
    handed: opts.handed,
    size: opts.size,
  };
}

/** Strings are numbered from the highest-pitched: on a guitar, low E is 6. */
export function stringNumber(index, stringCount) {
  return stringCount - index;
}

const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];

function ordinal(n) {
  return ORDINALS[n] ?? `${n}th`;
}

/**
 * A sentence describing a fingering, used as the diagram's `aria-label`.
 *
 * Example: "C major, x32010, open position, fingers 3-2-1, root on the 5th
 * string." Everything a sighted reader gets from the picture.
 */
export function describeFingering(fingering, { chord, dialect, instrument } = {}) {
  const parts = [];

  if (chord) parts.push(formatChord(chord, dialect));
  parts.push(fingering.shorthand);

  parts.push(fingering.position === 0 ? 'open position' : `starting at fret ${fingering.position}`);

  if (fingering.barre) {
    const count = fingering.barre.toString - fingering.barre.fromString + 1;
    parts.push(`barre across ${count} strings at fret ${fingering.barre.fret}`);
  }

  const used = fingering.fingers.filter((f) => f !== null);
  if (used.length > 0) parts.push(`fingers ${used.join('-')}`);

  const muted = fingering.frets.filter((f) => f === 'x').length;
  if (muted > 0) parts.push(`${muted} string${muted === 1 ? '' : 's'} not played`);

  if (chord && instrument) {
    const rootIndex = lowestRootString(fingering, chord, instrument);
    if (rootIndex !== -1) {
      parts.push(
        `root on the ${ordinal(stringNumber(rootIndex, fingering.frets.length))} string`
      );
    }
  }

  if (fingering.difficulty) {
    parts.push(`${DIFFICULTY_LABELS[fingering.difficulty].toLowerCase()} to play`);
  }

  return `${parts.join(', ')}.`;
}

function lowestRootString(fingering, chord, instrument) {
  void instrument;
  const rootPc = chordRootPitchClass(chord);
  let best = -1;
  let bestMidi = Infinity;
  for (let i = 0; i < fingering.midis.length; i += 1) {
    const midi = fingering.midis[i];
    if (midi === null) continue;
    if ((((midi % 12) + 12) % 12) === rootPc && midi < bestMidi) {
      bestMidi = midi;
      best = i;
    }
  }
  return best;
}

function chordRootPitchClass(chord) {
  const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (((NATURAL[chord.root.letter] + chord.root.accidental) % 12) + 12) % 12;
}

/** Escape text for inclusion in an SVG attribute or text node. */
export function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
