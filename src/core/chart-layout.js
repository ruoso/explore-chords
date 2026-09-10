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
 * @property {{chord: import('./song.js').ChordRef|null, lyric: string}} segment
 * @property {number} span   columns the cell covers
 *
 * @typedef {object} Row
 * @property {boolean} lyrics  whether this line carries words
 * @property {boolean} blank   whether it is a stanza break
 * @property {Cell[][]} measures
 */

/**
 * Lines that carry words are laid out on their own.
 *
 * Sharing column widths is the whole point for a chart, where the third bar of
 * one line belongs over the third bar of the next. It is meaningless between
 * two sung lines, whose first phrases have nothing to do with each other, and
 * it would pad every segment out to the longest word in its column. So a sung
 * line takes one column per segment and joins no grid.
 *
 * @param {{lines:{measures:{segments:object[]}[], lyrics:boolean}[]}} section
 * @returns {Row[]}
 */
export function layoutSection(section) {
  const widths = [];
  for (const line of section.lines) {
    if (line.lyrics) continue;
    line.measures.forEach((measure, i) => {
      widths[i] = Math.max(widths[i] ?? 1, measure.segments.length);
    });
  }
  return section.lines.map((line) => ({
    lyrics: Boolean(line.lyrics),
    blank: Boolean(line.blank),
    measures: line.measures.map((measure, i) => {
      const count = measure.segments.length;
      if (line.lyrics) return measure.segments.map((segment) => ({ segment, span: 1 }));
      const width = widths[i];
      if (count === 0) return [{ segment: { chord: null, mark: '', lyric: '' }, span: width }];
      const base = Math.floor(width / count);
      const remainder = width - base * count;
      return measure.segments.map((segment, j) => ({
        segment,
        span: base + (j === count - 1 ? remainder : 0),
      }));
    }),
  }));
}
