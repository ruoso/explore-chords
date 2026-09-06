/**
 * Song sheets (docs/DESIGN.md §2.5).
 *
 * A sheet is a title and one block of song text. The chart, the tuning and the
 * chosen voicings all live in that text (see core/song.js), so there is no
 * hidden state the app remembers on the user's behalf: what you read is what
 * you have.
 *
 * Which instrument a song belongs to is therefore the *tuning written in it*,
 * not a stored id. Two instruments tuned alike can both play it, which is
 * true, and a song can never claim to belong to an instrument whose strings
 * its voicings do not fit.
 */

import { KEYS, readJson, writeJson } from './persist.js';

let counter = 0;
function newId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

export const EXAMPLE_BODY = '# Verse\nC  Am | F  G | C\n';

export function newSheet({ title = 'Untitled song', body } = {}) {
  return {
    id: newId('sheet'),
    title,
    body: body ?? '',
    updated: Date.now(),
  };
}

export function loadSheets() {
  const raw = readJson(KEYS.sheets, []);
  return Array.isArray(raw) ? raw : [];
}

export function saveSheets(sheets) {
  return writeJson(KEYS.sheets, sheets);
}

/**
 * Strip a sheet down to what a share link needs.
 * The instrument travels as a tuning, so a recipient who does not have that
 * instrument still sees the song as it was written (§2.1).
 */
export function sheetForSharing(sheet, instrument) {
  return {
    v: 1,
    title: sheet.title,
    // The tuning is inside the body already; the instrument block adds the
    // catalog entry and fret count so a recipient gets a usable instrument
    // rather than a bare list of strings.
    body: sheet.body,
    instrument: instrument
      ? {
          catalogId: instrument.catalogId,
          label: instrument.label,
          strings: instrument.strings
            .map(
              (p) =>
                `${p.note.letter}${'b'.repeat(Math.max(0, -p.note.accidental))}${'#'.repeat(
                  Math.max(0, p.note.accidental)
                )}${p.octave}`
            )
            .join(', '),
          fretCount: instrument.fretCount,
        }
      : null,
  };
}

/** Rebuild a sheet from a shared payload. */
export function sheetFromSharing(payload) {
  if (!payload || typeof payload.body !== 'string') {
    throw new Error('That link does not contain a song sheet.');
  }
  return newSheet({ title: payload.title ?? 'Shared song', body: payload.body });
}
