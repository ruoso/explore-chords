/**
 * Fret patterns as text: `x32010`, or `8-10-10-9-8-8`.
 *
 * The compact form is how players write a shape. Once any fret reaches double
 * digits the run-together form is ambiguous — [8,10,10,0,8,0] would read as
 * "81010080" — so those are hyphenated instead, which is the usual convention.
 */

/** @param {(number|'x')[]} frets */
export function shorthandOf(frets) {
  const needsSeparator = frets.some((f) => typeof f === 'number' && f >= 10);
  const parts = frets.map((f) => (f === 'x' ? 'x' : String(f)));
  return needsSeparator ? parts.join('-') : parts.join('');
}

/**
 * Read a fret pattern back.
 * @returns {(number|'x')[]|null} null when the text is not a fret pattern
 */
export function parseShorthand(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;

  const parts = trimmed.includes('-') ? trimmed.split('-') : [...trimmed];
  const frets = [];
  for (const part of parts) {
    const token = part.trim();
    if (token === 'x' || token === 'X') {
      frets.push('x');
      continue;
    }
    if (!/^\d{1,2}$/.test(token)) return null;
    frets.push(Number(token));
  }
  return frets.length > 0 ? frets : null;
}
