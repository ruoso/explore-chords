/**
 * Chord formatting, one implementation per dialect (docs/DESIGN.md §4.4).
 *
 * Parsing is shared and permissive; formatting is where the dialects genuinely
 * differ, so this is the only place per-dialect code belongs. The contract is a
 * round trip: `parse(format(c, d), d)` must equal `c` for every dialect, which
 * means a formatter may only emit spellings the parser accepts.
 */

import { formatNote } from '../pitch.js';
import { DEFAULT_DIALECT, getDialect } from './dialects.js';

/** Read a chord's extensions into a map for inspection. */
function extMap(c) {
  const m = new Map();
  for (const e of c.extensions) m.set(e.degree, e.alter);
  return m;
}

const ALTER_SUFFIX_BR = { '-2': 'bb', '-1': '-', 0: '', 1: '+', 2: '##' };
const ALTER_PREFIX_US = { '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' };

/**
 * Decide the chord's headline shape: the triad name plus which degree, if any,
 * is acting as its stated top. Shared by all three formatters so they agree on
 * what the chord *is* and differ only in how they spell it.
 */
function analyse(c) {
  const ext = extMap(c);
  const seventh = ext.get(7);
  const hasSeventh = seventh !== undefined;
  const has = (d) => ext.has(d);

  // The stated top: the highest stacked degree present with no alteration,
  // where every degree below it is also present and unaltered.
  let top = null;
  if (hasSeventh) {
    top = 7;
    if (ext.get(9) === 0) {
      top = 9;
      if (ext.get(11) === 0) top = 11;
      if (ext.get(13) === 0) top = 13;
    }
  }

  // Degrees already accounted for by the stated top.
  const covered = new Set();
  if (top !== null) {
    covered.add(7);
    if (top >= 9) covered.add(9);
    if (top === 11) covered.add(11);
    if (top === 13) covered.add(13);
  }

  const extras = [...ext.entries()]
    .filter(([degree]) => !covered.has(degree))
    .sort((a, b) => a[0] - b[0]);

  return {
    ext,
    hasSeventh,
    seventh,
    top,
    extras,
    isHalfDim: c.quality === 'dim' && seventh === -1,
    isDim7: c.quality === 'dim' && seventh === -2,
    hasSix: has(6),
    hasSixNine: has(6) && ext.get(9) === 0 && !hasSeventh,
  };
}

/** Brazilian cifra: 7M for a major 7th, ° and +, sus4 written as 4. */
function formatBrazilian(c, a) {
  const root = formatNote(c.root);
  let base = root;
  let tail = '';

  switch (c.quality) {
    case 'minor':
      base += 'm';
      break;
    case 'dim':
      base += a.isHalfDim ? 'm' : '°';
      break;
    case 'aug':
      base += a.hasSeventh ? '' : '+';
      break;
    case 'sus2':
      base += 'sus2';
      break;
    case 'sus4':
      base += '4';
      break;
    case 'power':
      base += '5';
      break;
    default:
      break;
  }

  if (a.hasSixNine) return `${base}6/9`;
  if (a.hasSix && !a.hasSeventh) tail += '6';

  if (a.hasSeventh) {
    // The base already carries the degree sign for a diminished triad.
    if (a.isDim7) tail += '7';
    else if (a.seventh === 0) tail += a.top === 7 ? '7M' : `7M(${a.top})`;
    else if (a.top === 9) tail += '7(9)'; // a bare C9 would read as an added 9th
    else tail += String(a.top);
  }

  const parenParts = [];
  if (a.isHalfDim) parenParts.push('5-');
  if (c.quality === 'aug' && a.hasSeventh) parenParts.push('5+');
  for (const [degree, alter] of a.extras) {
    if (degree === 6 && !a.hasSeventh) continue;
    parenParts.push(`${degree}${ALTER_SUFFIX_BR[String(alter)]}`);
  }
  if (parenParts.length) tail += `(${parenParts.join(',')})`;

  return base + tail;
}

/** American jazz: maj7, m7b5, dim7, sus4, add9. */
function formatAmerican(c, a) {
  const root = formatNote(c.root);
  let base = root;
  let tail = '';

  switch (c.quality) {
    case 'minor':
      base += 'm';
      break;
    case 'dim':
      base += a.isHalfDim ? 'm' : 'dim';
      break;
    case 'aug':
      base += a.hasSeventh ? '' : 'aug';
      break;
    case 'sus2':
      base += 'sus2';
      break;
    case 'sus4':
      base += 'sus4';
      break;
    case 'power':
      base += '5';
      break;
    default:
      break;
  }

  if (a.hasSixNine) return `${base}6/9`;
  if (a.hasSix && !a.hasSeventh) tail += '6';

  if (a.hasSeventh) {
    if (a.isDim7) tail += '7';
    else if (a.seventh === 0) tail += `maj${a.top}`;
    else tail += String(a.top);
  }

  const parts = [];
  if (a.isHalfDim) parts.push('b5');
  if (c.quality === 'aug' && a.hasSeventh) parts.push('#5');
  for (const [degree, alter] of a.extras) {
    if (degree === 6 && !a.hasSeventh) continue;
    if (alter === 0 && !a.hasSeventh) parts.push(`add${degree}`);
    else parts.push(`${ALTER_PREFIX_US[String(alter)]}${degree}`);
  }
  tail += parts.join('');

  return base + tail;
}

/** Real Book symbols: ∆ for a major 7th, − for minor, ø and °. */
function formatRealBook(c, a) {
  const root = formatNote(c.root);
  let base = root;
  let tail = '';

  switch (c.quality) {
    case 'minor':
      base += '−';
      break;
    case 'dim':
      base += a.isHalfDim ? 'ø' : '°';
      break;
    case 'aug':
      base += a.hasSeventh ? '' : '+';
      break;
    case 'sus2':
      base += 'sus2';
      break;
    case 'sus4':
      base += 'sus4';
      break;
    case 'power':
      base += '5';
      break;
    default:
      break;
  }

  if (a.hasSixNine) return `${base}6/9`;
  if (a.hasSix && !a.hasSeventh) tail += '6';

  if (a.hasSeventh) {
    if (a.isDim7) tail += '7';
    else if (a.isHalfDim) tail += '7';
    else if (a.seventh === 0) tail += `∆${a.top}`;
    else tail += String(a.top);
  }

  const parts = [];
  if (c.quality === 'aug' && a.hasSeventh) parts.push('#5');
  for (const [degree, alter] of a.extras) {
    if (degree === 6 && !a.hasSeventh) continue;
    if (alter === 0 && !a.hasSeventh) parts.push(`add${degree}`);
    else parts.push(`${ALTER_PREFIX_US[String(alter)]}${degree}`);
  }
  tail += parts.join('');

  return base + tail;
}

const FORMATTERS = {
  brazilian: formatBrazilian,
  american: formatAmerican,
  realbook: formatRealBook,
};

/**
 * Render a chord in a notation dialect.
 *
 * @param {import('../chord.js').Chord} c
 * @param {string} [dialectId]
 * @returns {string}
 */
export function formatChord(c, dialectId = DEFAULT_DIALECT) {
  const dialect = getDialect(dialectId);
  const a = analyse(c);
  const symbol = FORMATTERS[dialect.id](c, a);
  return c.bass ? `${symbol}/${formatNote(c.bass)}` : symbol;
}
