/**
 * A song written as text.
 *
 * The whole chart is one block of text, the way a musician writes it out:
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
const VOICING_LINE = /^\s*([^\s=[\]]+)(?:\[(\d+)\])?\s*=\s*(\S+)\s*$/;
const CHORD_TOKEN = /^(.*?)(?:\[(\d+)\])?$/;

export const VOICINGS_SECTION = 'Voicings';

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
      if (VOICINGS_HEADING.test(name)) {
        flush();
        current = { name: '', lines: [] };
        inVoicings = true;
        voicingsRange = { start: lineStart, end: source.length };
        continue;
      }
      if (inVoicings) {
        // A heading after the voicings block ends it.
        voicingsRange.end = lineStart;
        inVoicings = false;
      }
      flush();
      current = { name, lines: [] };
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
  flush();

  return { sections, voicings, occurrences, symbols, unknown, voicingsRange, problems };
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
 * Choose the voicing for one occurrence, returning the new song text.
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
 * @param {number} offset  the `start` of the occurrence being changed
 * @param {(number|'x')[]|null} frets  null clears the choice
 * @param {string} [dialect]
 * @returns {string}
 */
export function setVoicing(text, offset, frets, dialect) {
  const parsed = parseSong(text, dialect);

  const target = parsed.occurrences.find((chord) => chord.start === offset);
  if (!target) return text;

  // What each occurrence resolves to, with this one change applied.
  //
  // Clearing removes the *entry*, not just this occurrence's link to it: every
  // occurrence sharing the key loses it. Otherwise clearing one of two chords
  // that share a voicing would appear to do nothing, because the other would
  // keep the entry alive and both point at it.
  const resolved = parsed.occurrences.map((chord) => {
    if (frets === null && chord.key === target.key) return null;
    if (chord.start === offset) return frets;
    return voicingFor(parsed, chord);
  });

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

/** Replace (or append) the voicings block to match the chart. */
function writeVoicingsBlock(text, bySymbol, dialect) {
  const parsed = parseSong(text, dialect);

  const lines = [];
  for (const [symbol, patterns] of bySymbol) {
    patterns.forEach((pattern, i) => {
      lines.push(`${keyFor(symbol, i + 1)} = ${shorthandOf(pattern)}`);
    });
  }

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

/** Each distinct voicing key used by the chart, with its pattern. */
export function songLegend(parsed) {
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key)) continue;
    seen.add(chord.key);
    const frets = parsed.voicings.get(chord.key);
    if (frets) out.push({ key: chord.key, symbol: chord.symbol, frets });
  }
  return out;
}

/** Chart chords with no voicing chosen, by key. */
export function unvoicedKeys(parsed) {
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key) || parsed.voicings.has(chord.key) || !chord.valid) continue;
    seen.add(chord.key);
    out.push(chord.key);
  }
  return out;
}
