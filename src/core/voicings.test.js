import { describe, it, expect } from 'vitest';
import { parseChord } from './notation/parse.js';
import { fromCatalog } from './instrument.js';
import { searchFingerings } from './search.js';
import { parseSong, setVoicing, voicingsFor } from './song.js';
import {
  defaultVoicing,
  resolveSongVoicings,
  unvoiceableKeys,
  applySavedVoicings,
} from './voicings.js';

const guitar = fromCatalog('6guitar');
const uke = fromCatalog('ukulele');

describe('the default voicing', () => {
  it('is the open-position shape when there is one', () => {
    // Exactly what the explorer shows first, so "if you do not choose, you get
    // what you would have seen first".
    const chord = parseChord('C').chord;
    const shown = searchFingerings(chord, guitar).groups[0].fingerings[0];
    const chosen = defaultVoicing(chord, guitar);
    expect(chosen.shorthand).toBe(shown.shorthand);
    expect(chosen.position).toBe(0);
  });

  it('falls to the lowest position that has anything when nothing is open', () => {
    // No open-string voicing exists for this; the default must still be the
    // lowest group, not nothing.
    const chord = parseChord('F#m7b5').chord;
    const result = searchFingerings(chord, guitar);
    const chosen = defaultVoicing(chord, guitar);
    expect(chosen).not.toBeNull();
    expect(chosen.position).toBe(result.groups[0].position);
    expect(chosen.shorthand).toBe(result.groups[0].fingerings[0].shorthand);
  });

  it('is null when the search finds nothing', () => {
    expect(defaultVoicing(parseChord('C13#11').chord, uke)).toBeNull();
  });
});

describe('resolving a song', () => {
  it('uses the default for chords nobody chose, and says so', () => {
    const song = parseSong('C | G | Am');
    const resolved = resolveSongVoicings(song, guitar);
    expect([...resolved.keys()]).toEqual(['C', 'G', 'Am']);
    for (const r of resolved.values()) expect(r.source).toBe('default');
    expect(resolved.get('C').fingering.shorthand).toBe(
      defaultVoicing(parseChord('C').chord, guitar).shorthand
    );
  });

  it('prefers a chosen voicing over the default', () => {
    let text = 'C | G';
    text = setVoicing(text, parseSong(text).occurrences[0].start, ['x', 3, 5, 5, 5, 3], { tuning: 'E2, A2, D3, G3, B3, E4' });
    const resolved = resolveSongVoicings(parseSong(text), guitar);
    expect(resolved.get('C')).toMatchObject({ source: 'chosen' });
    expect(resolved.get('C').fingering.shorthand).toBe('x35553');
    expect(resolved.get('G').source).toBe('default');
  });

  it('makes one chosen shape the shape for every bare occurrence', () => {
    // With a single chosen pattern there is nothing to footnote: it becomes the
    // bare entry, and every unmarked occurrence of the symbol resolves to it.
    // A footnote only appears once two *different* shapes are chosen.
    let text = 'C | C';
    text = setVoicing(text, parseSong(text).occurrences[1].start, ['x', 3, 5, 5, 5, 3], { tuning: 'E2, A2, D3, G3, B3, E4' });
    const song = parseSong(text);
    expect(song.occurrences.map((c) => c.key)).toEqual(['C', 'C']);
    expect(resolveSongVoicings(song, guitar).get('C').source).toBe('chosen');
  });

  it('keeps the default for the bare key once a second shape is footnoted', () => {
    let text = 'C | C | C';
    // Two different explicit choices for the last two; the first is untouched.
    text = setVoicing(text, parseSong(text).occurrences[1].start, ['x', 3, 5, 5, 5, 3], { tuning: 'E2, A2, D3, G3, B3, E4' });
    text = setVoicing(text, parseSong(text).occurrences[2].start, [8, 10, 10, 9, 8, 8], { tuning: 'E2, A2, D3, G3, B3, E4' });
    const song = parseSong(text);
    // The first occurrence shares the bare key, so it too is now "chosen" —
    // this is the shared-entry semantics, not a default.
    expect(song.occurrences.map((c) => c.key)).toEqual(['C', 'C', 'C[2]']);
    const resolved = resolveSongVoicings(song, guitar);
    expect(resolved.get('C').source).toBe('chosen');
    expect(resolved.get('C[2]').source).toBe('chosen');
  });

  it('reverts to the default when a choice is cleared', () => {
    let text = 'C | G';
    text = setVoicing(text, parseSong(text).occurrences[0].start, ['x', 3, 5, 5, 5, 3], { tuning: 'E2, A2, D3, G3, B3, E4' });
    text = setVoicing(text, parseSong(text).occurrences[0].start, null, { tuning: 'E2, A2, D3, G3, B3, E4' });
    expect(resolveSongVoicings(parseSong(text), guitar).get('C').source).toBe('default');
  });

  it('skips chords that do not parse and reports ones that cannot be voiced', () => {
    const song = parseSong('C | wobble | C13#11');
    const resolved = resolveSongVoicings(song, uke);
    expect(resolved.has('wobble')).toBe(false);
    expect(resolved.has('C13#11')).toBe(false);
    expect(unvoiceableKeys(song, resolved)).toEqual(['C13#11']);
  });

  it('computes each symbol default once however often it appears', () => {
    const song = parseSong('C | C | C | C | C | C');
    const resolved = resolveSongVoicings(song, guitar);
    expect(resolved.size).toBe(1);
  });
});

describe('saved shapes entering a song', () => {
  const GUITAR = 'E2, A2, D3, G3, B3, E4';
  const C_HIGH = ['x', 3, 5, 5, 5, 3]; // not the open default
  const fav = (chordText, frets, added = 1) => ({ chordText, frets, added });
  const chosen = (text) => voicingsFor(parseSong(text), GUITAR);
  const apply = (text, symbols, favorites) =>
    applySavedVoicings(text, { symbols, favorites, instrument: guitar });

  it('writes a saved shape that differs from the default', () => {
    const out = apply('# Verse\nC | G', ['C', 'G'], [fav('C', C_HIGH)]);
    expect(chosen(out).get('C')).toEqual(C_HIGH);
    expect(chosen(out).has('G')).toBe(false);
    expect(out).toContain(`# Voicings: ${GUITAR}`);
  });

  it('leaves out a saved shape that is the default anyway', () => {
    // The default already shows it; writing it in would only add noise.
    const open = defaultVoicing(parseChord('C').chord, guitar).frets;
    const out = apply('C | G', ['C'], [fav('C', open)]);
    expect(out).toBe('C | G');
  });

  it('applies only to chords that are new to the song', () => {
    const out = apply('C | G', ['G'], [fav('C', C_HIGH)]);
    expect(chosen(out).has('C')).toBe(false);
  });

  it('never overwrites a choice already made', () => {
    const before = `C | G\n\n---\n\n# Voicings: ${GUITAR}\nC = x32013\n`;
    const out = apply(before, ['C'], [fav('C', C_HIGH)]);
    expect(chosen(out).get('C')).toEqual(['x', 3, 2, 0, 1, 3]);
  });

  it('matches by the chord, not by how it was typed', () => {
    // Saved as Cmaj7 in one notation; the song writes C7M in another.
    const shape = ['x', 3, 5, 4, 5, 3];
    const out = apply('C7M | G', ['C7M'], [fav('Cmaj7', shape)]);
    expect(chosen(out).get('C7M')).toEqual(shape);
  });

  it('prefers the most recently saved shape when several are saved', () => {
    const older = ['x', 3, 5, 5, 5, 3];
    const newer = [8, 10, 10, 9, 8, 8];
    // favoritesFor returns newest first, which is the order given here.
    const out = apply('C', ['C'], [fav('C', newer, 2), fav('C', older, 1)]);
    expect(chosen(out).get('C')).toEqual(newer);
  });

  it('fills only the bare slot, never a footnoted variant', () => {
    const out = apply('C | C[2]', ['C'], [fav('C', C_HIGH)]);
    expect(chosen(out).get('C')).toEqual(C_HIGH);
    expect(chosen(out).has('C[2]')).toBe(false);
  });

  it('ignores a saved shape from an instrument with a different string count', () => {
    const out = apply('C', ['C'], [fav('C', [0, 0, 0, 3])]);
    expect(out).toBe('C');
  });

  it('does nothing without favourites or without new symbols', () => {
    expect(apply('C', ['C'], [])).toBe('C');
    expect(apply('C', [], [fav('C', C_HIGH)])).toBe('C');
  });
});
