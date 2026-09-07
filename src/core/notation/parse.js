/**
 * The permissive chord parser (docs/DESIGN.md §4.4).
 *
 * Accepts Brazilian cifra, American jazz and Real Book spellings at the same
 * time, because they mostly do not conflict. Where they genuinely do, the
 * dialect picks a default reading and the ambiguity is *reported* rather than
 * silently resolved, so the UI can offer the user the other reading.
 *
 * Never throws on bad input: errors come back in the result.
 */

import { parseNote } from '../pitch.js';
import { chord } from '../chord.js';
import { getDialect, DEFAULT_DIALECT } from './dialects.js';

/**
 * @typedef {object} ParseResult
 * @property {import('../chord.js').Chord|null} chord
 * @property {Ambiguity[]} ambiguities
 * @property {{ message: string, code?: string, params?: object }[]} errors
 *   `message` is English for logs; the UI translates by `code` (src/core/errors.js)
 *
 * @typedef {object} Ambiguity
 * @property {string} kind      'sevenPlus' | 'bareNine'
 * @property {string} text      the input fragment responsible
 * @property {string} chosen    the reading applied
 * @property {string[]} alternatives
 */

/**
 * Token patterns, longest and most specific first.
 *
 * `#` and `b` are separate from `+`, `-` and `°` because the latter three are
 * positional: leading, they name a chord quality (`C+`, `C-`, `C°`); trailing a
 * number, they alter that degree (`5+`, `9-`, `5°`). The tokenizer stays dumb
 * about which; the interpreter decides from position.
 */
const TOKEN_PATTERNS = [
  ['SUS2', /^sus2/],
  ['SUS4', /^sus4/],
  ['SUS', /^sus/],
  ['ADD', /^add/i],
  ['ALT', /^alt/],
  ['HALFDIM', /^[øØ]/],
  ['DIMWORD', /^dim/i],
  ['AUGWORD', /^aug/i],
  // `maj`/`M`/`∆` before `min`/`m`, and case is never normalised: `CM7` is a
  // major 7th and `Cm7` is a minor 7th.
  ['MAJ', /^(?:maj|Maj|MAJ|M|[∆Δ])/],
  ['MIN', /^(?:min|Min|MIN|m)/],
  ['NUM', /^(?:13|11|9|7|6|5|4|3|2)/],
  ['SHARP', /^[#♯]/],
  ['FLAT', /^[b♭]/],
  ['PLUS', /^\+/],
  ['MINUS', /^[-−–]/],
  ['DEG', /^[°º]/],
  ['LP', /^\(/],
  ['RP', /^\)/],
  ['SLASH', /^\//],
  ['SEP', /^[,\s]+/],
];

function tokenize(body) {
  const tokens = [];
  let rest = body;
  let offset = 0;
  while (rest.length > 0) {
    let matched = false;
    for (const [type, re] of TOKEN_PATTERNS) {
      const m = re.exec(rest);
      if (m) {
        if (type !== 'SEP') tokens.push({ type, text: m[0], offset });
        rest = rest.slice(m[0].length);
        offset += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) return { tokens, bad: rest, offset };
  }
  return { tokens, bad: null, offset };
}

/**
 * Split a trailing slash bass off the body.
 *
 * `/` is overloaded: followed by a note letter it is a slash bass (`C/E`),
 * followed by a digit it is part of a compound quality (`C6/9`). Resolved by
 * looking at what follows, not by dialect.
 */
function splitBass(text) {
  const idx = text.lastIndexOf('/');
  if (idx === -1) return { body: text, bassText: null };
  const candidate = text.slice(idx + 1).trim();
  if (/^[A-Ga-g](?:bb|##|[b#])?$/.test(candidate)) {
    return { body: text.slice(0, idx), bassText: candidate };
  }
  return { body: text, bassText: null };
}

/** Semitone offset for the 7th implied by a chord's quality and flags. */
function seventhAlter(quality, majorSeventh) {
  if (majorSeventh) return 0;
  if (quality === 'dim') return -2; // a diminished 7th is a doubly-flat 7th
  return -1;
}

/**
 * The tones a stated top degree implies.
 * A 13th chord means everything below it; a 6th implies nothing.
 */
function stackFor(top) {
  switch (top) {
    case 6:
      return [];
    case 7:
      return [];
    case 9:
      return [9];
    case 11:
      return [9, 11];
    case 13:
      return [9, 13]; // the 11th is conventionally omitted from a 13th chord
    default:
      return [];
  }
}

/**
 * Parse a chord symbol.
 *
 * @param {string} text
 * @param {string} [dialectId]
 * @returns {ParseResult}
 */
export function parseChord(text, dialectId = DEFAULT_DIALECT, options = {}) {
  const errors = [];
  const ambiguities = [];
  const fail = (message, code, params = {}) => ({
    chord: null,
    ambiguities,
    errors: [...errors, { message, code, params }],
  });
  const push = (message, code, params = {}) => errors.push({ message, code, params });

  if (typeof text !== 'string' || text.trim() === '') {
    return fail('Enter a chord.', 'empty');
  }

  let dialect;
  try {
    dialect = getDialect(dialectId);
  } catch {
    return fail(`Unknown notation dialect: ${dialectId}`, 'unknownDialect', { dialect: dialectId });
  }

  // The UI can override a reading for one parse, so the disambiguation chip
  // (§2.2) can flip `C9` between its two meanings without changing the user's
  // dialect. The ambiguity is still reported either way.
  const readings = { ...dialect.readings, ...(options.readings ?? {}) };

  const trimmed = text.trim();
  const rootMatch = /^([A-Ga-g](?:bb|##|[b#])?)/.exec(trimmed);
  if (!rootMatch) {
    return fail(`"${trimmed}" does not start with a note name.`, 'noRoot', { text: trimmed });
  }

  let root;
  try {
    root = parseNote(rootMatch[1]);
  } catch {
    return fail(`Cannot read the root note "${rootMatch[1]}".`, 'badRoot', { text: rootMatch[1] });
  }

  const { body, bassText } = splitBass(trimmed.slice(rootMatch[1].length));

  let bass = null;
  if (bassText !== null) {
    try {
      bass = parseNote(bassText);
    } catch {
      return fail(`Cannot read the bass note "${bassText}".`, 'badBass', { text: bassText });
    }
  }

  const { tokens, bad } = tokenize(body);
  if (bad) {
    return fail(`Cannot read "${bad}" in "${trimmed}".`, 'unreadable', { text: bad, whole: trimmed });
  }

  // --- interpret -----------------------------------------------------------

  let quality = 'major';
  let majorSeventh = false;
  let sawSeventh = false;
  // A bare ° (as opposed to the word `dim`) is read as a diminished 7th unless
  // a 7th is stated explicitly. Tracked here and resolved once the tokens are
  // consumed, since `°7` must not be flagged as ambiguous.
  let bareDegreeSign = false;
  let primaryTop = null;
  /** @type {Map<number, number>} degree -> alteration */
  const exts = new Map();

  const at = (i) => tokens[i]?.type;
  let i = 0;
  let sawQualityWord = false;

  while (i < tokens.length) {
    const t = tokens[i];

    switch (t.type) {
      case 'LP':
      case 'RP':
        i += 1;
        break;

      case 'MIN':
        // `m` leading is the chord quality; `7m` trailing alters that degree.
        if (!sawQualityWord && primaryTop === null && exts.size === 0) {
          quality = quality === 'dim' ? 'dim' : 'minor';
          sawQualityWord = true;
        } else {
          push(`Unexpected "${t.text}".`, 'unexpected', { text: t.text });
        }
        i += 1;
        break;

      case 'MAJ':
        // `maj7`/`M7`/`∆7` mark the 7th as major without changing the triad.
        majorSeventh = true;
        sawQualityWord = true;
        i += 1;
        break;

      case 'DIMWORD':
      case 'DEG':
        if (primaryTop === null && exts.size === 0) {
          quality = 'dim';
          sawQualityWord = true;
          if (t.type === 'DEG') bareDegreeSign = true;
        } else {
          push(`Unexpected "${t.text}".`, 'unexpected', { text: t.text });
        }
        i += 1;
        break;

      case 'HALFDIM':
        // Half-diminished: a diminished triad carrying a plain flat 7th.
        quality = 'dim';
        sawQualityWord = true;
        exts.set(7, -1);
        sawSeventh = true;
        i += 1;
        break;

      case 'AUGWORD':
        quality = 'aug';
        sawQualityWord = true;
        i += 1;
        break;

      case 'PLUS':
        if (at(i + 1) === 'NUM') {
          exts.set(Number(tokens[i + 1].text), 1);
          i += 2;
          break;
        }
        if (primaryTop === null && exts.size === 0) {
          quality = 'aug';
          sawQualityWord = true;
        } else {
          push('Unexpected "+".', 'unexpected', { text: '+' });
        }
        i += 1;
        break;

      case 'MINUS':
        if (at(i + 1) === 'NUM' && (sawQualityWord || primaryTop !== null || exts.size > 0)) {
          exts.set(Number(tokens[i + 1].text), -1);
          i += 2;
          break;
        }
        if (!sawQualityWord && primaryTop === null && exts.size === 0) {
          quality = 'minor'; // Real Book writes a minor chord as C−7
          sawQualityWord = true;
        } else {
          push(`Unexpected "${t.text}".`, 'unexpected', { text: t.text });
        }
        i += 1;
        break;

      case 'SUS2':
        quality = 'sus2';
        sawQualityWord = true;
        i += 1;
        break;

      case 'SUS4':
      case 'SUS':
        quality = 'sus4';
        sawQualityWord = true;
        i += 1;
        break;

      case 'ALT':
        // An altered dominant: flat 7 with a raised and lowered 9 and 5.
        exts.set(7, -1);
        exts.set(9, -1);
        exts.set(5, 1);
        sawSeventh = true;
        i += 1;
        break;

      case 'ADD': {
        const next = tokens[i + 1];
        if (next?.type !== 'NUM') {
          push('"add" must be followed by a number.', 'needsNumber', { text: 'add' });
          i += 1;
          break;
        }
        exts.set(Number(next.text), 0);
        i += 2;
        break;
      }

      case 'SHARP':
      case 'FLAT': {
        const next = tokens[i + 1];
        if (next?.type !== 'NUM') {
          push(`"${t.text}" must be followed by a number.`, 'needsNumber', { text: t.text });
          i += 1;
          break;
        }
        const degree = Number(next.text);
        exts.set(degree, t.type === 'SHARP' ? 1 : -1);
        if (degree === 7) sawSeventh = true;
        i += 2;
        break;
      }

      case 'NUM': {
        const degree = Number(t.text);
        let j = i + 1;
        let alter = 0;
        let handled = false;

        // Trailing modifiers: Brazilian writes 7M, 7m, 5+, 9-, 5°.
        //
        // `#` and `b` are deliberately NOT trailing modifiers. They always
        // prefix the degree they alter, so in `maj7#11` the sharp belongs to
        // the 11th; treating it as a suffix would sharpen the 7th instead.
        // Likewise `+`, `-` and `°` only suffix when no number follows them,
        // so `C7+9` reads as a 7th with a raised 9th.
        const mod = at(j);
        const modBindsForward = at(j + 1) === 'NUM';
        if (mod === 'MAJ') {
          alter = 0;
          handled = true;
          j += 1;
        } else if (mod === 'MIN') {
          alter = -1;
          handled = true;
          j += 1;
        } else if ((mod === 'MINUS' || mod === 'DEG') && !modBindsForward) {
          alter = -1;
          handled = true;
          j += 1;
        } else if (mod === 'PLUS' && !modBindsForward) {
          if (degree === 7) {
            // The documented ambiguity. A literally sharpened 7th would be an
            // octave, so Brazilian reuses `7+` for the major 7th; American
            // reads the `+` as raising the chord's 5th.
            const reading = readings.sevenPlus;
            ambiguities.push({
              kind: 'sevenPlus',
              text: `7+`,
              chosen: reading,
              alternatives: ['majorSeventh', 'dominantSharpFive'].filter(
                (r) => r !== reading
              ),
            });
            if (reading === 'majorSeventh') {
              majorSeventh = true;
              alter = 0;
            } else {
              alter = -1;
              exts.set(5, 1);
            }
          } else {
            alter = 1;
          }
          handled = true;
          j += 1;
        }

        // Brazilian writes a suspended fourth as a bare 4.
        if (!handled && degree === 4 && !sawQualityWord && exts.size === 0) {
          quality = 'sus4';
          sawQualityWord = true;
          i = j;
          break;
        }

        const isPrimary = primaryTop === null && !handled && degree >= 5;

        if (isPrimary) {
          primaryTop = degree;
          if (degree === 5) {
            // A bare `C5` is a power chord, unless a quality was already named.
            if (!sawQualityWord) quality = 'power';
          } else if (degree === 6) {
            exts.set(6, 0);
          } else {
            let addSeventh = true;
            if (degree === 9 && !majorSeventh && !sawSeventh) {
              const reading = readings.bareNine;
              ambiguities.push({
                kind: 'bareNine',
                text: `${degree}`,
                chosen: reading,
                alternatives: ['add', 'dominant'].filter((r) => r !== reading),
              });
              if (reading === 'add') addSeventh = false;
            }
            // A marker such as ø or alt has already fixed the 7th; the stated
            // top must not overwrite it with the quality's default.
            if (addSeventh && !sawSeventh) {
              exts.set(7, seventhAlter(quality, majorSeventh));
              sawSeventh = true;
            }
            // Only for a genuine upper extension: when the stated top *is* the
            // 7th, this would overwrite the alteration just chosen for it.
            if (degree !== 7) exts.set(degree, 0);
            for (const implied of stackFor(degree)) {
              if (!exts.has(implied)) exts.set(implied, 0);
            }
          }
        } else {
          exts.set(degree, alter);
          if (degree === 7) sawSeventh = true;
          if (primaryTop === null && handled && degree >= 7) primaryTop = degree;
        }
        i = j;
        break;
      }

      case 'SLASH':
        // A slash not followed by a note is compound notation, as in 6/9. One
        // followed by nothing at all is a typo.
        if (at(i + 1) !== 'NUM') {
          push('A "/" must be followed by a bass note or a number.', 'bassNeeded');
        }
        i += 1;
        break;

      default:
        push(`Unexpected "${t.text}".`, 'unexpected', { text: t.text });
        i += 1;
        break;
    }
  }

  // A named major 7th with no stated degree still means a 7th: `CM`, `C∆`.
  if (majorSeventh && !exts.has(7)) exts.set(7, 0);

  // The documented third ambiguity: `B°` with no 7th written. Convention reads
  // it as the diminished 7th, which is the shape people actually mean.
  if (bareDegreeSign && quality === 'dim' && !exts.has(7)) {
    const reading = readings.degreeSign;
    ambiguities.push({
      kind: 'degreeSign',
      text: '°',
      chosen: reading,
      alternatives: ['diminishedSeventh', 'diminishedTriad'].filter((r) => r !== reading),
    });
    if (reading === 'diminishedSeventh') exts.set(7, -2);
  }

  // Normalise triad-defining alterations into the quality, so that chords
  // which sound and function alike compare equal. m7b5 becomes a diminished
  // triad with a plain flat 7th; C7#5 becomes an augmented triad.
  if (quality === 'minor' && exts.get(5) === -1) {
    quality = 'dim';
    exts.delete(5);
  }
  if (quality === 'major' && exts.get(5) === 1) {
    quality = 'aug';
    exts.delete(5);
  }
  if (quality === 'aug' && exts.get(5) === 1) exts.delete(5);
  if (quality === 'dim' && exts.get(5) === -1) exts.delete(5);

  if (errors.length > 0) {
    return { chord: null, ambiguities, errors };
  }

  const extensions = [...exts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([degree, alter]) => ({ degree, alter }));

  try {
    return { chord: chord(root, quality, extensions, bass), ambiguities, errors };
  } catch (e) {
    return fail(e.message, e.code, e.params);
  }
}

/** Convenience for callers that only want a chord or null. */
export function tryParseChord(text, dialectId) {
  return parseChord(text, dialectId).chord;
}
