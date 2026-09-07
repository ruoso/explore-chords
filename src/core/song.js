/**
 * A song written as text.
 *
 * The whole chart is one block of text, the way a musician writes it out:
 *
 *     # Verse
 *     A | Cm | A | Cm[2]
 *
 *     ---
 *
 *     # Voicings: E2, A2, D3, G3, B3, E4
 *     A = x02220
 *     Cm = x35543
 *     Cm[2] = 8-10-10-8-8-8
 *
 *     # Voicings: G4, C4, E4, A4
 *     Cm = 0333
 *
 * A line starting with `#` names a section. Every other line is a line of the
 * chart: a vertical bar separates measures, spaces separate chords inside one
 * measure. A rule of three dashes ends the chart; the voicings follow it.
 *
 * The chart is the song, and it is the same on every instrument. What differs
 * per instrument is how each chord is fingered, so voicings live in blocks
 * headed by the tuning they are for. A song therefore fits every instrument;
 * on one with no block yet, every chord simply takes its default.
 *
 * A chord may carry a footnote marker when the song plays it more than one
 * way: the bare symbol is variant 1, `[2]`, `[3]` and so on are the others.
 * The marker is an arrangement decision — "this bar uses the second Cm" — and
 * is shared across tunings; each tuning's block says what its second Cm *is*.
 * Keeping all of this in the text means the choices are visible and editable
 * rather than hidden state the app remembers on your behalf.
 *
 * Earlier drafts wrote a `# Tuning` line and an unlabelled `# Voicings` block.
 * `migrateSong` converts either to the form above.
 *
 * Pure and synchronous, like everything in core/ (docs/DESIGN.md §3.2).
 */

import { parseChord } from './notation/parse.js';
import { shorthandOf, parseShorthand } from './fretstring.js';

const HEADING = /^(\s*)(#+)\s*(.*?)\s*$/;
const RULE = /^\s*-{3,}\s*$/;
const VOICINGS_HEADING = /^voicings?\b\s*(?:for\b)?\s*[:\-–(]?\s*(.*?)\)?\s*$/i;
const TUNING_HEADING = /^tuning$/i;
const VOICING_LINE = /^\s*([^\s=[\]]+)(?:\[(\d+)\])?\s*=\s*(\S+)\s*$/;
const CHORD_TOKEN = /^(.*?)(?:\[(\d+)\])?$/;

export const VOICINGS_SECTION = 'Voicings';
export const RULE_LINE = '---';

/**
 * @typedef {object} ChordRef
 * @property {string} raw      the token as written, marker included
 * @property {string} symbol   the chord symbol alone
 * @property {number} index    1 for the bare default, 2+ for a marked one
 * @property {string} key      the voicings-block key: `Cm` or `Cm[2]`
 * @property {boolean} valid   whether the symbol parses
 * @property {number} start    offset of the token in the source text
 * @property {number} end
 *
 * @typedef {object} VoicingBlock
 * @property {string|null} tuning   as written on the heading; null if unlabelled
 * @property {string|null} id       normalised tuning, the lookup key
 * @property {Map<string,(number|'x')[]>} voicings
 * @property {{start:number,end:number}} range
 *
 * @typedef {object} ParsedSong
 * @property {{name:string, lines:{measures:{chords:ChordRef[]}[]}[]}[]} sections
 * @property {VoicingBlock[]} blocks
 * @property {ChordRef[]} occurrences  every chord in the chart, in order
 * @property {string[]} symbols   distinct chord symbols, first-seen order
 * @property {string[]} unknown   symbols that do not parse
 * @property {string[]} problems  malformed voicing lines
 * @property {string|null} legacyTuning   a `# Tuning` line, if present
 * @property {{start:number,end:number}|null} legacyTuningRange
 */

/** Tunings compare by their pitches, not by spacing or case. */
export function normaliseTuning(text) {
  return String(text ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

/**
 * @param {string} text
 * @param {string} [dialect]
 * @returns {ParsedSong}
 */
export function parseSong(text, dialect) {
  const source = String(text ?? '');
  const sections = [];
  const blocks = [];
  const occurrences = [];
  const symbols = [];
  const unknown = [];
  const problems = [];
  const seen = new Set();

  let legacyTuning = null;
  let legacyTuningRange = null;
  /** @type {VoicingBlock|null} */
  let block = null;
  let inTuning = false;
  // Anything written before the first heading is still part of the song, so it
  // gets an unnamed section rather than being dropped.
  let current = { name: '', lines: [] };
  let offset = 0;

  const flush = () => {
    if (current.lines.length > 0 || current.name) sections.push(current);
  };
  const closeBlock = (at) => {
    if (block) {
      block.range.end = at;
      blocks.push(block);
      block = null;
    }
    if (inTuning) {
      legacyTuningRange.end = at;
      inTuning = false;
    }
  };

  for (const raw of source.split('\n')) {
    const lineStart = offset;
    offset += raw.length + 1;

    // A rule ends whatever came before it. It is never a chord.
    if (RULE.test(raw)) {
      closeBlock(lineStart);
      flush();
      current = { name: '', lines: [] };
      continue;
    }

    const heading = HEADING.exec(raw);
    if (heading) {
      const name = heading[3];
      closeBlock(lineStart);

      const voicings = VOICINGS_HEADING.exec(name);
      if (voicings) {
        flush();
        current = { name: '', lines: [] };
        const tuning = voicings[1].trim() || null;
        block = {
          tuning,
          id: tuning ? normaliseTuning(tuning) : null,
          voicings: new Map(),
          range: { start: lineStart, end: source.length },
        };
        continue;
      }
      if (TUNING_HEADING.test(name)) {
        flush();
        current = { name: '', lines: [] };
        inTuning = true;
        legacyTuningRange = { start: lineStart, end: source.length };
        continue;
      }

      flush();
      current = { name, lines: [] };
      continue;
    }

    if (inTuning) {
      if (raw.trim() === '') continue;
      // One line only; a chart written straight after it must not be swallowed.
      legacyTuning = raw.trim();
      legacyTuningRange.end = offset;
      inTuning = false;
      continue;
    }

    if (block) {
      if (raw.trim() === '') continue;
      const match = VOICING_LINE.exec(raw);
      const frets = match ? parseShorthand(match[3]) : null;
      if (!match || !frets) {
        problems.push(raw.trim());
        continue;
      }
      const index = match[2] ? Number(match[2]) : 1;
      block.voicings.set(keyFor(match[1], index), frets);
      continue;
    }

    const line = parseChartLine(raw, lineStart, dialect, seen, symbols, unknown, occurrences);
    if (line) current.lines.push(line);
  }

  closeBlock(source.length);
  flush();

  return { sections, blocks, occurrences, symbols, unknown, problems, legacyTuning, legacyTuningRange };
}

/** The voicings-block key for a symbol and index. Index 1 is the bare form. */
export function keyFor(symbol, index) {
  return index > 1 ? `${symbol}[${index}]` : symbol;
}

/** Split a block key back into symbol and index. */
function splitKey(key) {
  const m = /^(.*?)(?:\[(\d+)\])?$/.exec(key);
  return { symbol: m[1], index: m[2] ? Number(m[2]) : 1 };
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

// --- reading -----------------------------------------------------------------

/** The block for a tuning, or null. */
export function blockFor(parsed, tuning) {
  const id = normaliseTuning(tuning);
  return parsed.blocks.find((b) => b.id === id) ?? null;
}

/** The chosen voicings for a tuning, keyed as in the chart. Empty if none. */
export function voicingsFor(parsed, tuning) {
  return blockFor(parsed, tuning)?.voicings ?? new Map();
}

/** Every tuning the song has chosen voicings for, as written. */
export function songTunings(parsed) {
  return parsed.blocks.filter((b) => b.id && b.voicings.size > 0).map((b) => b.tuning);
}

/**
 * Order voicing entries for reading: alphabetically by chord symbol, with a
 * chord's own footnotes kept together and in numeric order.
 *
 * A plain code-unit comparison rather than localeCompare, so the order is
 * identical everywhere — the text is a stored artefact and must not read
 * differently on another machine.
 */
export function compareVoicings(a, b) {
  if (a.symbol !== b.symbol) return a.symbol < b.symbol ? -1 : 1;
  return a.index - b.index;
}

/** Each distinct voicing the chart uses on this tuning, alphabetically. */
export function songLegend(parsed, tuning) {
  const voicings = voicingsFor(parsed, tuning);
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key)) continue;
    seen.add(chord.key);
    const frets = voicings.get(chord.key);
    if (frets) out.push({ key: chord.key, symbol: chord.symbol, index: chord.index, frets });
  }
  return out.sort(compareVoicings);
}

/** Chart chords with no voicing chosen on this tuning, alphabetically. */
export function unvoicedKeys(parsed, tuning) {
  const voicings = voicingsFor(parsed, tuning);
  const seen = new Set();
  const out = [];
  for (const chord of parsed.occurrences) {
    if (seen.has(chord.key) || voicings.has(chord.key) || !chord.valid) continue;
    seen.add(chord.key);
    out.push({ key: chord.key, symbol: chord.symbol, index: chord.index });
  }
  return out.sort(compareVoicings).map((e) => e.key);
}

/** How many places in the chart use one voicing key. */
export function countForKey(parsed, key) {
  return parsed.occurrences.filter((chord) => chord.key === key).length;
}

/** How many measures the whole song contains. */
export function measureCount(parsed) {
  return parsed.sections.reduce(
    (total, section) => total + section.lines.reduce((n, line) => n + line.measures.length, 0),
    0
  );
}

// --- editing -----------------------------------------------------------------

/**
 * Choose the voicing for one occurrence on one tuning, returning the new text.
 *
 * @param {string} text
 * @param {number} offset  the `start` of the occurrence being changed
 * @param {(number|'x')[]|null} frets  null clears the choice
 * @param {{ tuning: string, dialect?: string }} options
 */
export function setVoicing(text, offset, frets, { tuning, dialect } = {}) {
  return applyEdit(text, { kind: 'occurrence', offset, frets }, tuning, dialect);
}

/**
 * Change one voicing everywhere it is used, on one tuning.
 *
 * The complement of setVoicing: that repoints a single chord in the chart,
 * this changes the shape itself, so every occurrence written with that key
 * moves together.
 *
 * @param {string} text
 * @param {string} key    a voicings-block key: `Cm` or `Cm[2]`
 * @param {(number|'x')[]|null} frets  null clears it everywhere on this tuning
 * @param {{ tuning: string, dialect?: string }} options
 */
export function setVoicingForKey(text, key, frets, { tuning, dialect } = {}) {
  return applyEdit(text, { kind: 'key', key, frets }, tuning, dialect);
}

/**
 * Apply an edit and normalise.
 *
 * Footnote slots are stable identities shared by every tuning, so the rules
 * that keep the text tidy have to respect all of them at once:
 *
 * - Picking a shape a chord already has, on this tuning, *reuses* that slot
 *   rather than adding a duplicate footnote — unless another tuning tells the
 *   two slots apart, in which case merging them would silently destroy that
 *   instrument's arrangement, so the shape is written to the current slot.
 * - A slot no occurrence uses any more is dropped from every block, and the
 *   remaining slots renumbered so a chord back to one voicing loses its marker.
 * - Clearing removes this tuning's entry for the key; every occurrence sharing
 *   it falls back to the default. The marker stays, since the variant may still
 *   mean something on another tuning.
 */
function applyEdit(text, edit, tuning, dialect) {
  if (!tuning) throw new Error('A tuning is needed to edit voicings.');
  const parsed = parseSong(text, dialect);
  const id = normaliseTuning(tuning);

  // Working copies of every block, keyed by tuning id, with this tuning present.
  /** @type {Map<string, {tuning:string, voicings:Map<string,(number|'x')[]>}>} */
  const blocks = new Map();
  for (const b of parsed.blocks) {
    if (!b.id) continue;
    if (!blocks.has(b.id)) blocks.set(b.id, { tuning: b.tuning, voicings: new Map() });
    for (const [k, v] of b.voicings) blocks.get(b.id).voicings.set(k, v);
  }
  if (!blocks.has(id)) blocks.set(id, { tuning: String(tuning).trim(), voicings: new Map() });
  const mine = blocks.get(id).voicings;

  const occurrences = parsed.occurrences;
  const slots = occurrences.map((c) => c.index);

  const targets = [];
  occurrences.forEach((c, i) => {
    if (edit.kind === 'occurrence' ? c.start === edit.offset : c.key === edit.key) targets.push(i);
  });
  if (targets.length === 0) return text;
  const symbol = occurrences[targets[0]].symbol;

  const sameShape = (a, b) => Boolean(a && b) && shorthandOf(a) === shorthandOf(b);
  const slotsOf = (sym) => {
    const used = new Set();
    occurrences.forEach((c, i) => {
      if (c.symbol === sym) used.add(slots[i]);
    });
    return used;
  };
  const distinguishedElsewhere = (sym, a, b) => {
    for (const [otherId, other] of blocks) {
      if (otherId === id) continue;
      const va = other.voicings.get(keyFor(sym, a));
      const vb = other.voicings.get(keyFor(sym, b));
      if (va && vb && !sameShape(va, vb)) return true;
    }
    return false;
  };

  if (edit.frets === null) {
    for (const i of targets) mine.delete(keyFor(symbol, slots[i]));
  } else {
    const frets = edit.frets;
    const currentSlot = slots[targets[0]];
    const currentShape = mine.get(keyFor(symbol, currentSlot));

    // A slot of this symbol that already holds this shape on this tuning.
    let match = null;
    for (const s of slotsOf(symbol)) {
      if (s !== currentSlot && sameShape(mine.get(keyFor(symbol, s)), frets)) match = s;
    }
    if (match !== null && distinguishedElsewhere(symbol, currentSlot, match)) match = null;

    if (sameShape(currentShape, frets)) {
      // Already so. Without this, choosing the shape a slot already has would
      // fall through and split off a duplicate footnote with the same shape.
    } else if (match !== null) {
      for (const i of targets) slots[i] = match;
    } else if (edit.kind === 'key') {
      mine.set(keyFor(symbol, currentSlot), frets);
    } else {
      const i = targets[0];
      const alone = !occurrences.some(
        (c, j) => j !== i && c.symbol === symbol && slots[j] === currentSlot
      );
      // Writing in place is right when this occurrence is the only one on the
      // slot, and also when the slot has no shape on this tuning yet: then the
      // choice becomes the shape for every bare occurrence, rather than
      // splitting the first one chosen off into a footnote.
      const slotHasShape = mine.has(keyFor(symbol, currentSlot));
      if (alone || !slotHasShape) {
        mine.set(keyFor(symbol, currentSlot), frets);
      } else {
        const used = slotsOf(symbol);
        let n = 1;
        while (used.has(n)) n += 1;
        slots[i] = n;
        mine.set(keyFor(symbol, n), frets);
      }
    }
  }

  // Garbage-collect slots nothing uses, then close the gaps — the same
  // renumbering applied to the chart and to every block, so nothing drifts.
  const bySymbol = new Map();
  occurrences.forEach((c, i) => {
    if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, new Set());
    bySymbol.get(c.symbol).add(slots[i]);
  });
  const renumber = new Map();
  for (const [sym, used] of bySymbol) {
    [...used].sort((a, b) => a - b).forEach((old, k) => renumber.set(`${sym}|${old}`, k + 1));
  }
  for (const b of blocks.values()) {
    const next = new Map();
    for (const [k, v] of b.voicings) {
      const { symbol: sym, index: old } = splitKey(k);
      const fresh = renumber.get(`${sym}|${old}`);
      if (fresh !== undefined) next.set(keyFor(sym, fresh), v);
    }
    b.voicings = next;
  }
  occurrences.forEach((c, i) => {
    slots[i] = renumber.get(`${c.symbol}|${slots[i]}`);
  });

  // Rewrite the chart tokens, right to left so earlier offsets stay valid.
  let out = text;
  const edits = [];
  occurrences.forEach((c, i) => {
    const wanted = keyFor(c.symbol, slots[i]);
    if (wanted !== c.raw) edits.push({ start: c.start, end: c.end, wanted });
  });
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.wanted + out.slice(e.end);
  }

  return writeBlocks(out, blocks, dialect);
}

/**
 * Replace every voicings block (and any legacy `# Tuning` line) with the given
 * blocks: a rule, then the blocks in tuning order, alphabetical within each.
 */
function writeBlocks(text, blocks, dialect) {
  const parsed = parseSong(text, dialect);

  // Strip the old blocks, last first so earlier offsets stay valid.
  const ranges = parsed.blocks.map((b) => b.range);
  if (parsed.legacyTuningRange) ranges.push(parsed.legacyTuningRange);
  let out = text;
  for (const r of ranges.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  // And the rule that introduced them, so rules do not pile up.
  out = out.replace(/\s*$/, '').replace(/(?:\n\s*-{3,}\s*)+$/, '').replace(/\s*$/, '');

  const rendered = [];
  for (const [, b] of [...blocks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const entries = [...b.voicings.entries()].map(([k, v]) => ({ ...splitKey(k), frets: v }));
    if (entries.length === 0) continue;
    const lines = entries
      .sort(compareVoicings)
      .map((e) => `${keyFor(e.symbol, e.index)} = ${shorthandOf(e.frets)}`);
    rendered.push(`# ${VOICINGS_SECTION}: ${b.tuning}\n${lines.join('\n')}\n`);
  }

  if (rendered.length === 0) return out ? `${out}\n` : out;
  return `${out}\n\n${RULE_LINE}\n\n${rendered.join('\n')}`;
}

// --- merging -----------------------------------------------------------------

/**
 * The chart alone, as a comparable string: section names and chord tokens,
 * with layout and voicings stripped. Two songs with equal keys are the same
 * arrangement written for possibly different instruments.
 */
export function chartKey(text, dialect) {
  return parseSong(text, dialect)
    .sections.map(
      (section) =>
        `${section.name}:` +
        section.lines
          .map((line) => line.measures.map((m) => m.chords.map((c) => c.raw).join(' ')).join('|'))
          .join('/')
    )
    .join('\n');
}

/**
 * Whether songs can be merged without losing anything: they must share a chart
 * and have no tuning voiced in more than one of them. Two guitar blocks for one
 * song is a conflict nobody can resolve automatically, so it is left alone.
 */
export function canMergeSongs(texts, dialect) {
  if (texts.length < 2) return false;
  const key = chartKey(texts[0], dialect);
  const seen = new Set();
  let anyBlocks = false;
  for (const text of texts) {
    if (chartKey(text, dialect) !== key) return false;
    for (const block of parseSong(text, dialect).blocks) {
      if (!block.id || block.voicings.size === 0) continue;
      if (seen.has(block.id)) return false;
      seen.add(block.id);
      anyBlocks = true;
    }
  }
  return anyBlocks;
}

/**
 * Fold the voicing blocks of several copies of one song into the first.
 * Only meaningful when canMergeSongs holds; the first text's chart is kept.
 */
export function mergeSongs(texts, dialect) {
  const blocks = new Map();
  for (const text of texts) {
    for (const b of parseSong(text, dialect).blocks) {
      if (!b.id || b.voicings.size === 0 || blocks.has(b.id)) continue;
      blocks.set(b.id, { tuning: b.tuning, voicings: new Map(b.voicings) });
    }
  }
  return writeBlocks(texts[0], blocks, dialect);
}

// --- transition --------------------------------------------------------------

/**
 * Convert a song written in the earlier form to the current one.
 *
 * Earlier drafts wrote a `# Tuning` line and an unlabelled `# Voicings` block.
 * Either is enough to know what was meant: a `# Tuning` names the tuning the
 * voicings are for, and an unlabelled block with no `# Tuning` was written on
 * whatever instrument is in use now. Returns the text unchanged when there is
 * nothing to convert.
 *
 * @param {string} text
 * @param {string} currentTuning   the tuning to assume for an unlabelled block
 * @param {string} [dialect]
 */
export function migrateSong(text, currentTuning, dialect) {
  const parsed = parseSong(text, dialect);
  const unlabelled = parsed.blocks.filter((b) => !b.id);
  if (!parsed.legacyTuning && unlabelled.length === 0) return text;

  const target = parsed.legacyTuning ?? currentTuning;
  if (!target) return text;
  const id = normaliseTuning(target);

  const blocks = new Map();
  for (const b of parsed.blocks) {
    const key = b.id ?? id;
    const tuning = b.tuning ?? String(target).trim();
    if (!blocks.has(key)) blocks.set(key, { tuning, voicings: new Map() });
    for (const [k, v] of b.voicings) {
      // A labelled block outranks an unlabelled one for the same key.
      if (b.id || !blocks.get(key).voicings.has(k)) blocks.get(key).voicings.set(k, v);
    }
  }

  return writeBlocks(text, blocks, dialect);
}
