import { describe, it, expect } from 'vitest';
import {
  parseSong,
  setVoicing,
  setVoicingForKey,
  countForKey,
  songLegend,
  unvoicedKeys,
  measureCount,
  voicingsFor,
  songTunings,
  migrateSong,
} from './song.js';
import { shorthandOf, parseShorthand } from './fretstring.js';

const GUITAR = 'E2, A2, D3, G3, B3, E4';
const UKE = 'G4, C4, E4, A4';
const CM_OPEN = ['x', 3, 5, 5, 4, 3];
const CM_HIGH = [8, 10, 10, 8, 8, 8];
const A_OPEN = ['x', 0, 2, 2, 2, 0];
const CM_UKE = [0, 3, 3, 3];

const g = { tuning: GUITAR };
const u = { tuning: UKE };

/** The start offset of the nth occurrence of a symbol. */
const at = (text, symbol, nth = 0) =>
  parseSong(text).occurrences.filter((c) => c.symbol === symbol)[nth].start;
const chart = (text) => text.split('\n')[0];
const block = (text, tuning) => voicingsFor(parseSong(text), tuning);

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

  it('never reads the rule as a chord', () => {
    const song = parseSong('C | G\n\n---\n\n# Voicings: E2, A2, D3, G3, B3, E4\nC = x32010');
    expect(song.unknown).toEqual([]);
    expect(song.occurrences.map((c) => c.symbol)).toEqual(['C', 'G']);
  });
});

describe('voicing blocks are per tuning', () => {
  const text =
    'A | Cm | A | Cm[2]\n\n---\n\n' +
    '# Voicings: E2, A2, D3, G3, B3, E4\nA = x02220\nCm = x35543\nCm[2] = 8-10-10-8-8-8\n\n' +
    '# Voicings: G4, C4, E4, A4\nCm = 0333';

  it('reads each block for its own tuning', () => {
    const song = parseSong(text);
    expect(songTunings(song)).toEqual([GUITAR, UKE]);
    expect(block(text, GUITAR).get('Cm')).toEqual(CM_OPEN);
    expect(block(text, GUITAR).get('Cm[2]')).toEqual(CM_HIGH);
    expect(block(text, UKE).get('Cm')).toEqual(CM_UKE);
    expect(block(text, UKE).has('A')).toBe(false);
  });

  it('matches a tuning by its pitches, not its spacing or case', () => {
    expect(block(text, 'e2 a2 d3 g3 b3 e4').get('A')).toEqual(A_OPEN);
  });

  it('has nothing for a tuning with no block', () => {
    expect(block(text, 'D2, A2, D3, G3, A3, D4').size).toBe(0);
  });

  it('reports the legend and the unvoiced list per tuning', () => {
    const song = parseSong(text);
    expect(songLegend(song, GUITAR).map((e) => e.key)).toEqual(['A', 'Cm', 'Cm[2]']);
    expect(songLegend(song, UKE).map((e) => e.key)).toEqual(['Cm']);
    // On the ukulele, A and the second Cm variant are still unchosen.
    expect(unvoicedKeys(song, UKE)).toEqual(['A', 'Cm[2]']);
    expect(unvoicedKeys(song, GUITAR)).toEqual([]);
  });

  it('accepts a few ways of writing the heading', () => {
    for (const heading of ['# Voicings: X', '# Voicings X', '# Voicings for X', '# Voicings (X)']) {
      const song = parseSong(`C\n\n${heading}\nC = x32010`);
      expect(song.blocks[0].tuning, heading).toBe('X');
    }
  });

  it('rejects a malformed voicing line rather than guessing', () => {
    const song = parseSong('C\n\n# Voicings: X\nC = not-a-shape\nnonsense');
    expect(song.blocks[0].voicings.size).toBe(0);
    expect(song.problems).toHaveLength(2);
  });
});

describe('choosing a voicing', () => {
  it('writes a first voicing after a rule, labelled with the tuning', () => {
    const after = setVoicing('# Verse\nA | Cm', at('# Verse\nA | Cm', 'Cm'), CM_OPEN, g);
    expect(after).toBe(`# Verse\nA | Cm\n\n---\n\n# Voicings: ${GUITAR}\nCm = x35543\n`);
  });

  it('marks only the second voicing, leaving the first bare', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    expect(chart(text)).toBe('A | Cm | A | Cm[2]');
    expect(block(text, GUITAR).get('Cm')).toEqual(CM_OPEN);
    expect(block(text, GUITAR).get('Cm[2]')).toEqual(CM_HIGH);
  });

  it('reuses an existing voicing instead of adding a duplicate', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_OPEN, g);
    expect(chart(text)).toBe('A | Cm | A | Cm');
    expect(text).not.toContain('Cm[2]');
  });

  it('collapses markers when a chord returns to one voicing', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    expect(chart(text)).toBe('A | Cm | A | Cm[2]');
    text = setVoicing(text, at(text, 'Cm', 1), CM_OPEN, g);
    expect(chart(text)).toBe('A | Cm | A | Cm');
    expect(text).not.toContain('Cm[2]');
  });

  it('drops entries nothing refers to', () => {
    let text = 'A | Cm';
    text = setVoicing(text, at(text, 'A'), A_OPEN, g);
    text = setVoicing(text, at(text, 'Cm'), CM_OPEN, g);
    expect(text).toContain('A = x02220');
    text = setVoicing(text, at(text, 'A'), null, g);
    expect(text).not.toContain('A = x02220');
    expect(text).toContain('Cm = x35543');
  });

  it('removes the block and the rule once nothing is voiced', () => {
    let text = 'A | Cm';
    text = setVoicing(text, at(text, 'A'), A_OPEN, g);
    expect(text).toContain('---');
    text = setVoicing(text, at(text, 'A'), null, g);
    expect(text).not.toContain('# Voicings');
    expect(text).not.toContain('---');
    expect(text.trim()).toBe('A | Cm');
  });

  it('does not let rules pile up across edits', () => {
    let text = 'A | Cm';
    text = setVoicing(text, at(text, 'A'), A_OPEN, g);
    text = setVoicing(text, at(text, 'Cm'), CM_OPEN, g);
    text = setVoicingForKey(text, 'A', ['x', 0, 2, 2, 2, 'x'], g);
    expect(text.match(/^---$/gm)).toHaveLength(1);
  });

  it('preserves the chart formatting around it', () => {
    const before = '# Verse\nC   Am  |  F   G\n\n# Chorus\nC | G';
    const after = setVoicing(before, at(before, 'F'), [1, 3, 3, 2, 1, 1], g);
    expect(after).toContain('C   Am  |  F   G');
    expect(after).toContain('# Chorus');
    expect(after).toContain('F = 133211');
  });

  it('clears the entry, not just one occurrence of it', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 0), null, g);
    expect(block(text, GUITAR).size).toBe(0);
  });

  it('leaves a differently-voiced occurrence and its marker alone when clearing', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    text = setVoicing(text, at(text, 'Cm', 0), null, g);
    // The bare Cm now has no shape here and falls back to a default; the
    // marker is an arrangement decision and stays, since another tuning may
    // still give it meaning.
    expect(chart(text)).toBe('A | Cm | A | Cm[2]');
    expect(block(text, GUITAR).has('Cm')).toBe(false);
    expect(block(text, GUITAR).get('Cm[2]')).toEqual(CM_HIGH);
  });

  it('round-trips: the text is the whole state', () => {
    let text = 'A | Cm | A | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    const song = parseSong(text);
    const frets = song.occurrences.map((c) => voicingsFor(song, GUITAR).get(c.key) ?? null);
    expect(frets).toEqual([null, CM_OPEN, null, CM_HIGH]);
  });
});

describe('one chart, several instruments', () => {
  it('keeps each tuning in its own block', () => {
    let text = 'A | Cm';
    text = setVoicing(text, at(text, 'Cm'), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm'), CM_UKE, u);
    expect(chart(text)).toBe('A | Cm');
    expect(block(text, GUITAR).get('Cm')).toEqual(CM_OPEN);
    expect(block(text, UKE).get('Cm')).toEqual(CM_UKE);
    expect(text.match(/^# Voicings:/gm)).toHaveLength(2);
  });

  it('shares footnote markers, so each tuning says what its variant is', () => {
    let text = 'Cm | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    expect(chart(text)).toBe('Cm | Cm[2]');
    // The ukulele defines both variants too, on its own strings.
    text = setVoicingForKey(text, 'Cm', CM_UKE, u);
    text = setVoicingForKey(text, 'Cm[2]', [3, 3, 3, 6], u);
    expect(chart(text)).toBe('Cm | Cm[2]');
    expect(block(text, UKE).get('Cm[2]')).toEqual([3, 3, 3, 6]);
    expect(block(text, GUITAR).get('Cm[2]')).toEqual(CM_HIGH);
  });

  it('will not merge two variants another tuning tells apart', () => {
    // Guitar has two distinct Cm shapes. Choosing the *same* shape for both
    // on the ukulele must not collapse the guitar arrangement.
    let text = 'Cm | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    text = setVoicingForKey(text, 'Cm', CM_UKE, u);
    text = setVoicingForKey(text, 'Cm[2]', CM_UKE, u);
    expect(chart(text)).toBe('Cm | Cm[2]');
    expect(block(text, GUITAR).get('Cm[2]')).toEqual(CM_HIGH);
    // The ukulele simply has the same shape written under both keys.
    expect(block(text, UKE).get('Cm')).toEqual(CM_UKE);
    expect(block(text, UKE).get('Cm[2]')).toEqual(CM_UKE);
  });

  it('does merge when no other tuning distinguishes them', () => {
    let text = 'Cm | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    // Only guitar knows these apart, and on guitar they are now made equal.
    text = setVoicingForKey(text, 'Cm[2]', CM_OPEN, g);
    expect(chart(text)).toBe('Cm | Cm');
    expect(block(text, GUITAR).size).toBe(1);
  });

  it('renumbers every block together when a slot is dropped', () => {
    let text = 'Cm | Cm | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g); // slot 1, all three
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g); // splits off slot 2
    text = setVoicing(text, at(text, 'Cm', 2), ['x', 3, 1, 0, 1, 3], g); // slot 3
    text = setVoicingForKey(text, 'Cm[3]', [3, 3, 3, 6], u);
    expect(chart(text)).toBe('Cm | Cm[2] | Cm[3]');
    // Move the slot-2 bar onto slot 3's shape on guitar; slot 2 dies and
    // slot 3 becomes 2 in the chart and in *both* blocks.
    text = setVoicing(text, at(text, 'Cm', 1), ['x', 3, 1, 0, 1, 3], g);
    expect(chart(text)).toBe('Cm | Cm[2] | Cm[2]');
    expect(block(text, UKE).get('Cm[2]')).toEqual([3, 3, 3, 6]);
    expect(block(text, UKE).has('Cm[3]')).toBe(false);
  });

  it('a variant undefined on this tuning resolves to nothing chosen', () => {
    let text = 'Cm | Cm';
    text = setVoicing(text, at(text, 'Cm', 0), CM_OPEN, g);
    text = setVoicing(text, at(text, 'Cm', 1), CM_HIGH, g);
    expect(unvoicedKeys(parseSong(text), UKE)).toEqual(['Cm', 'Cm[2]']);
  });

  it('counts how many places use a key', () => {
    const song = parseSong('Cm | A | Cm | Cm[2]');
    expect(countForKey(song, 'Cm')).toBe(2);
    expect(countForKey(song, 'Cm[2]')).toBe(1);
  });
});

describe('the display sorts even when the text does not', () => {
  it('reads a hand-written block in any order and shows it sorted', () => {
    const text = `G | Am | C | D\n\n---\n\n# Voicings: ${GUITAR}\nG = 320003\nD = xx0232\nAm = x02210`;
    const song = parseSong(text);
    expect(songLegend(song, GUITAR).map((e) => e.key)).toEqual(['Am', 'D', 'G']);
    expect(unvoicedKeys(song, GUITAR)).toEqual(['C']);
  });

  it('leaves the text alone until something actually changes it', () => {
    const text = `G | Am\n\n---\n\n# Voicings: ${GUITAR}\nG = 320003\nAm = x02210`;
    expect(migrateSong(text, UKE)).toBe(text);
    const after = setVoicing(text, at(text, 'Am'), ['x', 0, 2, 2, 1, 0], g);
    const lines = after.slice(after.indexOf('# Voicings')).trim().split('\n').slice(1);
    expect(lines.map((l) => l.split(' =')[0])).toEqual(['Am', 'G']);
  });
});

describe('converting the earlier form', () => {
  it('turns a # Tuning line and a bare block into a labelled block', () => {
    const old = `# Tuning\n${GUITAR}\n\n# Verse\nC | G\n\n# Voicings\nC = x32010\nG = 320003`;
    const text = migrateSong(old, UKE);
    expect(text).not.toContain('# Tuning');
    expect(text).toContain(`# Voicings: ${GUITAR}`);
    expect(text).toContain('---');
    expect(block(text, GUITAR).get('C')).toEqual(['x', 3, 2, 0, 1, 0]);
    // The chart is untouched.
    expect(parseSong(text).sections.map((s) => s.name)).toEqual(['Verse']);
  });

  it('assumes the instrument in use for a bare block with no # Tuning', () => {
    const text = migrateSong('C | G\n\n# Voicings\nC = 0003', UKE);
    expect(text).toContain(`# Voicings: ${UKE}`);
    expect(block(text, UKE).get('C')).toEqual([0, 0, 0, 3]);
  });

  it('drops a # Tuning line that has no voicings to label', () => {
    const text = migrateSong(`# Tuning\n${GUITAR}\n\nC | G`, UKE);
    expect(text).not.toContain('# Tuning');
    expect(text.trim()).toBe('C | G');
  });

  it('is a no-op on the current form', () => {
    const text = `C\n\n---\n\n# Voicings: ${GUITAR}\nC = x32010\n`;
    expect(migrateSong(text, UKE)).toBe(text);
    expect(migrateSong('C | G', UKE)).toBe('C | G');
  });

  it('lets a labelled block outrank a bare one for the same tuning', () => {
    const old = `# Tuning\n${GUITAR}\n\nC\n\n# Voicings\nC = x32010\n\n# Voicings: ${GUITAR}\nC = x35553`;
    expect(block(migrateSong(old, UKE), GUITAR).get('C')).toEqual(['x', 3, 5, 5, 5, 3]);
  });
});
