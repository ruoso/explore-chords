/**
 * Resolving a song's voicings: what was chosen, or a sensible default.
 *
 * A teacher writing out a song should only have to choose voicings for the
 * chords that are not obvious. For the rest, the default is the shape the
 * explorer would show first — open position if there is one, otherwise the
 * easiest shape in the lowest position that has any. Since the result groups
 * are already ordered open-first with empty groups skipped, that is simply the
 * first shape of the first group.
 *
 * Defaults are derived here, never written into the song text. Writing them in
 * would fill `# Voicings` with shapes nobody chose and hide the ones somebody
 * did.
 *
 * Pure and synchronous, like everything in core/ (docs/DESIGN.md §3.2).
 */

import { parseChord } from './notation/parse.js';
import { searchFingerings, fingeringFromFrets } from './search.js';

/**
 * @typedef {object} ResolvedVoicing
 * @property {'chosen'|'default'} source
 * @property {import('./search.js').Fingering} fingering
 */

/**
 * The shape a chord gets when nobody has chosen one.
 * @returns {import('./search.js').Fingering|null} null if nothing is playable
 */
export function defaultVoicing(chord, instrument) {
  const result = searchFingerings(chord, instrument);
  return result.groups[0]?.fingerings[0] ?? null;
}

/**
 * Every voicing key the chart uses, resolved to a fingering.
 *
 * A key the text defines is `chosen`; a valid chord with no entry falls back
 * to the `default`. A chord the search cannot voice at all is simply absent, as
 * is one that does not parse — the caller reports those separately.
 *
 * @param {import('./song.js').ParsedSong} parsed
 * @param {object} instrument
 * @param {string} [dialect]
 * @returns {Map<string, ResolvedVoicing>}  key -> resolution, in chart order
 */
export function resolveSongVoicings(parsed, instrument, dialect) {
  /** @type {Map<string, ResolvedVoicing>} */
  const out = new Map();
  /** @type {Map<string, import('./search.js').Fingering|null>} */
  const defaultsBySymbol = new Map();

  for (const chord of parsed.occurrences) {
    if (out.has(chord.key) || !chord.valid) continue;
    const parsedChord = parseChord(chord.symbol, dialect).chord;
    if (!parsedChord) continue;

    const frets = parsed.voicings.get(chord.key);
    if (frets) {
      const fingering = fingeringFromFrets(frets, parsedChord, instrument);
      if (fingering) out.set(chord.key, { source: 'chosen', fingering });
      continue;
    }

    // Any key without an entry — the bare symbol, or a hand-written footnote
    // nothing defines — gets the symbol's default. Computed once per symbol.
    if (!defaultsBySymbol.has(chord.symbol)) {
      defaultsBySymbol.set(chord.symbol, defaultVoicing(parsedChord, instrument));
    }
    const fingering = defaultsBySymbol.get(chord.symbol);
    if (fingering) out.set(chord.key, { source: 'default', fingering });
  }

  return out;
}

/** Keys that resolved to nothing at all: valid chords the search cannot voice. */
export function unvoiceableKeys(parsed, resolved) {
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key) || !chord.valid || resolved.has(chord.key)) continue;
    seen.add(chord.key);
    out.push(chord.key);
  }
  return out;
}
