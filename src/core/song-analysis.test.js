import { describe, it, expect } from 'vitest';
import { parseSong } from './song.js';
import { analyseSong } from './song-analysis.js';
import { formatNote } from './pitch.js';
import { bassNote } from './chord.js';

const read = (text) => analyseSong(parseSong(text, 'brazilian'), 'brazilian');
const walks = (text) => read(text).spans.filter((s) => s.kind === 'walking');

describe('the line a chart implies', () => {
  it('is one entry per chord written, in reading order', () => {
    const reading = read('C | G | Am');
    expect(reading.line.map((e) => e.ref.symbol)).toEqual(['C', 'G', 'Am']);
    expect(reading.line.map((e) => e.at)).toEqual([0, 1, 2]);
  });

  it('counts a chord once per bar it is written in, not once per song', () => {
    // Two bars of C are two entries: a plan speaks per bar.
    expect(read('C | G | C').line).toHaveLength(3);
  });

  it('skips a repeat sign, which writes no chord and moves no bass', () => {
    expect(read('C | % | G').line.map((e) => e.ref.symbol)).toEqual(['C', 'G']);
  });

  it('takes the bass the chart states, and the root where it states none', () => {
    const reading = read('C | D7/F# | Gm');
    const names = reading.line.map((e) => formatNote(bassNote(e.chord)));
    expect(names).toEqual(['C', 'F#', 'G']);
  });

  it('carries a chord that does not parse, with nothing to say about it', () => {
    const [, middle] = read('C | Zq9 | G').line;
    expect(middle.chord).toBe(null);
    expect(middle.bassPc).toBe(null);
  });
});

/**
 * Not "chromatic runs": the sources describe a line that avoids leaps, mixing
 * tones and semitones (docs/DESIGN.md §2.10).
 */
describe('where the bass walks', () => {
  it('finds a run of steps in one direction', () => {
    const [span] = walks('F | F#° | Gm');
    expect(span).toMatchObject({ from: 0, to: 2, detail: { direction: 'up', chromatic: true } });
  });

  it('counts whole tones as walking, and says the run was not all semitones', () => {
    // The Vibrações bass line: ré mi fá fá# sol lá sib.
    const [span] = walks('Dm | E7 | F | F#° | G7 | A7 | Bb');
    expect(span).toMatchObject({ from: 0, to: 6, detail: { direction: 'up', chromatic: false } });
  });

  it('will not call one step a run', () => {
    // Two chords are one step, and one step is not yet a line going anywhere.
    expect(walks('F | F#°')).toEqual([]);
  });

  it('ends a run at a leap', () => {
    const spans = walks('C | C#° | D | Ab | A | Bb | B');
    expect(spans.map((s) => [s.from, s.to])).toEqual([
      [0, 2],
      [3, 6],
    ]);
  });

  it('ends a run where the direction turns', () => {
    const spans = walks('C | C# | D | C# | C');
    expect(spans.map((s) => [s.from, s.to, s.detail.direction])).toEqual([
      [0, 2, 'up'],
      [2, 4, 'down'],
    ]);
  });

  it('ends a run at a chord it cannot read', () => {
    expect(walks('C | C# | Zq9 | D | Eb')).toEqual([]);
  });

  it('hears B to C as a step up rather than a leap down', () => {
    // Pitch classes wrap; a player does not.
    const [span] = walks('Bb | B | C');
    expect(span).toMatchObject({ from: 0, to: 2, detail: { direction: 'up' } });
  });

  it('is not fooled by a bass that stays put', () => {
    expect(walks('Gm | Gm6 | Gm7')).toEqual([]);
  });

  it('answers what is true at one bar', () => {
    const reading = read('C | Ab | A | Bb | B');
    expect(reading.spansAt(0)).toEqual([]);
    expect(reading.spansAt(2, 'walking')).toHaveLength(1);
    expect(reading.spansAt(2, 'pedal')).toEqual([]);
  });
});
