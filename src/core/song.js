/**
 * A song written as text.
 *
 * The whole chart is one block of text, the way a musician writes it out:
 *
 *     # Tuning
 *     E2, A2, D3, G3, B3, E4
 *
 *     # Verse
 *     A | Cm | A | Cm[2]
 *
 *     # Voicings
 *     A = x02220
 *     Cm = x35543
 *     Cm[2] = 8-10-10-8-8-8
 *
 * A line starting with `#` names a section. Every other line is a line of the
 * chart: a vertical bar separates measures, spaces separate chords inside one
 * measure.
 *
 * The tuning is part of the song because the voicings are fret patterns, which
 * mean nothing without it — a six-string shape on a ukulele is not a different
 * chord, it is not a chord at all. Recording it is what lets the app tell a
 * guitar song from a ukulele one rather than rendering nonsense.
 *
 * A chord may carry a footnote marker when the song plays it more than one way.
 * The bare symbol is the default voicing; `[2]`, `[3]` and so on are the
 * others, defined in a `# Voicings` section. Keeping them in the text means the
 * choices are visible and editable rather than hidden state the app remembers
 * on your behalf.
 *
 * Pure and synchronous, like everything in core/ (docs/DESIGN.md §3.2).
 */

import { parseChord } from './notation/parse.js';
import { shorthandOf, parseShorthand } from './fretstring.js';

const HEADING = /^(\s*)(#+)\s*(.*?)\s*$/;
const VOICINGS_HEADING = /^voicings?$/i;
const TUNING_HEADING = /^tuning$/i;
const VOICING_LINE = /^\s*([^\s=[\]]+)(?:\[(\d+)\])?\s*=\s*(\S+)\s*$/;
const CHORD_TOKEN = /^(.*?)(?:\[(\d+)\])?$/;

export const VOICINGS_SECTION = 'Voicings';
export const TUNING_SECTION = 'Tuning';

/**
 * @typedef {object} ChordRef
 * @property {string} raw      the token as written, marker included
 * @property {string} symbol   the chord symbol alone
 * @property {number|null} index  1 for the bare default, 2+ for a marked one
 * @property {string} key      the voicings-block key: `Cm` or `Cm[2]`
 * @property {boolean} valid   whether the symbol parses
 * @property {number} start    offset of the token in the source text
 * @property {number} end
 *
 * @typedef {object} ParsedSong
 * @property {{name:string, lines:{measures:{chords:ChordRef[]}[]}[]}[]} sections
 * @property {Map<string,(number|'x')[]>} voicings   key -> fret pattern
 * @property {ChordRef[]} occurrences  every chord in the chart, in order
 * @property {string[]} symbols   distinct chord symbols, first-seen order
 * @property {string[]} unknown   symbols that do not parse
 * @property {string|null} tuning   the tuning the song is written for
 * @property {{start:number, end:number}|null} tuningRange
 * @property {{start:number, end:number}|null} voicingsRange  the block's extent
 * @property {string[]} problems  malformed voicing lines
 */

/**
 * @param {string} text
 * @param {string} [dialect]
 * @returns {ParsedSong}
 */
export function parseSong(text, dialect) {
  const source = String(text ?? '');
  const sections = [];
  const voicings = new Map();
  const occurrences = [];
  const symbols = [];
  const unknown = [];
  const problems = [];
  const seen = new Set();

  let voicingsRange = null;
  let inVoicings = false;
  let tuningRange = null;
  let inTuning = false;
  let tuning = null;
  // Anything written before the first heading is still part of the song, so it
  // gets an unnamed section rather than being dropped.
  let current = { name: '', lines: [] };
  let offset = 0;

  const flush = () => {
    if (current.lines.length > 0 || current.name) sections.push(current);
  };

  for (const raw of source.split('\n')) {
    const lineStart = offset;
    offset += raw.length + 1;

    const heading = HEADING.exec(raw);
    if (heading) {
      const name = heading[3];
      if (inVoicings) {
        // A heading after a special block ends it.
        voicingsRange.end = lineStart;
        inVoicings = false;
      }
      if (inTuning) {
        tuningRange.end = lineStart;
        inTuning = false;
      }

      if (VOICINGS_HEADING.test(name)) {
        flush();
        current = { name: '', lines: [] };
        inVoicings = true;
        voicingsRange = { start: lineStart, end: source.length };
        continue;
      }
      if (TUNING_HEADING.test(name)) {
        flush();
        current = { name: '', lines: [] };
        inTuning = true;
        tuningRange = { start: lineStart, end: source.length };
        continue;
      }

      flush();
      current = { name, lines: [] };
      continue;
    }

    if (inTuning) {
      if (raw.trim() === '') continue;
      // The tuning is one line. It must not run on to the next heading, or a
      // chart written straight after it would be swallowed.
      tuning = raw.trim();
      tuningRange.end = offset;
      inTuning = false;
      continue;
    }

    if (inVoicings) {
      if (raw.trim() === '') continue;
      const match = VOICING_LINE.exec(raw);
      const frets = match ? parseShorthand(match[3]) : null;
      if (!match || !frets) {
        problems.push(raw.trim());
        continue;
      }
      const index = match[2] ? Number(match[2]) : 1;
      voicings.set(keyFor(match[1], index), frets);
      continue;
    }

    const line = parseChartLine(raw, lineStart, dialect, seen, symbols, unknown, occurrences);
    if (line) current.lines.push(line);
  }

  if (inVoicings && voicingsRange) voicingsRange.end = source.length;
  if (inTuning && tuningRange) tuningRange.end = source.length;
  flush();

  return {
    sections,
    voicings,
    occurrences,
    symbols,
    unknown,
    voicingsRange,
    problems,
    tuning,
    tuningRange,
  };
}

/**
 * Order voicing entries for reading: alphabetically by chord symbol, with a
 * chord's own footnotes kept together and in numeric order.
 *
 * A plain code-unit comparison rather than localeCompare, so the order is
 * identical everywhere — the same song must not read differently on another
 * machine, and the text is a stored artefact.
 */
export function compareVoicings(a, b) {
  if (a.symbol !== b.symbol) return a.symbol < b.symbol ? -1 : 1;
  return a.index - b.index;
}

/** The voicings-block key for a symbol and index. Index 1 is the bare form. */
export function keyFor(symbol, index) {
  return index > 1 ? `${symbol}[${index}]` : symbol;
}

function parseChartLine(raw, lineStart, dialect, seen, symbols, unknown, occurrences) {
  const measures = [];
  let cursor = 0;

  for (const chunk of raw.split('|')) {
    const chunkStart = cursor;
    cursor += chunk.length + 1;

    const chords = [];
    const wordRe = /\S+/g;
    let match;
    while ((match = wordRe.exec(chunk)) !== null) {
      const tokenStart = lineStart + chunkStart + match.index;
      const token = CHORD_TOKEN.exec(match[0]);
      const symbol = token[1] || match[0];
      const index = token[2] ? Number(token[2]) : 1;
      const valid = Boolean(parseChord(symbol, dialect).chord);

      if (!seen.has(symbol)) {
        seen.add(symbol);
        symbols.push(symbol);
        if (!valid) unknown.push(symbol);
      }

      const chord = {
        raw: match[0],
        symbol,
        index,
        key: keyFor(symbol, index),
        valid,
        start: tokenStart,
        end: tokenStart + match[0].length,
      };
      chords.push(chord);
      occurrences.push(chord);
    }

    // An empty measure means a doubled or trailing bar — a typo, not a bar of
    // silence — so it is dropped rather than rendered blank.
    if (chords.length > 0) measures.push({ chords });
  }

  return measures.length > 0 ? { measures } : null;
}

/** The fret pattern an occurrence resolves to, or null. */
export function voicingFor(parsed, chord) {
  return parsed.voicings.get(chord.key) ?? null;
}

/**
 * Rewrite the song so each occurrence resolves to the pattern given for it.
 *
 * The result is normalised rather than patched, which is what keeps the text
 * tidy over time:
 *
 * - An identical voicing already used for that chord is *reused*, so picking
 *   the same shape twice never creates a second footnote.
 * - Markers are renumbered from how the chord is actually used, so a song whose
 *   chord returns to a single voicing loses its markers again.
 * - Entries nothing refers to are dropped.
 *
 * @param {string} text
 * @param {ParsedSong} parsed
 * @param {((number|'x')[]|null)[]} resolved  one entry per occurrence, in order
 */
function applyResolved(text, parsed, resolved, dialect) {
  // Distinct patterns per symbol, in the order they first appear.
  /** @type {Map<string, (number|'x')[][]>} */
  const bySymbol = new Map();
  parsed.occurrences.forEach((chord, i) => {
    const pattern = resolved[i];
    if (!pattern) return;
    if (!bySymbol.has(chord.symbol)) bySymbol.set(chord.symbol, []);
    const list = bySymbol.get(chord.symbol);
    const shorthand = shorthandOf(pattern);
    if (!list.some((p) => shorthandOf(p) === shorthand)) list.push(pattern);
  });

  // Rewrite the chart tokens, right to left so earlier offsets stay valid.
  let out = text;
  const edits = [];
  parsed.occurrences.forEach((chord, i) => {
    const pattern = resolved[i];
    let index = 1;
    if (pattern) {
      const list = bySymbol.get(chord.symbol) ?? [];
      index = list.findIndex((p) => shorthandOf(p) === shorthandOf(pattern)) + 1;
    }
    const wanted = index > 1 ? `${chord.symbol}[${index}]` : chord.symbol;
    if (wanted !== chord.raw) edits.push({ start: chord.start, end: chord.end, wanted });
  });

  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.wanted + out.slice(edit.end);
  }

  return writeVoicingsBlock(out, bySymbol, dialect);
}

/**
 * Choose the voicing for one occurrence, returning the new song text.
 *
 * @param {string} text
 * @param {number} offset  the `start` of the occurrence being changed
 * @param {(number|'x')[]|null} frets  null clears the choice
 * @param {string} [dialect]
 * @returns {string}
 */
export function setVoicing(text, offset, frets, dialect) {
  const parsed = parseSong(text, dialect);

  const target = parsed.occurrences.find((chord) => chord.start === offset);
  if (!target) return text;

  // Clearing removes the *entry*, not just this occurrence's link to it: every
  // occurrence sharing the key loses it. Otherwise clearing one of two chords
  // that share a voicing would appear to do nothing, because the other would
  // keep the entry alive and both point at it.
  const resolved = parsed.occurrences.map((chord) => {
    if (frets === null && chord.key === target.key) return null;
    if (chord.start === offset) return frets;
    return voicingFor(parsed, chord);
  });

  return applyResolved(text, parsed, resolved, dialect);
}

/**
 * Change one voicing everywhere it is used.
 *
 * The complement of setVoicing: that one repoints a single chord in the chart,
 * this one changes the shape itself, so every occurrence written with that key
 * moves together. Re-voicing a chord across a whole song is otherwise a click
 * per bar.
 *
 * @param {string} text
 * @param {string} key    a voicings-block key: `Cm` or `Cm[2]`
 * @param {(number|'x')[]|null} frets  null clears it everywhere
 * @param {string} [dialect]
 * @returns {string}
 */
export function setVoicingForKey(text, key, frets, dialect) {
  const parsed = parseSong(text, dialect);
  if (!parsed.occurrences.some((chord) => chord.key === key)) return text;

  const resolved = parsed.occurrences.map((chord) =>
    chord.key === key ? frets : voicingFor(parsed, chord)
  );

  return applyResolved(text, parsed, resolved, dialect);
}

/**
 * Write (or replace) the song's tuning, at the top where it can be seen.
 *
 * @param {string} text
 * @param {string} tuning  as written, e.g. "E2, A2, D3, G3, B3, E4"
 * @returns {string}
 */
export function setSongTuning(text, tuning) {
  const parsed = parseSong(text);
  const block = `# ${TUNING_SECTION}\n${tuning}\n`;

  if (parsed.tuningRange) {
    const before = text.slice(0, parsed.tuningRange.start);
    const after = text.slice(parsed.tuningRange.end);
    return `${before}${block}${after.startsWith('\n') ? '' : '\n'}${after}`;
  }
  return `${block}\n${text.replace(/^\s*\n/, '')}`;
}

/**
 * Strip every voicing from a song, keeping the chart.
 *
 * Used when a song is brought to another instrument: the chart still means
 * something there, but fret patterns from six strings do not.
 */
export function clearAllVoicings(text, dialect) {
  const parsed = parseSong(text, dialect);
  return applyResolved(text, parsed, parsed.occurrences.map(() => null), dialect);
}

/**
 * Whether a song was written for this tuning.
 *
 * A song with no recorded tuning is taken to belong wherever it is being read:
 * it was typed by hand, and there is nothing to contradict.
 */
export function songFitsTuning(parsed, tuning) {
  if (!parsed.tuning) return true;
  return normaliseTuning(parsed.tuning) === normaliseTuning(tuning);
}

function normaliseTuning(text) {
  return String(text ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

/** How many places in the chart use one voicing key. */
export function countForKey(parsed, key) {
  return parsed.occurrences.filter((chord) => chord.key === key).length;
}

/** Replace (or append) the voicings block to match the chart. */
function writeVoicingsBlock(text, bySymbol, dialect) {
  const parsed = parseSong(text, dialect);

  // Footnote numbers come from first appearance in the chart, so they are
  // assigned before this point and never disturbed. Only the written order is
  // alphabetical, which is how the block is read rather than how it was built.
  const entries = [];
  for (const [symbol, patterns] of bySymbol) {
    patterns.forEach((pattern, i) => {
      entries.push({ symbol, index: i + 1, pattern });
    });
  }
  const lines = entries
    .sort(compareVoicings)
    .map((e) => `${keyFor(e.symbol, e.index)} = ${shorthandOf(e.pattern)}`);

  const block = lines.length > 0 ? `# ${VOICINGS_SECTION}\n${lines.join('\n')}\n` : '';

  if (parsed.voicingsRange) {
    const before = text.slice(0, parsed.voicingsRange.start);
    const after = text.slice(parsed.voicingsRange.end);
    const joined = `${before.replace(/\s*$/, '')}\n\n${block}${after}`;
    return lines.length > 0 ? joined : `${before.replace(/\s*$/, '')}\n${after}`;
  }

  if (!block) return text;
  return `${text.replace(/\s*$/, '')}\n\n${block}`;
}

/** How many measures the whole song contains. */
export function measureCount(parsed) {
  return parsed.sections.reduce(
    (total, section) => total + section.lines.reduce((n, line) => n + line.measures.length, 0),
    0
  );
}

/**
 * Each distinct voicing the chart uses, alphabetically.
 *
 * This is the legend, on screen and in print, so it is ordered for looking
 * something up rather than by where it happened to appear.
 */
export function songLegend(parsed) {
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key)) continue;
    seen.add(chord.key);
    const frets = parsed.voicings.get(chord.key);
    if (frets) {
      out.push({ key: chord.key, symbol: chord.symbol, index: chord.index, frets });
    }
  }
  return out.sort(compareVoicings);
}

/** Chart chords with no voicing chosen, alphabetically. */
export function unvoicedKeys(parsed) {
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key) || parsed.voicings.has(chord.key) || !chord.valid) continue;
    seen.add(chord.key);
    out.push({ key: chord.key, symbol: chord.symbol, index: chord.index });
  }
  return out.sort(compareVoicings).map((e) => e.key);
}
