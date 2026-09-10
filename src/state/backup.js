/**
 * Saving everything to a file, and putting it back (docs/DESIGN.md §8.4).
 *
 * Everything the app knows lives in this browser's storage, which is a fine
 * place for it right up until the phone is replaced. So it all goes into one
 * zip: the instruments and preferences as JSON, the starred shapes as JSON, and
 * every song as a text file, because a song already *is* text and a backup you
 * can open and read is worth more than one only this app can make sense of.
 *
 * The manifest in settings.json says which file is which song, so a title that
 * had to be tidied to become a filename survives the trip. A zip assembled by
 * hand, with no manifest, still restores: the filename becomes the title.
 */

import { serialiseInstrument } from './persist.js';
import { fault } from '../core/errors.js';

export const BACKUP_VERSION = 1;
export const SETTINGS_FILE = 'settings.json';
export const CHORDS_FILE = 'saved-chords.json';
export const SONGS_DIRECTORY = 'songs/';
const APP = 'explore-chords';

/** A title as a filename: readable, and safe on every system. */
function fileNameFor(title, taken) {
  const base =
    String(title ?? '')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'song';
  let name = base;
  let n = 2;
  while (taken.has(name.toLowerCase())) {
    name = `${base} (${n})`;
    n += 1;
  }
  taken.add(name.toLowerCase());
  return `${SONGS_DIRECTORY}${name}.txt`;
}

/**
 * @param {{instruments: object[], activeId: string|null, prefs: object,
 *          favorites: object[], sheets: object[]}} state
 * @param {Date} [at]
 * @returns {{name: string, text: string}[]}
 */
export function backupFiles(state, at = new Date()) {
  const taken = new Set();
  const songs = [...(state.sheets ?? [])]
    .sort((a, b) => (a.updated ?? 0) - (b.updated ?? 0))
    .map((sheet) => ({
      sheet,
      file: fileNameFor(sheet.title, taken),
    }));

  const settings = {
    app: APP,
    version: BACKUP_VERSION,
    savedAt: at.toISOString(),
    activeInstrument: state.activeId ?? null,
    prefs: state.prefs ?? {},
    instruments: (state.instruments ?? []).map(serialiseInstrument),
    songs: songs.map(({ sheet, file }) => ({
      file,
      title: sheet.title,
      updated: sheet.updated ?? null,
    })),
  };

  const chords = {
    app: APP,
    version: BACKUP_VERSION,
    chords: (state.favorites ?? []).map((f) => ({
      instrumentId: f.instrumentId,
      chordText: f.chordText,
      frets: f.frets,
      added: f.added ?? null,
    })),
  };

  return [
    { name: SETTINGS_FILE, text: `${JSON.stringify(settings, null, 2)}\n` },
    { name: CHORDS_FILE, text: `${JSON.stringify(chords, null, 2)}\n` },
    ...songs.map(({ sheet, file }) => ({ name: file, text: sheet.body ?? '' })),
  ];
}

/** What a backup zip is called when it is offered for download. */
export function backupFileName(at = new Date()) {
  return `explore-chords-${at.toISOString().slice(0, 10)}.zip`;
}

function parseJson(files, name) {
  const file = files.find((f) => f.name === name);
  if (!file) return null;
  try {
    return JSON.parse(file.text);
  } catch {
    throw fault('backupUnreadable', { name }, `“${name}” is not readable.`);
  }
}

/**
 * Read a backup back into the shapes the app stores.
 *
 * Anything missing is simply absent rather than fatal: a zip holding only songs
 * restores the songs. What is refused is a zip with nothing of ours in it, since
 * that is a file somebody picked by mistake.
 *
 * @param {{name: string, text: string}[]} files
 * @returns {{instruments: object[], activeId: string|null, prefs: object|null,
 *            favorites: object[], sheets: object[]}}
 */
export function readBackup(files) {
  const settings = parseJson(files, SETTINGS_FILE);
  const chords = parseJson(files, CHORDS_FILE);
  const songFiles = files.filter(
    (f) => f.name.startsWith(SONGS_DIRECTORY) && f.name.toLowerCase().endsWith('.txt')
  );

  if (!settings && !chords && songFiles.length === 0) {
    throw fault('notABackup', {}, 'That file is not a backup of this app.');
  }

  const listed = new Map(
    (Array.isArray(settings?.songs) ? settings.songs : [])
      .filter((entry) => entry && typeof entry.file === 'string')
      .map((entry) => [entry.file, entry])
  );

  const sheets = songFiles.map((file, i) => {
    const entry = listed.get(file.name);
    const fallback = file.name.slice(SONGS_DIRECTORY.length).replace(/\.txt$/i, '');
    return {
      id: `sheet_${Date.now().toString(36)}${i}`,
      title: typeof entry?.title === 'string' && entry.title ? entry.title : fallback,
      body: file.text,
      updated: Number.isFinite(entry?.updated) ? entry.updated : Date.now() + i,
    };
  });
  sheets.sort((a, b) => a.updated - b.updated);

  const instruments = (Array.isArray(settings?.instruments) ? settings.instruments : []).filter(
    (entry) => entry && typeof entry.strings === 'string'
  );

  const favorites = (Array.isArray(chords?.chords) ? chords.chords : []).filter(
    (entry) => entry && typeof entry.chordText === 'string' && Array.isArray(entry.frets)
  );

  return {
    instruments,
    activeId: typeof settings?.activeInstrument === 'string' ? settings.activeInstrument : null,
    prefs: settings?.prefs && typeof settings.prefs === 'object' ? settings.prefs : null,
    favorites,
    sheets,
  };
}
