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
  perFinger: 0.3,
  // Zero, because a mute the search emits is a forced one: a string is muted
  // only when nothing it could sound belongs to the chord (core/search.js).
  // Damping it costs a fingerstyle player nothing, so it is not a difficulty.
  // A strummer, whose picking hand crosses the gap, can raise this.
  innerMute: 0,
  // Every string not sounding is a thinner chord, which is a musical cost
  // rather than a difficulty: it is what ranks a four-string voicing below the
  // six-string one when a player could have either.
  mutedString: 0.6,
  positionPerFret: 0.1,
  omittedFifth: 0.8, // musical completeness, not difficulty
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
 * @property {boolean} allowBarre
 * @property {number} minSoundingStrings
 * @property {number} maxResultsPerGroup
 * @property {typeof DEFAULT_WEIGHTS} weights
 */

/**
 * The rules for a player whose picking hand hits several strings at once.
 *
 * This is the baseline every other preset is a variation on, and it is named
 * for what it assumes rather than called "standard": the one rule that really
 * separates it from fingerstyle is that a strummed chord cannot have a hole in
 * the middle of it.
 *
 * @type {HeuristicConfig}
 */
export const STRUMMING = {
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
  // A strumming hand crosses every string between the lowest and the highest,
  // so a gap in the middle is a string it has to damp deliberately.
  allowInnerMutes: false,
  allowBarre: true,
  minSoundingStrings: 3,
  maxResultsPerGroup: 6,
  weights: { ...DEFAULT_WEIGHTS },
};

export const PRESETS = {
  beginner: {
    ...STRUMMING,
    maxSpan: 3,
    allowBarre: false,
    allowInnerMutes: false,
    omitFifth: true,
    requireExtensions: false,
    weights: { ...DEFAULT_WEIGHTS, openString: -1.0, barre: 4.0 },
  },
  strumming: { ...STRUMMING },
  // Fingerstyle differs by one rule, and it is the rule the whole distinction
  // rests on: a hand that picks strings individually simply does not pick the
  // one in the middle, so a chord may have a hole in it. Everything else it
  // inherits, because the fretting hand does the same work either way.
  fingerstyle: {
    ...STRUMMING,
    allowInnerMutes: true,
  },
  jazz: {
    ...STRUMMING,
    allowRootless: true,
    allowInnerMutes: true,
    rootInBass: false,
    minSoundingStrings: 3,
    weights: { ...DEFAULT_WEIGHTS, rootless: 0.2, nonRootBass: 0.2 },
  },
  bassFriendly: {
    ...STRUMMING,
    requireThird: false,
    requireExtensions: false,
    minSoundingStrings: 2,
    maxSpan: 4,
    weights: { ...DEFAULT_WEIGHTS, perFinger: 0.8 },
  },
};

export const PRESET_IDS = Object.keys(PRESETS);

/**
 * Presets that have been renamed.
 *
 * "Standard" became "Strumming" once fingerstyle got a preset of its own:
 * neither is the standard one, they are two ways of playing. Instruments saved
 * under the old name, and links carrying it, still resolve.
 */
const RENAMED = { standard: 'strumming' };

/** The current id for a preset, whatever it used to be called. */
export function resolvePresetId(id) {
  return RENAMED[id] ?? id;
}

/** A fresh, mutable copy of a named preset. */
export function presetConfig(id = 'strumming') {
  const resolved = resolvePresetId(id);
  const preset = PRESETS[resolved];
  if (!preset) throw new Error(`Unknown heuristics preset: ${id}`);
  return { ...preset, preset: resolved, weights: { ...preset.weights } };
}

/** Merge overrides onto a preset, marking the result as custom if it differs. */
export function withOverrides(config, overrides = {}) {
  const merged = {
    ...config,
    ...overrides,
    weights: { ...config.weights, ...(overrides.weights ?? {}) },
  };
  const base = PRESETS[config.preset] ?? STRUMMING;
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
