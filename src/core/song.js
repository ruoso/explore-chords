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
 * A line starting with `#` names a section, and so does `[Intro]`, the way a
 * cifra writes one. Every other line is a line of the chart: a vertical bar
 * separates measures, spaces separate chords inside one measure. A rule of
 * three dashes ends the chart; the voicings follow it.
 *
 * A song may also be written with its words under the chords, which is one
 * document and not a second format — see lineShape and assembleLines for how
 * the two are told apart, and §2.6 for why.
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
import { parseTuning } from './instrument.js';

const HEADING = /^(\s*)(#+)\s*(.*?)\s*$/;
const RULE = /^\s*-{3,}\s*$/;
const VOICINGS_HEADING = /^voicings?\b\s*(?:for\b)?\s*[:\-–(]?\s*(.*?)\)?\s*$/i;
const LABELLED_HEADING = /^(.*?)\s*[:\-–(]\s*(.*?)\)?\s*$/;
const TUNING_HEADING = /^tuning$/i;
const VOICING_LINE = /^\s*([^\s=[\]]+)(?:\[(\d+)\])?\s*=\s*(\S+)\s*$/;
const CHORD_TOKEN = /^(.*?)(?:\[(\d+)\])?$/;
/** `[Intro]`, alone or with the chords of that section on the same line. */
const BRACKET_HEADING = /^(\s*\[\s*([^\]]*?)\s*\]\s*)(.*)$/;
/** `Intro: C  G`, the other way a cifra names a section. */
const LABEL_HEADING = /^(\s*([^\s:|]+)\s*:\s*)(.*)$/;
/**
 * Brackets around a run of chords, which a cifra uses to mark a repeat.
 *
 * They annotate the run, not the chords in it: a bracket is a mark of its own
 * standing between chords, and a search for `(` would find nothing to play.
 * Round brackets only — square ones are the footnote marker, `Cm[2]`.
 */
const CHORD_MARKS = /^(\(*)(.*?)(\)*)$/;
/** A leading `>` forces a line to be read as words. Kept in the text. */
const LYRIC_MARKER = /^(\s*)>( ?)/;

export const VOICINGS_SECTION = 'Voicings';
export const RULE_LINE = '---';

/**
 * Is this heading a voicings block, and for which tuning?
 *
 * The word does not matter: what makes a heading a voicings block is that it
 * names a tuning — `# Voicings: E2, A2, D3, G3, B3, E4`, but equally
 * `# Posições: …` or `# Formas (G4, C4, E4, A4)`, since the person writing
 * the song writes it in their own language. The English word alone still
 * counts, so an unlabelled `# Voicings` from the earlier format is found and
 * a placeholder tuning is tolerated after it.
 *
 * @returns {{ label: string|null, tuning: string|null } | null}
 *   the label as written, to be kept when the block is rewritten; null label
 *   means the canonical one
 */
export function voicingsHeading(name) {
  const english = VOICINGS_HEADING.exec(name);
  if (english) return { label: null, tuning: english[1].trim() || null };

  const labelled = LABELLED_HEADING.exec(name);
  if (!labelled || !labelled[1] || !isTuning(labelled[2])) return null;
  return { label: labelled[1].trim(), tuning: labelled[2].trim() };
}

function isTuning(text) {
  if (!/[,\s]/.test(text.trim())) return false; // one pitch is not a tuning
  try {
    parseTuning(text);
    return true;
  } catch {
    return false;
  }
}

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
 *
 * @typedef {object} VoicingsBlock
 * @property {string|null} tuning   as written; null for an unlabelled legacy block
 * @property {string|null} id       the tuning normalised for comparison
 * @property {string|null} label    the heading's word as written, if not the canonical one
 * @property {Map<string,(number|'x')[]>} voicings   key -> frets
 * @property {{start:number,end:number}} range
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



/** Does this song read words at all? See assembleLines. */
function songIsSung(shapesBySection) {
  return shapesBySection.some((shapes) =>
    shapes.some(
      (shape, i) => (shape.kind === 'chords' && shapes[i + 1]?.kind === 'words') || shape.forced
    )
  );
}

/** One chord token, recorded as an occurrence of that chord. */
function makeChord(word, start, dialect, collect) {
  const token = CHORD_TOKEN.exec(word);
  const symbol = token[1] || word;
  const index = token[2] ? Number(token[2]) : 1;
  const valid = Boolean(parseChord(symbol, dialect).chord);

  if (!collect.seen.has(symbol)) {
    collect.seen.add(symbol);
    collect.symbols.push(symbol);
    if (!valid) collect.unknown.push(symbol);
  }

  const chord = {
    raw: word,
    symbol,
    index,
    key: keyFor(symbol, index),
    valid,
    start,
    end: start + word.length,
    // Set on a chord that has words under it, so an edit knows to keep the
    // line's columns when the token it writes is a different width.
    sung: false,
  };
  collect.occurrences.push(chord);
  return chord;
}

/**
 * The chords of one line, grouped into measures, with each chord's column.
 *
 * The column is where the chord sits in its line, which is what a line of words
 * beneath it is divided by.
 */
function scanChords(raw, lineStart, dialect, collect) {
  const measures = [];
  const tokens = [];
  let cursor = 0;

  for (const chunk of raw.split('|')) {
    const chunkStart = cursor;
    cursor += chunk.length + 1;

    const segments = [];
    const add = (segment, column) => {
      segments.push(segment);
      tokens.push({ segment, column });
    };

    const wordRe = /\S+/g;
    let match;
    while ((match = wordRe.exec(chunk)) !== null) {
      const start = chunkStart + match.index;
      const { before, chord: word, after } = splitMarks(match[0]);

      if (before) add({ chord: null, mark: before, lyric: '' }, start);
      if (word) {
        const column = start + before.length;
        add({ chord: makeChord(word, lineStart + column, dialect, collect), mark: '', lyric: '' }, column);
      }
      if (after) add({ chord: null, mark: after, lyric: '' }, start + before.length + word.length);
    }

    if (segments.length > 0) measures.push({ segments });
  }

  return { measures, tokens };
}

/** A line of chords alone: measures of segments, no words. */
function chartLine(raw, lineStart, dialect, collect) {
  const { measures } = scanChords(raw, lineStart, dialect, collect);
  return measures.length > 0 ? { measures, lyrics: false } : null;
}

/**
 * A line of chords with the words it is sung to.
 *
 * Each chord takes the words from its own column up to the next chord's, so a
 * chord written inside a word divides that word — which is the whole point of
 * writing it there. Words before the first chord become a segment with no
 * chord, and a bar divides the words exactly as it divides the chords.
 *
 * A chord past the end of the words gets no words at all, and no attempt is
 * made to buy it width with spaces: the whole reason a segment carries its own
 * words is that neither screen nor paper has to be set in a fixed-width font,
 * and a space measured in a proportional one is nothing like the column it was
 * typed as. Keeping those chords apart is the renderer's job (styles/app.css).
 */
function sungLine(raw, lineStart, words, dialect, collect) {
  const { measures, tokens } = scanChords(raw, lineStart, dialect, collect);

  tokens.forEach(({ segment, column }, i) => {
    const next = tokens[i + 1];
    segment.lyric = next ? words.slice(column, next.column) : words.slice(column);
    if (segment.chord) segment.chord.sung = true;
  });

  const lead = words.slice(0, tokens[0].column);
  if (lead.trim() !== '') {
    measures[0].segments.unshift({ chord: null, mark: '', lyric: lead });
  }

  return { measures, lyrics: true };
}

/** A line of words with no chords over it. */
function wordsLine(words) {
  return {
    measures: [{ segments: [{ chord: null, mark: '', lyric: words }] }],
    lyrics: true,
  };
}

/** A stanza break: an empty sung line. */
function emptyLine() {
  return {
    measures: [{ segments: [{ chord: null, mark: '', lyric: '' }] }],
    lyrics: true,
    blank: true,
  };
}

/**
 * How a line of the chart reads, before the song as a whole is considered.
 *
 * A cifra is the same document as a chart, not a second format: its intro and
 * solo sections *are* chart lines, and its verses are chord lines with words
 * beneath them. So classification is per line, by content, since nothing marks
 * a pasted cifra as one.
 *
 * - `chords` — every word is a chord, bars or not. It can head a line of words.
 * - `words` — at least two words and at least half of them are not chords.
 *   Both halves matter: `C Am wobble G` is a chart line with a typo in it, and
 *   a lone unknown word is too, which is what keeps an existing song reading
 *   the way it always has.
 * - `chart` — anything else, which is what every line was before this.
 *
 * A leading `>` forces `words`, for the handful of lines no rule can call: a
 * verse that really does read "A", against the chord of the same name.
 */
function lineShape(raw, dialect) {
  const forced = LYRIC_MARKER.test(raw);
  const body = forced ? stripLyricMarker(raw) : raw;
  const tokens = body.replace(/\|/g, ' ').match(/\S+/g) ?? [];
  // A bracket on its own is neither a chord nor a word: counting it as one
  // would make a bracketed line of chords look a third prose.
  const words = tokens.filter((token) => splitMarks(token).chord !== '');

  if (tokens.length === 0) return { kind: 'blank', body, forced, prose: false };
  if (forced) return { kind: 'words', body, forced, prose: true };
  if (words.length === 0) return { kind: 'chart', body, forced, prose: false };

  const chords = words.filter((w) => Boolean(parseChord(chordSymbolOf(w), dialect).chord)).length;
  if (chords === words.length) return { kind: 'chords', body, forced, prose: false };

  // Prose is a line at least half of whose words are not chords. Two of them
  // make it *evidence* that the song is sung — see songIsSung, where one word
  // is not enough, because a chart line with a single typo in it looks exactly
  // the same. Once the song is known to be sung, one word is a line of words
  // like any other: a verse that wraps often ends in one.
  const prose = (words.length - chords) / words.length >= 0.5;
  if (prose && words.length >= 2) return { kind: 'words', body, forced, prose };
  return { kind: 'chart', body, forced, prose };
}

/** Blank the marker rather than remove it, so the columns still line up. */
function stripLyricMarker(raw) {
  return raw.replace(LYRIC_MARKER, (m, indent, space) => indent + ' ' + space);
}

/** Is this nothing but chords, so that what stands before it names a section? */
function isChordRun(text, dialect) {
  const words = text.replace(/\|/g, ' ').match(/\S+/g) ?? [];
  return words.every((word) => Boolean(parseChord(chordSymbolOf(word), dialect).chord));
}

/** The chord symbol inside a token, footnote marker and brackets removed. */
function chordSymbolOf(token) {
  const m = CHORD_TOKEN.exec(splitMarks(token).chord);
  return m[1] || token;
}

/**
 * A chart token split into the brackets around it and the chord itself.
 *
 * `( Cm  Dm )` and `(Cm Dm)` both mark the same repeat, so a bracket may stand
 * on its own or be written against a chord. Either way it becomes a mark of its
 * own, because it brackets the run and not the chord it happens to touch.
 */
function splitMarks(word) {
  const m = CHORD_MARKS.exec(word);
  return { before: m[1], chord: m[2], after: m[3] };
}

/**
 * Turn the lines of a whole song into chart lines, lines of words, or both.
 *
 * Whether words are read at all is decided for the song, not the line, and is
 * passed in: unless some chord line actually has words under it, or a line is
 * marked with `>`, every line is a chart line and the song parses exactly as it
 * did before any of this existed. That is what keeps every song already
 * written safe.
 */
function assembleLines(pending, shapes, sung, dialect, collect) {
  // In a song that is sung, any prose line is a line of words, however short.
  const wordsUnder = (i) => Boolean(shapes[i] && (shapes[i].prose || shapes[i].forced));
  const out = [];
  let blanks = 0;
  let previousSung = false;

  for (let i = 0; i < pending.length; i += 1) {
    const { raw, lineStart } = pending[i];
    const shape = shapes[i];

    if (!sung) {
      const line = chartLine(raw, lineStart, dialect, collect);
      if (line) out.push(line);
      continue;
    }

    if (shape.kind === 'blank') {
      blanks += 1;
      continue;
    }

    // A stanza break only survives between two sung lines; anywhere else a
    // blank line is the breathing room in the text it has always been.
    const paired = shape.kind === 'chords' && wordsUnder(i + 1);
    const sings = paired || wordsUnder(i);
    if (blanks > 0 && previousSung && sings) out.push(emptyLine());
    blanks = 0;

    if (paired) {
      out.push(sungLine(raw, lineStart, shapes[i + 1].body, dialect, collect));
      i += 1;
    } else if (wordsUnder(i)) {
      out.push(wordsLine(shape.body));
    } else {
      const line = chartLine(raw, lineStart, dialect, collect);
      if (line) out.push(line);
    }
    previousSung = sings;
  }

  return out;
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
  let current = { name: '', pending: [] };
  let offset = 0;

  // Lines are held until the whole song has been read, because whether a line
  // of words is words at all depends on the song around it (assembleLines).
  const flush = () => {
    if (current.pending.length > 0 || current.name) sections.push(current);
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
      current = { name: '', pending: [] };
      continue;
    }

    // `[Intro]`, the way a cifra names its sections, with the chords of that
    // section allowed on the same line after it.
    const bracket = BRACKET_HEADING.exec(raw);
    if (bracket && bracket[2] && !/^\d+$/.test(bracket[2])) {
      closeBlock(lineStart);
      flush();
      current = { name: bracket[2], pending: [] };
      if (bracket[3].trim() !== '') {
        current.pending.push({ raw: bracket[3], lineStart: lineStart + bracket[1].length });
      }
      continue;
    }

    const heading = HEADING.exec(raw);
    if (heading) {
      const name = heading[3];
      closeBlock(lineStart);

      const voicings = voicingsHeading(name);
      if (voicings) {
        flush();
        current = { name: '', pending: [] };
        const { tuning, label } = voicings;
        block = {
          tuning,
          id: tuning ? normaliseTuning(tuning) : null,
          label,
          voicings: new Map(),
          range: { start: lineStart, end: source.length },
        };
        continue;
      }
      if (TUNING_HEADING.test(name)) {
        flush();
        current = { name: '', pending: [] };
        inTuning = true;
        legacyTuningRange = { start: lineStart, end: source.length };
        continue;
      }

      flush();
      current = { name, pending: [] };
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

    // `Intro: Fm  Fm/D#`, which a cifra writes as often as it writes
    // `[Intro]`. The words after the colon have to be chords, or every line of
    // a verse that happens to contain a colon would name a section.
    const label = LABEL_HEADING.exec(raw);
    if (label && label[2] && isChordRun(label[3], dialect)) {
      closeBlock(lineStart);
      flush();
      current = { name: label[2], pending: [] };
      if (label[3].trim() !== '') {
        current.pending.push({ raw: label[3], lineStart: lineStart + label[1].length });
      }
      continue;
    }

    current.pending.push({ raw, lineStart });
  }

  closeBlock(source.length);
  flush();

  const collect = { seen, symbols, unknown, occurrences };
  const shapesBySection = sections.map((section) =>
    section.pending.map((p) => lineShape(p.raw, dialect))
  );
  const sung = songIsSung(shapesBySection);
  sections.forEach((section, i) => {
    section.lines = assembleLines(section.pending, shapesBySection[i], sung, dialect, collect);
    delete section.pending;
  });
  const kept = sections.filter((section) => section.lines.length > 0 || section.name);

  return {
    sections: kept,
    blocks,
    occurrences,
    symbols,
    unknown,
    problems,
    legacyTuning,
    legacyTuningRange,
  };
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
    if (!blocks.has(b.id)) blocks.set(b.id, { tuning: b.tuning, label: b.label, voicings: new Map() });
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
    if (wanted !== c.raw) edits.push({ start: c.start, end: c.end, wanted, sung: c.sung });
  });
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.wanted + out.slice(e.end);
    if (e.sung) out = realign(out, e.start + e.wanted.length, e.wanted.length - (e.end - e.start));
  }

  return writeBlocks(out, blocks, dialect);
}

/**
 * Give back, or take up, the room a rewritten chord token just took.
 *
 * On a sung line a chord's column *is* the syllable it belongs over, so writing
 * `Cm[2]` where `Cm` stood would slide every later chord three characters along
 * and quietly re-sing the line. The width is taken out of the run of spaces
 * that follows instead, leaving at least one so two chords never collide. Where
 * the gap is too small to give it all back the rest of the line shifts, which
 * is visible and fixable, unlike silently changing which word is sung to what.
 *
 * @param {string} text
 * @param {number} at     just past the token that was written
 * @param {number} grew   characters gained, or lost when negative
 */
function realign(text, at, grew) {
  if (grew === 0) return text;
  if (grew < 0) return text.slice(0, at) + ' '.repeat(-grew) + text.slice(at);

  let spaces = 0;
  while (text[at + spaces] === ' ') spaces += 1;
  const take = Math.max(0, Math.min(grew, spaces - 1));
  return take === 0 ? text : text.slice(0, at) + text.slice(at + take);
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
    // The heading keeps the word the song used, so a block written in
    // Portuguese stays in Portuguese; only a new block gets the canonical one.
    rendered.push(`# ${b.label || VOICINGS_SECTION}: ${b.tuning}\n${lines.join('\n')}\n`);
  }

  if (rendered.length === 0) return out ? `${out}\n` : out;
  return `${out}\n\n${RULE_LINE}\n\n${rendered.join('\n')}`;
}

// --- merging -----------------------------------------------------------------

/**
 * The chart alone, as a comparable string: section names, chord tokens and any
 * words sung to them, with layout and voicings stripped. Two songs with equal
 * keys are the same arrangement written for possibly different instruments.
 * The words have to be in it: without them two different songs that share a
 * chord sequence would compare equal and be merged into one.
 */
export function chartKey(text, dialect) {
  return parseSong(text, dialect)
    .sections.map(
      (section) =>
        `${section.name}:` +
        section.lines
          .map((line) =>
            line.measures
              .map((m) =>
                m.segments
                  .map((seg) => `${seg.mark}${seg.chord ? seg.chord.raw : ''}${seg.lyric}`)
                  .join(' ')
              )
              .join('|')
          )
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
      blocks.set(b.id, { tuning: b.tuning, label: b.label, voicings: new Map(b.voicings) });
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
    if (!blocks.has(key)) blocks.set(key, { tuning, label: b.label, voicings: new Map() });
    for (const [k, v] of b.voicings) {
      // A labelled block outranks an unlabelled one for the same key.
      if (b.id || !blocks.get(key).voicings.has(k)) blocks.get(key).voicings.set(k, v);
    }
  }

  return writeBlocks(text, blocks, dialect);
}
