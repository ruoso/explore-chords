/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { newSheet, newSection, newSlot, sheetLegend, moveSection, sheetForSharing, sheetFromSharing } from './sheets.js';
import { encodePayload, decodePayload } from './codec.js';
import { fromCatalog } from '../core/instrument.js';

describe('the sheet legend', () => {
  it('lists each distinct chord and shape exactly once', () => {
    const sheet = newSheet({
      sections: [
        newSection({
          name: 'Verse',
          slots: [
            newSlot({ chordText: 'C', frets: ['x', 3, 2, 0, 1, 0] }),
            newSlot({ chordText: 'G', frets: [3, 2, 0, 0, 0, 3] }),
            // The same shape again is still one shape.
            newSlot({ chordText: 'C', frets: ['x', 3, 2, 0, 1, 0] }),
          ],
        }),
        newSection({
          name: 'Chorus',
          slots: [
            newSlot({ chordText: 'C', frets: ['x', 3, 2, 0, 1, 0] }),
            // A different shape of the same chord is a second entry.
            newSlot({ chordText: 'C', frets: [8, 10, 10, 9, 8, 8] }),
          ],
        }),
      ],
    });

    const legend = sheetLegend(sheet);
    expect(legend).toHaveLength(3);
    expect(legend.filter((e) => e.chordText === 'C')).toHaveLength(2);
  });
});

describe('moving sections', () => {
  it('swaps neighbours and refuses to run off either end', () => {
    const a = newSection({ name: 'A' });
    const b = newSection({ name: 'B' });
    const sheet = newSheet({ sections: [a, b] });

    expect(moveSection(sheet, b.id, -1).sections.map((s) => s.name)).toEqual(['B', 'A']);
    expect(moveSection(sheet, a.id, -1).sections.map((s) => s.name)).toEqual(['A', 'B']);
    expect(moveSection(sheet, b.id, 1).sections.map((s) => s.name)).toEqual(['A', 'B']);
  });
});

describe('the share codec', () => {
  it('round-trips a payload', async () => {
    const value = { title: 'Song', sections: [{ name: 'Verse', slots: [{ c: 'C', f: ['x', 3, 2, 0, 1, 0] }] }] };
    expect(await decodePayload(await encodePayload(value))).toEqual(value);
  });

  it('round-trips a large payload, and compresses it', async () => {
    const slots = Array.from({ length: 200 }, (_, i) => ({ c: 'Cmaj7', f: ['x', 3, 2, 0, 1, i % 5] }));
    const value = { title: 'Long', sections: [{ name: 'Verse', slots }] };
    const encoded = await encodePayload(value);
    expect(await decodePayload(encoded)).toEqual(value);
    // Repetitive content must actually shrink, or the fragment gets unwieldy.
    expect(encoded.length).toBeLessThan(JSON.stringify(value).length / 2);
  });

  it('rejects rubbish without hanging', async () => {
    await expect(decodePayload('')).rejects.toThrow();
    await expect(decodePayload('q' + 'AAAA')).rejects.toThrow(/format/);
  });
});

describe('sharing a sheet', () => {
  it('carries the instrument, so the recipient sees it as written', async () => {
    const guitar = fromCatalog('6guitar');
    const sheet = newSheet({
      title: 'Blackbird',
      instrumentId: guitar.id,
      sections: [
        newSection({ name: 'Verse', slots: [newSlot({ chordText: 'C', frets: ['x', 3, 2, 0, 1, 0] })] }),
      ],
    });

    const payload = sheetForSharing(sheet, guitar);
    expect(payload.instrument.strings).toBe('E2, A2, D3, G3, B3, E4');

    const restored = sheetFromSharing(await decodePayload(await encodePayload(payload)), 'other');
    expect(restored.title).toBe('Blackbird');
    expect(restored.instrumentId).toBe('other');
    expect(restored.sections[0].name).toBe('Verse');
    expect(restored.sections[0].slots[0].chordText).toBe('C');
    expect(restored.sections[0].slots[0].frets).toEqual(['x', 3, 2, 0, 1, 0]);
  });

  it('refuses a payload that is not a sheet', () => {
    expect(() => sheetFromSharing({ nope: true }, 'i')).toThrow(/song sheet/);
  });
});
