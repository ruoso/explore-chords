/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { newSheet, sheetForSharing, sheetFromSharing } from './sheets.js';
import { encodePayload, decodePayload } from './codec.js';
import { parseSong, setVoicing, voicingsFor } from '../core/song.js';
import { fromCatalog } from '../core/instrument.js';

describe('the share codec', () => {
  it('round-trips a payload', async () => {
    const value = { title: 'Song', body: '# Verse\nC | G' };
    expect(await decodePayload(await encodePayload(value))).toEqual(value);
  });

  it('round-trips a large payload, and compresses it', async () => {
    const body = Array.from({ length: 300 }, () => 'C  Am | F  G').join('\n');
    const value = { title: 'Long', body };
    const encoded = await encodePayload(value);
    expect(await decodePayload(encoded)).toEqual(value);
    // Repetitive content must actually shrink, or the fragment gets unwieldy.
    expect(encoded.length).toBeLessThan(JSON.stringify(value).length / 2);
  });

  it('rejects rubbish without hanging', async () => {
    await expect(decodePayload('')).rejects.toThrow();
    await expect(decodePayload('qAAAA')).rejects.toThrow(/format/);
  });
});

describe('sharing a song', () => {
  it('carries the instrument and the whole song text', async () => {
    const guitar = fromCatalog('6guitar');
    let body = '# Verse\nA | Cm | A | Cm';
    body = setVoicing(body, parseSong(body).occurrences[1].start, ['x', 3, 5, 5, 4, 3], { tuning: 'E2, A2, D3, G3, B3, E4' });
    body = setVoicing(body, parseSong(body).occurrences[3].start, [8, 10, 10, 8, 8, 8], { tuning: 'E2, A2, D3, G3, B3, E4' });

    const sheet = newSheet({ title: 'Blackbird', body });
    const payload = sheetForSharing(sheet, guitar);
    expect(payload.instrument.strings).toBe('E2, A2, D3, G3, B3, E4');

    const restored = sheetFromSharing(await decodePayload(await encodePayload(payload)));
    expect(restored.title).toBe('Blackbird');

    // The voicings travel because they are part of the text — there is no
    // separate map that could be dropped on the way.
    const song = parseSong(restored.body);
    expect(song.occurrences.map((c) => c.key)).toEqual(['A', 'Cm', 'A', 'Cm[2]']);
    const chosen = voicingsFor(song, 'E2, A2, D3, G3, B3, E4');
    expect(chosen.get('Cm')).toEqual(['x', 3, 5, 5, 4, 3]);
    expect(chosen.get('Cm[2]')).toEqual([8, 10, 10, 8, 8, 8]);
  });

  it('refuses a payload that is not a song', () => {
    expect(() => sheetFromSharing({ nope: true })).toThrow(/song sheet/);
    expect(() => sheetFromSharing(null)).toThrow(/song sheet/);
  });
});
