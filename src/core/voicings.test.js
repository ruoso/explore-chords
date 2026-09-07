import { describe, it, expect } from 'vitest';
import { parseChord } from './notation/parse.js';
import { fromCatalog } from './instrument.js';
import { searchFingerings } from './search.js';
import { parseSong, setVoicing } from './song.js';
import { defaultVoicing, resolveSongVoicings, unvoiceableKeys } from './voicings.js';

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
    text = setVoicing(text, parseSong(text).occurrences[0].start, ['x', 3, 5, 5, 5, 3]);
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
    text = setVoicing(text, parseSong(text).occurrences[1].start, ['x', 3, 5, 5, 5, 3]);
    const song = parseSong(text);
    expect(song.occurrences.map((c) => c.key)).toEqual(['C', 'C']);
    expect(resolveSongVoicings(song, guitar).get('C').source).toBe('chosen');
  });

  it('keeps the default for the bare key once a second shape is footnoted', () => {
    let text = 'C | C | C';
    // Two different explicit choices for the last two; the first is untouched.
    text = setVoicing(text, parseSong(text).occurrences[1].start, ['x', 3, 5, 5, 5, 3]);
    text = setVoicing(text, parseSong(text).occurrences[2].start, [8, 10, 10, 9, 8, 8]);
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
    text = setVoicing(text, parseSong(text).occurrences[0].start, ['x', 3, 5, 5, 5, 3]);
    text = setVoicing(text, parseSong(text).occurrences[0].start, null);
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
