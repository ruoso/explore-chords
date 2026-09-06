import { describe, it, expect } from 'vitest';
import {
  parseSong,
  setVoicing,
  setVoicingForKey,
  countForKey,
  songLegend,
  unvoicedKeys,
  measureCount,
} from './song.js';
import { shorthandOf, parseShorthand } from './fretstring.js';

const CM_OPEN = ['x', 3, 5, 5, 4, 3];
const CM_HIGH = [8, 10, 10, 8, 8, 8];
const A_OPEN = ['x', 0, 2, 2, 2, 0];

describe('fret strings', () => {
  it('runs single digits together and hyphenates double digits', () => {
    expect(shorthandOf(['x', 3, 2, 0, 1, 0])).toBe('x32010');
    expect(shorthandOf([8, 10, 10, 0, 8, 0])).toBe('8-10-10-0-8-0');
  });

  it('reads both forms back', () => {
    expect(parseShorthand('x32010')).toEqual(['x', 3, 2, 0, 1, 0]);
    expect(parseShorthand('8-10-10-0-8-0')).toEqual([8, 10, 10, 0, 8, 0]);
  });

  it('refuses things that are not fret patterns', () => {
    for (const bad of ['', '   ', 'hello', 'x-', '1-2-abc']) {
      expect(parseShorthand(bad), bad).toBeNull();
    }
  });
});

describe('reading a chart', () => {
  it('splits sections, lines and measures', () => {
    const song = parseSong('# Verse\nC  Am | F  G\nC | G\n\n# Chorus\nF | C');
    expect(song.sections.map((s) => s.name)).toEqual(['Verse', 'Chorus']);
    expect(song.sections[0].lines).toHaveLength(2);
    expect(song.sections[0].lines[0].measures).toHaveLength(2);
    expect(song.sections[0].lines[0].measures[0].chords.map((c) => c.symbol)).toEqual(['C', 'Am']);
    // Two lines of two measures in the verse, plus two in the chorus.
    expect(measureCount(song)).toBe(6);
  });

  it('keeps text written before any heading', () => {
    const song = parseSong('C | G\n# Verse\nF');
    expect(song.sections[0].name).toBe('');
    expect(song.sections[0].lines[0].measures).toHaveLength(2);
  });

  it('drops empty measures from doubled or trailing bars', () => {
    const song = parseSong('C || G |');
    expect(song.sections[0].lines[0].measures.map((m) => m.chords[0].symbol)).toEqual(['C', 'G']);
  });

  it('flags symbols that are not chords', () => {
    const song = parseSong('C | wobble | G');
    expect(song.unknown).toEqual(['wobble']);
    expect(song.occurrences.find((c) => c.symbol === 'wobble').valid).toBe(false);
  });
});

describe('footnote markers', () => {
  it('reads a marked chord as a separate voicing key', () => {
    const song = parseSong(
      'A | Cm | A | Cm[2]\n\n# Voicings\nA = x02220\nCm = x35543\nCm[2] = 8-10-10-8-8-8'
    );
    const keys = song.occurrences.map((c) => c.key);
    expect(keys).toEqual(['A', 'Cm', 'A', 'Cm[2]']);
    expect(song.voicings.get('Cm')).toEqual(CM_OPEN);
    expect(song.voicings.get('Cm[2]')).toEqual(CM_HIGH);
  });

  it('reports the legend once per distinct key', () => {
    const song = parseSong(
      'A | Cm | A | Cm[2]\n\n# Voicings\nA = x02220\nCm = x35543\nCm[2] = 8-10-10-8-8-8'
    );
    expect(songLegend(song).map((e) => e.key)).toEqual(['A', 'Cm', 'Cm[2]']);
  });

  it('lists chords still needing a voicing', () => {
    const song = parseSong('A | Cm\n\n# Voicings\nA = x02220');
    expect(unvoicedKeys(song)).toEqual(['Cm']);
  });

  it('rejects a malformed voicing line rather than guessing', () => {
    const song = parseSong('C\n\n# Voicings\nC = not-a-shape\nnonsense');
    expect(song.voicings.size).toBe(0);
    expect(song.problems).toHaveLength(2);
  });
});

describe('choosing a voicing', () => {
  const at = (song, symbol, nth = 0) =>
    song.occurrences.filter((c) => c.symbol === symbol)[nth].start;

  it('writes a first voicing with no marker', () => {
    const before = '# Verse\nA | Cm';
    const song = parseSong(before);
    const after = setVoicing(before, at(song, 'Cm'), CM_OPEN);

    expect(after).toContain('A | Cm');
    expect(after).toContain('# Voicings');
    expect(after).toContain('Cm = x35543');
    expect(after).not.toContain('Cm[');
  });

  it('marks only the second voicing, leaving the first bare', () => {
    // The shape the user asked for: `A | Cm | A | Cm[2]`.
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_HIGH);

    expect(text.split('\n')[0]).toBe('A | Cm | A | Cm[2]');
    expect(text).toContain('Cm = x35543');
    expect(text).toContain('Cm[2] = 8-10-10-8-8-8');
  });

  it('reuses an existing voicing instead of adding a duplicate', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    // The second occurrence gets the *same* shape: no new footnote.
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_OPEN);

    expect(text.split('\n')[0]).toBe('A | Cm | A | Cm');
    expect(text).not.toContain('Cm[2]');
    expect((text.match(/^Cm/gm) ?? [])).toHaveLength(1);
  });

  it('collapses markers when a chord returns to one voicing', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_HIGH);
    expect(text.split('\n')[0]).toBe('A | Cm | A | Cm[2]');

    // Put the second one back to the first shape.
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_OPEN);
    expect(text.split('\n')[0]).toBe('A | Cm | A | Cm');
    expect(text).not.toContain('Cm[2]');
  });

  it('drops entries nothing refers to', () => {
    let text = 'A | Cm';
    text = setVoicing(text, at(parseSong(text), 'A'), A_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm'), CM_OPEN);
    expect(text).toContain('A = x02220');

    // Clearing a choice removes its line.
    text = setVoicing(text, at(parseSong(text), 'A'), null);
    expect(text).not.toContain('A = x02220');
    expect(text).toContain('Cm = x35543');
  });

  it('removes the block entirely once nothing is voiced', () => {
    let text = 'A | Cm';
    text = setVoicing(text, at(parseSong(text), 'A'), A_OPEN);
    expect(text).toContain('# Voicings');
    text = setVoicing(text, at(parseSong(text), 'A'), null);
    expect(text).not.toContain('# Voicings');
    expect(text.trim()).toBe('A | Cm');
  });

  it('preserves the chart formatting around it', () => {
    const before = '# Verse\nC   Am  |  F   G\n\n# Chorus\nC | G';
    const song = parseSong(before);
    const after = setVoicing(before, at(song, 'F'), [1, 3, 3, 2, 1, 1]);

    expect(after).toContain('C   Am  |  F   G');
    expect(after).toContain('# Chorus');
    expect(after).toContain('F = 133211');
  });

  it('round-trips: the text is the whole state', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_HIGH);

    // Reading the produced text back gives exactly the same assignment, with
    // no app state involved.
    const reparsed = parseSong(text);
    const frets = reparsed.occurrences.map((c) => reparsed.voicings.get(c.key) ?? null);
    expect(frets).toEqual([null, CM_OPEN, null, CM_HIGH]);
  });
});

describe('clearing a shared voicing', () => {
  const at = (song, symbol, nth = 0) =>
    song.occurrences.filter((c) => c.symbol === symbol)[nth].start;

  it('clears the entry, not just one occurrence of it', () => {
    // Two occurrences share the bare `Cm` key. Clearing one has to remove the
    // entry: leaving it would keep both pointing at a voicing the user just
    // asked to remove, so the click would appear to do nothing.
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    expect(text).toContain('Cm = x35543');

    text = setVoicing(text, at(parseSong(text), 'Cm', 0), null);
    expect(text).not.toContain('Cm =');
    expect(parseSong(text).voicings.size).toBe(0);
  });

  it('leaves a differently-voiced occurrence alone', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_HIGH);

    // Clearing the first must not disturb the second, which is its own entry.
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), null);
    const song = parseSong(text);
    expect(song.voicings.get('Cm')).toEqual(CM_HIGH);
    expect(text.split('\n')[0]).toBe('A | Cm | A | Cm');
  });
});

describe('voicings are ordered for reading', () => {
  const at = (song, symbol, nth = 0) =>
    song.occurrences.filter((c) => c.symbol === symbol)[nth].start;

  it('writes the block alphabetically, not in the order chords appear', () => {
    let text = 'G | Am | C | D';
    text = setVoicing(text, at(parseSong(text), 'G'), [3, 2, 0, 0, 0, 3]);
    text = setVoicing(text, at(parseSong(text), 'Am'), ['x', 0, 2, 2, 1, 0]);
    text = setVoicing(text, at(parseSong(text), 'C'), ['x', 3, 2, 0, 1, 0]);
    text = setVoicing(text, at(parseSong(text), 'D'), ['x', 'x', 0, 2, 3, 2]);

    const block = text.slice(text.indexOf('# Voicings')).trim().split('\n').slice(1);
    expect(block.map((line) => line.split(' =')[0])).toEqual(['Am', 'C', 'D', 'G']);
  });

  it('keeps a chord and its footnotes together and in order', () => {
    let text = 'Cm | A | Cm | A';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_HIGH);
    text = setVoicing(text, at(parseSong(text), 'A', 0), A_OPEN);

    const block = text.slice(text.indexOf('# Voicings')).trim().split('\n').slice(1);
    expect(block.map((line) => line.split(' =')[0])).toEqual(['A', 'Cm', 'Cm[2]']);
  });

  it('orders the legend and the unvoiced list the same way', () => {
    const text = 'G | Am | C\n\n# Voicings\nG = 320003\nAm = x02210\nC = x32010';
    const song = parseSong(text);
    expect(songLegend(song).map((e) => e.key)).toEqual(['Am', 'C', 'G']);

    const partial = parseSong('G | Am | C\n\n# Voicings\nC = x32010');
    expect(unvoicedKeys(partial)).toEqual(['Am', 'G']);
  });

  it('does not let the written order disturb footnote numbering', () => {
    // The numbers come from first appearance in the chart. Writing the block
    // alphabetically must not renumber anything.
    let text = 'Cm | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 1), CM_HIGH);

    const song = parseSong(text);
    expect(song.voicings.get('Cm')).toEqual(CM_OPEN);
    expect(song.voicings.get('Cm[2]')).toEqual(CM_HIGH);
    expect(text.split('\n')[0]).toBe('Cm | Cm[2]');
  });
});

describe('the display sorts even when the text does not', () => {
  const at = (song, symbol, nth = 0) =>
    song.occurrences.filter((c) => c.symbol === symbol)[nth].start;

  it('reads a hand-written block in any order and shows it sorted', () => {
    const text = 'G | Am | C | D\n\n# Voicings\nG = 320003\nD = xx0232\nAm = x02210';
    const song = parseSong(text);

    // The text is however the author left it...
    expect(text).toContain('G = 320003\nD = xx0232\nAm = x02210');
    // ...but the legend is ordered for looking things up.
    expect(songLegend(song).map((e) => e.key)).toEqual(['Am', 'D', 'G']);
    expect(unvoicedKeys(song)).toEqual(['C']);
  });

  it('leaves the text alone until something actually changes it', () => {
    // Reordering someone's text merely because they opened the song would be
    // rude; the block normalises the next time a voicing is chosen.
    const text = 'G | Am\n\n# Voicings\nG = 320003\nAm = x02210';
    const song = parseSong(text);
    expect(songLegend(song).map((e) => e.key)).toEqual(['Am', 'G']);

    const after = setVoicing(text, at(song, 'Am'), ['x', 0, 2, 2, 1, 0]);
    const block = after.slice(after.indexOf('# Voicings')).trim().split('\n').slice(1);
    expect(block.map((line) => line.split(' =')[0])).toEqual(['Am', 'G']);
  });
});

describe('changing a voicing everywhere', () => {
  const at = (song, symbol, nth = 0) =>
    song.occurrences.filter((c) => c.symbol === symbol)[nth].start;
  const shapes = (text) => {
    const song = parseSong(text);
    return song.occurrences.map((c) => song.voicings.get(c.key) ?? null);
  };

  it('moves every occurrence that uses the key', () => {
    let text = 'Cm | A | Cm | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    expect(shapes(text)).toEqual([CM_OPEN, null, CM_OPEN, CM_OPEN]);

    // One change, three bars.
    text = setVoicingForKey(text, 'Cm', CM_HIGH);
    expect(shapes(text)).toEqual([CM_HIGH, null, CM_HIGH, CM_HIGH]);
    expect(text).toContain('Cm = 8-10-10-8-8-8');
    expect(text).not.toContain('Cm[2]');
  });

  it('leaves the chord\'s other voicing alone', () => {
    let text = 'Cm | Cm | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicing(text, at(parseSong(text), 'Cm', 2), CM_HIGH);
    expect(text.split('\n')[0]).toBe('Cm | Cm | Cm[2]');

    // Changing the default must not disturb the footnoted one.
    const other = ['x', 3, 1, 0, 1, 3];
    text = setVoicingForKey(text, 'Cm', other);
    expect(shapes(text)).toEqual([other, other, CM_HIGH]);
    expect(text.split('\n')[0]).toBe('Cm | Cm | Cm[2]');
  });

  it('collapses two entries when one is changed to match the other', () => {
    let text = 'Cm | Cm[2]\n\n# Voicings\nCm = x35543\nCm[2] = 8-10-10-8-8-8';
    text = setVoicingForKey(text, 'Cm[2]', CM_OPEN);

    // They are the same shape now, so there is nothing to footnote.
    expect(text.split('\n')[0]).toBe('Cm | Cm');
    expect(text).not.toContain('Cm[2]');
    expect(shapes(text)).toEqual([CM_OPEN, CM_OPEN]);
  });

  it('clears the key everywhere when given null', () => {
    let text = 'Cm | A | Cm';
    text = setVoicing(text, at(parseSong(text), 'Cm', 0), CM_OPEN);
    text = setVoicingForKey(text, 'Cm', null);
    expect(shapes(text)).toEqual([null, null, null]);
    expect(text).not.toContain('# Voicings');
  });

  it('ignores a key the chart does not use', () => {
    const text = 'Cm | A\n\n# Voicings\nCm = x35543';
    expect(setVoicingForKey(text, 'Bb', CM_OPEN)).toBe(text);
  });

  it('counts how many places use a key', () => {
    const song = parseSong('Cm | A | Cm | Cm[2]');
    expect(countForKey(song, 'Cm')).toBe(2);
    expect(countForKey(song, 'Cm[2]')).toBe(1);
    expect(countForKey(song, 'A')).toBe(1);
  });
});
