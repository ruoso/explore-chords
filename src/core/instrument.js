/**
 * Instruments (docs/DESIGN.md §4.3).
 *
 * The catalog holds templates. What a user actually holds is an *instance*:
 * "Guitar · Standard" and "Guitar · Drop D" are two separate entries, because
 * in practice they are two different things to play.
 *
 * Any comma-separated pitch list defines a valid instance, so arbitrary tunings
 * are first-class rather than an escape hatch. There is deliberately no capo
 * field — a capo raises every open string equally, which a tuning already
 * expresses exactly (§4.3).
 */

import { parsePitch, formatPitch, pitchToMidi } from './pitch.js';
import { fault } from './errors.js';
import { CATALOG as CATALOG_DATA } from '../data/instruments.js';
import { presetConfig } from './heuristics.js';

/** Below this pitch an instrument has a genuine bass register. C3 = MIDI 48. */
const BASS_REGISTER_BELOW = 48;

export const CATALOG = CATALOG_DATA;

/** @returns {object|undefined} */
export function catalogEntry(id) {
  return CATALOG.find((e) => e.id === id);
}

/**
 * Parse a tuning written as "E2, A2, D3, G3, B3, E4".
 * @returns {import('./pitch.js').Pitch[]}
 */
export function parseTuning(text) {
  const parts = String(text)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) throw fault('emptyTuning', {}, 'A tuning needs at least one string.');
  return parts.map(parsePitch);
}

/** @param {import('./pitch.js').Pitch[]} pitches */
export function formatTuning(pitches) {
  return pitches.map(formatPitch).join(', ');
}

let instanceCounter = 0;

/**
 * A unique instance id.
 *
 * The counter alone is not enough: it restarts on every page load, so an
 * instrument built from a shared link would be `inst_1` and collide with the
 * `inst_1` already saved from a previous session. Lookups by id would then find
 * the wrong instrument.
 */
function nextInstanceId() {
  instanceCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `inst_${Date.now().toString(36)}${instanceCounter}${random}`;
}

/**
 * Build an instrument instance.
 *
 * @param {object} options
 * @param {string} [options.id]
 * @param {string} [options.catalogId]
 * @param {string} [options.label]
 * @param {string|import('./pitch.js').Pitch[]} options.strings
 * @param {number} [options.fretCount]
 * @param {object} [options.heuristics]
 */
export function instrumentInstance({
  id,
  catalogId = null,
  label,
  strings,
  fretCount,
  heuristics,
} = {}) {
  const pitches = typeof strings === 'string' ? parseTuning(strings) : strings;
  if (!Array.isArray(pitches) || pitches.length === 0) {
    throw fault('emptyTuning', {}, 'An instrument needs a tuning.');
  }
  const entry = catalogId ? catalogEntry(catalogId) : undefined;
  const resolvedFretCount = fretCount ?? entry?.fretCount ?? 20;

  const instrument = {
    id: id ?? nextInstanceId(),
    catalogId,
    label: label ?? entry?.name ?? 'Custom instrument',
    strings: pitches,
    fretCount: resolvedFretCount,
    heuristics: heuristics ?? presetConfig(defaultPresetFor(catalogId)),
  };

  if (!heuristics) {
    instrument.heuristics.rootInBass = hasBassRegister(instrument);
  }

  return instrument;
}

/**
 * Whether "the root must be the lowest sounding note" is a meaningful rule for
 * this instrument.
 *
 * It is a real constraint on a guitar or a bass. On a ukulele it is not: the
 * standard F shape (2010) sounds C4 lowest, and on a re-entrant tuning the
 * lowest-pitched string is not even the first one. Requiring a root bass there
 * rejects the instrument's most ordinary chords — the same class of mistake as
 * the reference's strictly-ascending rule (§4.3). So the default follows the
 * instrument, which is exactly why heuristics belong to the instrument (§2.4).
 */
export function hasBassRegister(instrument) {
  return Math.min(...openMidis(instrument)) < BASS_REGISTER_BELOW;
}

/**
 * A named preset adjusted for one instrument.
 *
 * Switching to "Jazz" must not silently re-break a ukulele by turning the root
 * bass rule back on, so instrument-derived defaults are reapplied on top of
 * every preset. Use this rather than presetConfig() wherever an instrument is
 * in hand.
 */
export function configFor(instrument, presetId = 'standard') {
  const config = presetConfig(presetId);
  config.rootInBass = config.rootInBass && hasBassRegister(instrument);
  return config;
}

/**
 * Which heuristics preset an instrument starts from. A bass and a ukulele want
 * permanently different rules, so this is a property of the instrument rather
 * than a mode the user has to remember to switch (§2.4).
 */
export function defaultPresetFor(catalogId) {
  if (catalogId === '4bass' || catalogId === '5bass') return 'bassFriendly';
  return 'standard';
}

/** Build an instance from a catalog entry and one of its named tunings. */
export function fromCatalog(catalogId, tuningName) {
  const entry = catalogEntry(catalogId);
  if (!entry) throw new Error(`Unknown instrument: ${catalogId}`);
  const tuning = tuningName
    ? entry.tunings.find((t) => t.name === tuningName)
    : entry.tunings[0];
  if (!tuning) throw new Error(`Unknown tuning "${tuningName}" for ${catalogId}`);
  return instrumentInstance({
    catalogId,
    label: `${entry.name} · ${tuning.name}`,
    strings: tuning.strings,
    fretCount: entry.fretCount,
  });
}

/** Open-string MIDI numbers, lowest string first as written. */
export function openMidis(instrument) {
  return instrument.strings.map(pitchToMidi);
}

/** MIDI number sounded by a string at a fret. */
export function midiAt(instrument, stringIndex, fret) {
  return pitchToMidi(instrument.strings[stringIndex]) + fret;
}

/**
 * True when the open strings are not in ascending pitch order — a standard
 * ukulele, for instance.
 *
 * The reference rejected any voicing whose sounding pitches did not strictly
 * ascend, which is roughly right for a guitar but makes a re-entrant ukulele
 * produce almost nothing. This app applies no cross-string pitch ordering rule
 * at all; playability is decided by whether a hand can actually make the shape
 * (fingers.js) and by the bass rule, which are the constraints that are
 * genuinely real.
 */
export function isReentrant(instrument) {
  const midis = openMidis(instrument);
  return midis.some((m, i) => i > 0 && m < midis[i - 1]);
}

export function stringCount(instrument) {
  return instrument.strings.length;
}
