import { describe, it, expect } from 'vitest';
import { layoutSection } from './chart-layout.js';

const section = (...lines) => ({
  name: '',
  lines: lines.map((measures) => ({
    measures: measures.map((chords) => ({ chords: chords.map((symbol) => ({ symbol })) })),
  })),
});

const spans = (rows) => rows.map((row) => row.map((cells) => cells.map((c) => c.span)));

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
    expect(rows[0][0].map((c) => c.chord.symbol)).toEqual(['C', 'Am']);
  });

  it('spans an empty measure across its position', () => {
    const rows = layoutSection(section([['C', 'Am']], [[]]));
    expect(rows[1][0]).toEqual([{ chord: null, span: 2 }]);
  });

  it('lets lines have different measure counts', () => {
    const rows = layoutSection(section([['C'], ['G'], ['D']], [['F']]));
    expect(spans(rows)).toEqual([[[1], [1], [1]], [[1]]]);
  });
});
