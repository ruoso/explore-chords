/**
 * Song sheets (docs/DESIGN.md §2.5).
 *
 * An ordered list of sections, each holding a progression of chord slots. Each
 * slot references a chord *and one specific pinned fingering* — a sheet belongs
 * to an instrument instance, because the pinned fingerings are meaningless
 * without it.
 *
 * Slots store fret patterns rather than rendered fingerings, so a sheet cannot
 * drift out of date when finger assignment or scoring changes.
 */

import { KEYS, readJson, writeJson } from './persist.js';

let counter = 0;
function newId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

export function newSheet({ title = 'Untitled song', instrumentId, sections } = {}) {
  return {
    id: newId('sheet'),
    title,
    instrumentId,
    sections: sections ?? [newSection({ name: 'Verse' })],
    updated: Date.now(),
  };
}

export function newSection({ name = 'Section', slots = [] } = {}) {
  return { id: newId('sec'), name, slots };
}

export function newSlot({ chordText, frets }) {
  return { id: newId('slot'), chordText, frets };
}

export function loadSheets() {
  const raw = readJson(KEYS.sheets, []);
  return Array.isArray(raw) ? raw : [];
}

export function saveSheets(sheets) {
  return writeJson(KEYS.sheets, sheets);
}

/**
 * Each distinct chord-and-fingering in a sheet, once.
 * This is the diagram legend at the top of a printed sheet: a chord played two
 * ways appears twice, the same shape used in four places appears once.
 */
export function sheetLegend(sheet) {
  const seen = new Map();
  for (const section of sheet.sections) {
    for (const slot of section.slots) {
      const key = `${slot.chordText}|${slot.frets.join(',')}`;
      if (!seen.has(key)) seen.set(key, { chordText: slot.chordText, frets: slot.frets });
    }
  }
  return [...seen.values()];
}

/** Move a section up or down. */
export function moveSection(sheet, sectionId, delta) {
  const index = sheet.sections.findIndex((s) => s.id === sectionId);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= sheet.sections.length) return sheet;
  const sections = [...sheet.sections];
  [sections[index], sections[target]] = [sections[target], sections[index]];
  return { ...sheet, sections, updated: Date.now() };
}

/**
 * Strip a sheet down to what a share link needs.
 * The instrument travels as a tuning, so a recipient who does not have that
 * instrument still sees the sheet as it was written (§2.1).
 */
export function sheetForSharing(sheet, instrument) {
  return {
    v: 1,
    title: sheet.title,
    instrument: instrument
      ? {
          catalogId: instrument.catalogId,
          label: instrument.label,
          strings: instrument.strings
            .map((p) => `${p.note.letter}${'b'.repeat(Math.max(0, -p.note.accidental))}${'#'.repeat(Math.max(0, p.note.accidental))}${p.octave}`)
            .join(', '),
          fretCount: instrument.fretCount,
        }
      : null,
    sections: sheet.sections.map((s) => ({
      name: s.name,
      slots: s.slots.map((slot) => ({ c: slot.chordText, f: slot.frets })),
    })),
  };
}

/** Rebuild a sheet from a shared payload. */
export function sheetFromSharing(payload, instrumentId) {
  if (!payload || !Array.isArray(payload.sections)) {
    throw new Error('That link does not contain a song sheet.');
  }
  return newSheet({
    title: payload.title ?? 'Shared song',
    instrumentId,
    sections: payload.sections.map((s) =>
      newSection({
        name: s.name ?? 'Section',
        slots: (s.slots ?? []).map((slot) => newSlot({ chordText: slot.c, frets: slot.f })),
      })
    ),
  });
}
