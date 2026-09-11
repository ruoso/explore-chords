/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createZip, readZip, crc32 } from './zip.js';
import {
  backupFiles,
  readBackup,
  backupFileName,
  backupDue,
  SETTINGS_FILE,
  CHORDS_FILE,
} from './backup.js';
import { fromCatalog } from '../core/instrument.js';

const state = () => {
  const guitar = fromCatalog('6guitar');
  return {
    instruments: [guitar],
    activeId: guitar.id,
    prefs: { dialect: 'brazilian', orientation: 'vertical', handed: 'right' },
    favorites: [{ instrumentId: guitar.id, chordText: 'Cmaj7', frets: ['x', 3, 2, 0, 0, 0], added: 7 }],
    sheets: [
      { id: 's1', title: 'Valsa', body: 'Gm | D7\n', updated: 2 },
      { id: 's2', title: 'Coração / partido?', body: 'C | G\n', updated: 1 },
    ],
  };
};

describe('a zip written here', () => {
  it('reads back exactly what went in', async () => {
    const files = [
      { name: 'settings.json', text: '{"a":1}\n' },
      { name: 'songs/Coração.txt', text: 'Gm             Gm/F\nComo fosse um par que\n' },
      { name: 'songs/empty.txt', text: '' },
    ];
    const blob = await createZip(files);
    expect(blob.type).toBe('application/zip');
    expect(await readZip(await blob.arrayBuffer())).toEqual(files);
  });

  it('refuses something that is not a zip', async () => {
    const bytes = new TextEncoder().encode('this is a jpeg, honestly'.repeat(4));
    await expect(readZip(bytes.buffer)).rejects.toThrow();
  });

  it('notices an entry that did not arrive whole', async () => {
    const blob = await createZip([{ name: 'a.txt', text: 'hello there' }]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Corrupt the stored body, leaving every header alone.
    const at = bytes.length - 22 - 46 - 5 - 11;
    bytes[at] = bytes[at] ^ 0xff;
    await expect(readZip(bytes.buffer)).rejects.toThrow();
  });

  it('computes the CRC every reader checks', () => {
    // The canonical check value for "123456789".
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('a backup', () => {
  it('is settings, saved chords, and one text file per song', () => {
    const files = backupFiles(state(), new Date('2026-09-10T10:00:00Z'));
    expect(files.map((f) => f.name)).toEqual([
      SETTINGS_FILE,
      CHORDS_FILE,
      'songs/Coração - partido-.txt',
      'songs/Valsa.txt',
    ]);
    // A song is stored as the text it already is, unchanged.
    expect(files.find((f) => f.name === 'songs/Valsa.txt').text).toBe('Gm | D7\n');
  });

  it('names the file for the day it was made', () => {
    expect(backupFileName(new Date('2026-09-10T10:00:00Z'))).toBe('explore-chords-2026-09-10.zip');
  });

  it('keeps a title that had to be tidied to become a filename', () => {
    const back = readBackup(backupFiles(state()));
    expect(back.sheets.map((s) => s.title)).toEqual(['Coração / partido?', 'Valsa']);
    expect(back.sheets.map((s) => s.body)).toEqual(['C | G\n', 'Gm | D7\n']);
  });

  it('round-trips everything through a real zip', async () => {
    const before = state();
    const blob = await createZip(backupFiles(before));
    const back = readBackup(await readZip(await blob.arrayBuffer()));

    expect(back.activeId).toBe(before.activeId);
    expect(back.prefs).toEqual(before.prefs);
    expect(back.favorites).toEqual(before.favorites);
    expect(back.instruments.map((i) => i.label)).toEqual([before.instruments[0].label]);
    expect(back.instruments[0].strings).toBe('E2, A2, D3, G3, B3, E4');
    expect(back.instruments[0].heuristics.preset).toBe('strumming');
    expect(back.sheets.map((s) => s.title).sort()).toEqual(['Coração / partido?', 'Valsa']);
  });

  it('restores a zip somebody assembled by hand', () => {
    // No manifest: the filename is the title, which is the whole point of
    // keeping songs as text files.
    const back = readBackup([{ name: 'songs/Blackbird.txt', text: 'G | Am7 | C\n' }]);
    expect(back.sheets).toHaveLength(1);
    expect(back.sheets[0].title).toBe('Blackbird');
    expect(back.sheets[0].body).toBe('G | Am7 | C\n');
    expect(back.instruments).toEqual([]);
  });

  it('picks up a song somebody added to the zip', () => {
    // The point of keeping songs as files: drop one in with any zip tool and it
    // is a song. The manifest does not list it, so its filename is its title.
    const back = readBackup([
      ...backupFiles(state()),
      { name: 'songs/Águas de Março.txt', text: 'Em | B7\n' },
    ]);
    expect([...back.sheets].map((sheet) => sheet.title).sort()).toEqual([
      'Coração / partido?',
      'Valsa',
      'Águas de Março',
    ]);
    expect(back.sheets.find((sheet) => sheet.title === 'Águas de Março').body).toBe('Em | B7\n');
    // And the ones the manifest does list keep the titles it holds.
    expect(back.sheets.find((sheet) => sheet.body === 'C | G\n').title).toBe('Coração / partido?');
  });

  it('ignores the directory entries a zip tool leaves behind', () => {
    // Extracting a backup and re-zipping the folder adds an entry for the
    // folder itself, which is not a song however much it looks like one.
    const back = readBackup([
      { name: 'songs/', text: '' },
      { name: 'songs/Blackbird.txt', text: 'G | Am7\n' },
    ]);
    expect(back.sheets.map((sheet) => sheet.title)).toEqual(['Blackbird']);
  });

  it('takes a backup with only some of its parts', () => {
    const files = backupFiles(state()).filter((f) => f.name !== CHORDS_FILE);
    const back = readBackup(files);
    expect(back.favorites).toEqual([]);
    expect(back.instruments).toHaveLength(1);
  });

  it('refuses a zip with nothing of ours in it', () => {
    expect(() => readBackup([{ name: 'holiday.jpg', text: 'not really' }])).toThrow();
  });

  it('refuses settings that are not readable', () => {
    expect(() => readBackup([{ name: SETTINGS_FILE, text: '{ not json' }])).toThrow();
  });
});

describe('mentioning a backup that has not been made', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 8, 20);
  const song = (updated) => ({ id: 's', title: 'A', body: 'C\n', updated });

  it('says nothing when there are no songs to lose', () => {
    expect(backupDue({ sheets: [], prefs: {} }, now)).toBeNull();
  });

  it('says nothing about work of a day or two', () => {
    expect(backupDue({ sheets: [song(now - 2 * day)], prefs: {} }, now)).toBeNull();
  });

  it('speaks up once work has sat in no backup for a week', () => {
    const due = backupDue({ sheets: [song(now - 8 * day)], prefs: {} }, now);
    expect(due).toEqual({ songs: 1, days: 8 });
  });

  it('says nothing when the last backup already holds everything', () => {
    const state = { sheets: [song(now - 8 * day)], prefs: { lastBackupAt: now - day } };
    expect(backupDue(state, now)).toBeNull();
  });

  it('speaks up again about work done since the last backup', () => {
    const state = {
      sheets: [song(now - 30 * day), song(now - 9 * day)],
      prefs: { lastBackupAt: now - 20 * day },
    };
    // Only the song the backup does not hold is counted, and the clock runs
    // from it rather than from the older one.
    expect(backupDue(state, now)).toEqual({ songs: 1, days: 9 });
  });

  it('restarts the clock when it is dismissed, rather than going away', () => {
    const state = {
      sheets: [song(now - 40 * day)],
      prefs: { backupNudgedAt: now - 2 * day },
    };
    expect(backupDue(state, now)).toBeNull();
    expect(backupDue(state, now + 6 * day)).toEqual({ songs: 1, days: 8 });
  });
});
