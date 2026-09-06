/**
 * Voicing heuristics (docs/DESIGN.md §2.4, §5.2, §5.4).
 *
 * These belong to an instrument instance, not to the app: a bass and a ukulele
 * want permanently different rules, and a global "bass mode" you have to
 * remember to switch is the wrong model.
 *
 * Every rule here is a toggle and every cost a number, both exposed in the
 * expert panel.
 */

/** Difficulty costs. Defaults are a starting guess pending calibration (§11). */
export const DEFAULT_WEIGHTS = {
  spanPerFret: 1.0, // per fret of stretch beyond the first
  barre: 1.5,
  fullBarre: 1.0, // additional, when the barre spans every string
  perFinger: 0.4,
  innerMute: 3.0, // a muted string between two sounding ones
  positionPerFret: 0.1,
  omittedFifth: 0.3, // musical completeness, not difficulty
  rootless: 0.6,
  nonRootBass: 0.8, // an inversion when none was asked for
  openString: -0.5, // a bonus: open strings make a shape easier
  nonAdjacentStretch: 0.5,
};

/**
 * @typedef {object} HeuristicConfig
 * @property {number} maxSpan          frets a hand may stretch across
 * @property {boolean} requireRoot
 * @property {boolean} rootInBass      lowest sounding pitch must be the bass
 * @property {boolean} requireThird
 * @property {boolean} omitFifth       a perfect 5th may be dropped
 * @property {boolean} allowRootless
 * @property {boolean} requireExtensions
 * @property {boolean} allowDoubling
 * @property {boolean} allowDuplicatePitch
 * @property {boolean} allowInnerMutes
 * @property {boolean} allowThumb
 * @property {boolean} allowBarre
 * @property {number} minSoundingStrings
 * @property {number} maxResultsPerGroup
 * @property {typeof DEFAULT_WEIGHTS} weights
 */

/** @type {HeuristicConfig} */
export const STANDARD = {
  maxSpan: 4,
  requireRoot: true,
  rootInBass: true,
  requireThird: true,
  omitFifth: true,
  allowRootless: false,
  requireExtensions: true,
  allowDoubling: true,
  // Left ON by default, unlike the reference which forbade it. A standard
  // re-entrant ukulele cannot play F major (2010) without sounding A4 on two
  // strings; forbidding duplicates would reject the most common chord shape on
  // the instrument. It is an aesthetic preference, not a playability rule.
  allowDuplicatePitch: true,
  allowInnerMutes: false,
  allowThumb: false,
  allowBarre: true,
  minSoundingStrings: 3,
  maxResultsPerGroup: 6,
  weights: { ...DEFAULT_WEIGHTS },
};

export const PRESETS = {
  beginner: {
    ...STANDARD,
    maxSpan: 3,
    allowBarre: false,
    allowInnerMutes: false,
    omitFifth: true,
    requireExtensions: false,
    weights: { ...DEFAULT_WEIGHTS, openString: -1.0, barre: 4.0 },
  },
  standard: { ...STANDARD },
  jazz: {
    ...STANDARD,
    allowRootless: true,
    allowInnerMutes: true,
    rootInBass: false,
    minSoundingStrings: 3,
    weights: { ...DEFAULT_WEIGHTS, rootless: 0.2, innerMute: 1.0, nonRootBass: 0.2 },
  },
  bassFriendly: {
    ...STANDARD,
    requireThird: false,
    requireExtensions: false,
    minSoundingStrings: 2,
    maxSpan: 4,
    weights: { ...DEFAULT_WEIGHTS, perFinger: 0.8 },
  },
};

export const PRESET_IDS = Object.keys(PRESETS);

export const PRESET_LABELS = {
  beginner: 'Beginner',
  standard: 'Standard',
  jazz: 'Jazz',
  bassFriendly: 'Bass-friendly',
};

/** A fresh, mutable copy of a named preset. */
export function presetConfig(id = 'standard') {
  const preset = PRESETS[id];
  if (!preset) throw new Error(`Unknown heuristics preset: ${id}`);
  return { ...preset, preset: id, weights: { ...preset.weights } };
}

/** Merge overrides onto a preset, marking the result as custom if it differs. */
export function withOverrides(config, overrides = {}) {
  const merged = {
    ...config,
    ...overrides,
    weights: { ...config.weights, ...(overrides.weights ?? {}) },
  };
  const base = PRESETS[config.preset] ?? STANDARD;
  merged.preset = differsFrom(merged, base) ? 'custom' : config.preset;
  return merged;
}

function differsFrom(config, base) {
  for (const key of Object.keys(base)) {
    if (key === 'weights') continue;
    if (config[key] !== base[key]) return true;
  }
  for (const key of Object.keys(base.weights)) {
    if (config.weights[key] !== base.weights[key]) return true;
  }
  return false;
}

/**
 * Which chord tone roles may be left out, given a configuration.
 * "The 5th may be omitted" is a statement about role, not a semitone count.
 */
export function optionalRoles(config) {
  const optional = new Set();
  if (config.omitFifth) optional.add('fifth');
  if (config.allowRootless) optional.add('root');
  if (!config.requireThird) optional.add('third');
  if (!config.requireExtensions) optional.add('extension');
  return optional;
}
