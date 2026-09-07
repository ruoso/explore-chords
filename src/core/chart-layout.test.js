import { describe, it, expect } from 'vitest';
import { layoutSection } from './chart-layout.js';

const section = (...lines) => ({
  name: '',
  lines: lines.map((measures) => ({
    lyrics: false,
    measures: measures.map((chords) => ({
      segments: chords.map((symbol) => ({ chord: { symbol }, lyric: '' })),
    })),
  })),
});

/** A section of sung lines: each line is a list of [symbol, words] segments. */
const sung = (...lines) => ({
  name: '',
  lines: lines.map((segments) => ({
    lyrics: true,
    measures: [
      { segments: segments.map(([symbol, lyric]) => ({ chord: symbol ? { symbol } : null, lyric })) },
    ],
  })),
});

const spans = (rows) => rows.map((row) => row.measures.map((cells) => cells.map((c) => c.span)));

describe('layoutSection', () => {
  it('gives one column to a measure position no line splits', () => {
    const rows = layoutSection(section([['C'], ['G']], [['Am'], ['F']]));
    expect(spans(rows)).toEqual([
      [[1], [1]],
      [[1], [1]],
    ]);
  });

  it('widens a position to the most chords any line puts there', () => {
    const rows = layoutSection(section([['C', 'Am'], ['G']], [['F'], ['G']]));
    expect(spans(rows)).toEqual([
      [[1, 1], [1]],
      [[2], [1]],
    ]);
  });

  it('splits a wide position evenly where the chord count divides it', () => {
    const rows = layoutSection(section([['C', 'D', 'E', 'F']], [['G', 'A']]));
    expect(spans(rows)).toEqual([[[1, 1, 1, 1]], [[2, 2]]]);
  });

  it('puts the remainder on the last chord where it does not', () => {
    const rows = layoutSection(section([['C', 'D', 'E']], [['G', 'A']]));
    expect(spans(rows)).toEqual([[[1, 1, 1]], [[1, 2]]]);
  });

  it('keeps the chords with their cells', () => {
    const rows = layoutSection(section([['C', 'Am']]));
    expect(rows[0].measures[0].map((c) => c.segment.chord.symbol)).toEqual(['C', 'Am']);
  });

  it('spans an empty measure across its position', () => {
    const rows = layoutSection(section([['C', 'Am']], [[]]));
    expect(rows[1].measures[0]).toEqual([{ segment: { chord: null, lyric: '' }, span: 2 }]);
  });

  it('lets lines have different measure counts', () => {
    const rows = layoutSection(section([['C'], ['G'], ['D']], [['F']]));
    expect(spans(rows)).toEqual([[[1], [1], [1]], [[1]]]);
  });

  it('gives a sung line one column per segment and joins it to no grid', () => {
    // Two sung lines have nothing to align: the first phrase of one has no
    // relation to the first phrase of the next, and sharing widths would pad
    // every segment out to the longest word in its column.
    const rows = layoutSection(sung([['C', 'Quando eu '], ['G', 'te vi']], [['Am', 'passar']]));
    expect(spans(rows)).toEqual([[[1, 1]], [[1]]]);
    expect(rows.every((row) => row.lyrics)).toBe(true);
    expect(rows[0].measures[0][0].segment.lyric).toBe('Quando eu ');
  });

  it("does not let a sung line widen a chart line's columns", () => {
    const mixed = {
      name: '',
      lines: [...section([['C'], ['G']]).lines, ...sung([['Am', 'words'], ['F', 'here']]).lines],
    };
    expect(spans(layoutSection(mixed))).toEqual([[[1], [1]], [[1, 1]]]);
  });
});
