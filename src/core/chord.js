/**
 * The canonical chord model (docs/DESIGN.md §4.2).
 *
 * A Chord here is notation-dialect-free: it knows it has a major 7th, not that
 * anyone writes that `7M`, `maj7` or `∆7`. Dialect is purely an input and
 * display concern (§4.4), which is what lets a shared link written in one
 * notation read correctly in another.
 *
 * Synchronous and free of I/O, like everything in core/ (§3.2).
 */

import { fault } from './errors.js';

import {
  degreeToInterval,
  transposeNote,
  pitchClass,
  formatNote,
  sameNote,
} from './pitch.js';

/**
 * @typedef {{ degree: number, alter: number }} Extension
 *
 * @typedef {object} Chord
 * @property {import('./pitch.js').SpelledNote} root
 * @property {string} quality
 * @property {Extension[]} extensions
 * @property {import('./pitch.js').SpelledNote|null} bass  slash-chord bass
 *
 * @typedef {object} ChordTone
 * @property {number} degree
 * @property {number} alter
 * @property {import('./pitch.js').SpelledNote} spelled
 * @property {number} pitchClass
 * @property {ToneRole} role
 *
 * @typedef {'root'|'third'|'fifth'|'seventh'|'extension'} ToneRole
 */

/**
 * Base triads and dyads, as degree/alter specs.
 *
 * `sus2` and `sus4` deliberately have no third — the suspension replaces it.
 * The "3rd required" heuristic (§5.2) is therefore vacuous for them, which is
 * the behaviour we want, and falls out of the model rather than needing a
 * special case.
 */
export const QUALITIES = {
  major: [{ degree: 1 }, { degree: 3 }, { degree: 5 }],
  minor: [{ degree: 1 }, { degree: 3, alter: -1 }, { degree: 5 }],
  dim: [{ degree: 1 }, { degree: 3, alter: -1 }, { degree: 5, alter: -1 }],
  aug: [{ degree: 1 }, { degree: 3 }, { degree: 5, alter: 1 }],
  sus2: [{ degree: 1 }, { degree: 2 }, { degree: 5 }],
  sus4: [{ degree: 1 }, { degree: 4 }, { degree: 5 }],
  power: [{ degree: 1 }, { degree: 5 }],
};

/**
 * A tone's harmonic role, which is what the voicing heuristics operate on:
 * "the 5th may be omitted" (§5.2) is a statement about role, not about a
 * semitone count.
 *
 * @param {number} degree @returns {ToneRole}
 */
export function roleForDegree(degree) {
  switch (degree) {
    case 1:
      return 'root';
    case 3:
      return 'third';
    case 5:
      return 'fifth';
    case 7:
      return 'seventh';
    default:
      return 'extension';
  }
}

/** Normalise an extension spec, filling in a default alteration. */
function normaliseExtension(ext) {
  const degree = ext.degree;
  if (!Number.isInteger(degree) || degree < 1) {
    throw fault('badDegree', { degree }, `Bad extension degree: ${degree}`);
  }
  const alter = ext.alter ?? 0;
  if (!Number.isInteger(alter) || alter < -2 || alter > 2) {
    throw fault('badAlteration', { alter }, `Bad extension alteration: ${alter}`);
  }
  return { degree, alter };
}

/**
 * Build a Chord.
 *
 * @param {import('./pitch.js').SpelledNote} root
 * @param {string} quality  a key of QUALITIES
 * @param {Array<{degree:number, alter?:number}>} [extensions]
 * @param {import('./pitch.js').SpelledNote|null} [bass]
 * @returns {Chord}
 */
export function chord(root, quality = 'major', extensions = [], bass = null) {
  if (!(quality in QUALITIES)) {
    throw fault('unknownQuality', { quality }, `Unknown chord quality: ${quality}`);
  }
  return {
    root,
    quality,
    extensions: extensions.map(normaliseExtension),
    bass: bass ?? null,
  };
}

/**
 * Resolve a chord to its tones, spelled correctly and tagged with roles.
 *
 * An extension replaces a base tone of the same degree, so `m7b5` alters the
 * fifth rather than sounding both a natural and a flat one.
 *
 * @param {Chord} c @returns {ChordTone[]}
 */
export function chordTones(c) {
  const byDegree = new Map();
  for (const spec of QUALITIES[c.quality]) {
    byDegree.set(spec.degree, { degree: spec.degree, alter: spec.alter ?? 0 });
  }
  for (const ext of c.extensions) {
    byDegree.set(ext.degree, { degree: ext.degree, alter: ext.alter });
  }

  return [...byDegree.values()]
    .sort((a, b) => a.degree - b.degree)
    .map(({ degree, alter }) => {
      const spelled = transposeNote(c.root, degreeToInterval(degree, alter));
      return {
        degree,
        alter,
        spelled,
        pitchClass: pitchClass(spelled),
        role: roleForDegree(degree),
      };
    });
}

/**
 * The distinct pitch classes a chord contains.
 * Two tones can collide (a #11 and a b5 are the same sound); the set is what
 * the fingering search matches against.
 *
 * @param {Chord} c @returns {Set<number>}
 */
export function chordPitchClasses(c) {
  return new Set(chordTones(c).map((t) => t.pitchClass));
}

/**
 * The note that must sound lowest: the slash bass if there is one, else the
 * root. The search uses this for the "root in bass" rule (§5.2).
 *
 * @param {Chord} c @returns {import('./pitch.js').SpelledNote}
 */
export function bassNote(c) {
  return c.bass ?? c.root;
}

/** True when a slash bass is present and is not just the root respelled. */
export function hasDistinctBass(c) {
  return c.bass !== null && !sameNote(c.bass, c.root);
}

/** Find a tone by role, or undefined. */
export function toneWithRole(c, role) {
  return chordTones(c).find((t) => t.role === role);
}

/** @param {Chord} c @returns {string} a debug string, not a display name */
export function describeChordTones(c) {
  return chordTones(c)
    .map((t) => formatNote(t.spelled))
    .join(' ');
}

/** Structural equality, used by tests and the URL codec. */
export function sameChord(a, b) {
  if (!sameNote(a.root, b.root)) return false;
  if (a.quality !== b.quality) return false;
  if ((a.bass === null) !== (b.bass === null)) return false;
  if (a.bass && b.bass && !sameNote(a.bass, b.bass)) return false;
  const key = (list) =>
    [...list]
      .map((e) => `${e.degree}:${e.alter}`)
      .sort()
      .join(',');
  return key(a.extensions) === key(b.extensions);
}
