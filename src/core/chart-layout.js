/**
 * Column layout for a chart section (docs/DESIGN.md §2.6).
 *
 * Measures line up in columns, and inside a measure each chord takes a column
 * of its own, so a bar split two ways reads as two half-width cells under the
 * bars around it. How many columns a measure position has is the most chords
 * any line of the section puts there; a measure with fewer spans the rest,
 * evenly where the count divides and with the remainder on its last chord
 * where it does not.
 */

/**
 * @typedef {object} Cell
 * @property {import('./song.js').ChordRef|null} chord  null for an empty measure
 * @property {number} span   columns the cell covers
 */

/**
 * @param {{lines:{measures:{chords:object[]}[]}[]}} section
 * @returns {Cell[][][]}  rows → measures → cells
 */
export function layoutSection(section) {
  const widths = [];
  for (const line of section.lines) {
    line.measures.forEach((measure, i) => {
      widths[i] = Math.max(widths[i] ?? 1, measure.chords.length);
    });
  }
  return section.lines.map((line) =>
    line.measures.map((measure, i) => {
      const width = widths[i];
      const count = measure.chords.length;
      if (count === 0) return [{ chord: null, span: width }];
      const base = Math.floor(width / count);
      const remainder = width - base * count;
      return measure.chords.map((chord, j) => ({
        chord,
        span: base + (j === count - 1 ? remainder : 0),
      }));
    })
  );
}
