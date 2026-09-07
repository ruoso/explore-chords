/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from './store.js';
import { saveInstruments, saveActiveId, saveActiveSheetId, clearAll } from './persist.js';
import { saveSheets } from './sheets.js';
import { fromCatalog } from '../core/instrument.js';
import { parseSong, voicingsFor } from '../core/song.js';

const GUITAR = 'E2, A2, D3, G3, B3, E4';
const UKE = 'G4, C4, E4, A4';

/** A song as the earlier form wrote it: a # Tuning line and a bare block. */
const legacy = (tuning, chart, voicings) =>
  `# Tuning\n${tuning}\n\n${chart}\n\n# Voicings\n${voicings}`;

function seed(sheets, { activeSheet } = {}) {
  clearAll();
  const guitar = fromCatalog('6guitar');
  saveInstruments([guitar]);
  saveActiveId(guitar.id);
  saveSheets(sheets.map((s, i) => ({ id: `s${i}`, updated: i, ...s })));
  if (activeSheet) saveActiveSheetId(activeSheet);
}

describe('loading songs saved under the earlier form', () => {
  beforeEach(() => clearAll());

  it('converts each song and folds per-instrument copies into one', () => {
    seed([
      { title: 'Blackbird', body: legacy(GUITAR, '# Verse\nC | G', 'C = x32010') },
      { title: 'Blackbird', body: legacy(UKE, '# Verse\nC | G', 'C = 0003') },
    ]);
    const store = createStore();

    expect(store.state.sheets).toHaveLength(1);
    const song = parseSong(store.state.sheets[0].body);
    expect(store.state.sheets[0].body).not.toContain('# Tuning');
    expect(voicingsFor(song, GUITAR).get('C')).toEqual(['x', 3, 2, 0, 1, 0]);
    expect(voicingsFor(song, UKE).get('C')).toEqual([0, 0, 0, 3]);
    // The older copy is the one kept, so anything pointing at it still works.
    expect(store.state.sheets[0].id).toBe('s0');
  });

  it('leaves copies alone when their charts have diverged', () => {
    seed([
      { title: 'Blackbird', body: legacy(GUITAR, '# Verse\nC | G', 'C = x32010') },
      { title: 'Blackbird', body: legacy(UKE, '# Verse\nC | G | Am', 'C = 0003') },
    ]);
    expect(createStore().state.sheets).toHaveLength(2);
  });

  it('leaves copies alone when a tuning is voiced in both', () => {
    seed([
      { title: 'Blackbird', body: legacy(GUITAR, '# Verse\nC | G', 'C = x32010') },
      { title: 'Blackbird', body: legacy(GUITAR, '# Verse\nC | G', 'C = x35553') },
    ]);
    expect(createStore().state.sheets).toHaveLength(2);
  });

  it('does not merge songs that merely share a title and template', () => {
    seed([
      { title: 'New song', body: '# Verse\nC  Am | F  G | C' },
      { title: 'New song', body: '# Verse\nC  Am | F  G | C' },
    ]);
    expect(createStore().state.sheets).toHaveLength(2);
  });

  it('clears the open song if it was a copy that got folded away', () => {
    seed(
      [
        { title: 'Blackbird', body: legacy(GUITAR, '# Verse\nC | G', 'C = x32010') },
        { title: 'Blackbird', body: legacy(UKE, '# Verse\nC | G', 'C = 0003') },
      ],
      { activeSheet: 's1' }
    );
    const store = createStore();
    expect(store.state.sheets).toHaveLength(1);
    expect(store.activeSheet).toBeNull();
  });

  it('is idempotent: a second load changes nothing', () => {
    seed([
      { title: 'Blackbird', body: legacy(GUITAR, '# Verse\nC | G', 'C = x32010') },
      { title: 'Blackbird', body: legacy(UKE, '# Verse\nC | G', 'C = 0003') },
    ]);
    const first = createStore().state.sheets;
    const second = createStore().state.sheets;
    expect(second).toHaveLength(1);
    expect(second[0].body).toBe(first[0].body);
  });
});
