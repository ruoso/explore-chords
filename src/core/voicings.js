/**
 * Resolving a song's voicings on one instrument: what was chosen, or a default.
 *
 * A teacher writing out a song should only have to choose voicings for the
 * chords that are not obvious. For the rest, the default is the shape the
 * explorer would show first — open position if there is one, otherwise the
 * easiest shape in the lowest position that has any. Since the result groups
 * are already ordered open-first with empty groups skipped, that is simply the
 * first shape of the first group.
 *
 * Choices are read from the song's block for the instrument's tuning; on an
 * instrument with no block yet, everything is a default. Defaults are derived
 * here, never written into the song text: writing them in would fill the
 * voicings with shapes nobody chose and hide the ones somebody did.
 *
 * Pure and synchronous, like everything in core/ (docs/DESIGN.md §3.2).
 */

import { parseChord } from './notation/parse.js';
import { sameChord } from './chord.js';
import { searchFingerings, fingeringFromFrets } from './search.js';
import { shorthandOf } from './fretstring.js';
import { parseSong, voicingsFor, setVoicingForKey } from './song.js';
import { formatTuning } from './instrument.js';

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
 * Every voicing key the chart uses, resolved to a fingering on this instrument.
 *
 * A key the instrument's block defines is `chosen`; a valid chord without one
 * falls back to the `default`. A chord the search cannot voice at all is
 * absent, as is one that does not parse — the caller reports those separately.
 *
 * @param {import('./song.js').ParsedSong} parsed
 * @param {object} instrument
 * @param {string} [dialect]
 * @returns {Map<string, ResolvedVoicing>}  key -> resolution, in chart order
 */
export function resolveSongVoicings(parsed, instrument, dialect) {
  const chosen = voicingsFor(parsed, formatTuning(instrument.strings));
  /** @type {Map<string, ResolvedVoicing>} */
  const out = new Map();
  /** @type {Map<string, import('./search.js').Fingering|null>} */
  const defaultsBySymbol = new Map();

  for (const chord of parsed.occurrences) {
    if (out.has(chord.key) || !chord.valid) continue;
    const parsedChord = parseChord(chord.symbol, dialect).chord;
    if (!parsedChord) continue;

    const frets = chosen.get(chord.key);
    if (frets) {
      const fingering = fingeringFromFrets(frets, parsedChord, instrument);
      if (fingering) out.set(chord.key, { source: 'chosen', fingering });
      continue;
    }

    // Any key without an entry — the bare symbol, or a footnote this tuning
    // does not define — gets the symbol's default. Computed once per symbol.
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

/**
 * Write saved shapes into a song for chords that have just entered it.
 *
 * A shape starred in the library is "how I play this chord", so when that
 * chord first appears in a song it gets that shape without being asked — but
 * only if it differs from the default, since the default already shows it,
 * and only for the bare slot, never over a choice already made. A footnoted
 * variant is a deliberate second way of playing the chord and is left alone.
 *
 * Written into the text rather than preferred at render time, so a shared
 * song reads the same for someone who has no such favourite.
 *
 * @param {string} text
 * @param {object} options
 * @param {string[]} options.symbols   chart symbols that are new to this song
 * @param {{chordText:string, frets:(number|'x')[]}[]} options.favorites  newest first
 * @param {object} options.instrument
 * @param {string} [options.dialect]
 * @returns {string}
 */
export function applySavedVoicings(text, { symbols, favorites, instrument, dialect }) {
  if (!symbols?.length || !favorites?.length) return text;
  const tuning = formatTuning(instrument.strings);
  let out = text;

  for (const symbol of new Set(symbols)) {
    const parsed = parseSong(out, dialect);
    if (!parsed.occurrences.some((c) => c.key === symbol)) continue; // not a bare key in the chart
    if (voicingsFor(parsed, tuning).has(symbol)) continue; // already chosen

    const chord = parseChord(symbol, dialect).chord;
    if (!chord) continue;

    const fallback = defaultVoicing(chord, instrument);
    const saved = favorites.find((f) => {
      const theirs = parseChord(f.chordText, dialect).chord;
      if (!theirs || !sameChord(theirs, chord)) return false;
      if (f.frets.length !== instrument.strings.length) return false;
      return !fallback || shorthandOf(f.frets) !== fallback.shorthand;
    });
    if (!saved) continue;

    out = setVoicingForKey(out, symbol, saved.frets, { tuning, dialect });
  }

  return out;
}
