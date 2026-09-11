/**
 * localStorage persistence (docs/DESIGN.md §8.3).
 *
 * All keys are versioned so a migration can run when the shape changes.
 * Every read and write is guarded: a private window, cleared site data or a
 * browser configured to block storage must degrade to "no saved state", never
 * to a broken app.
 */

import { instrumentInstance, formatTuning, configFor } from '../core/instrument.js';
import { PRESETS, resolvePresetId } from '../core/heuristics.js';
import { DEFAULT_DIALECT } from '../core/notation/dialects.js';

export const VERSION = 'v2';
const KEY = (name) => `ec:${VERSION}:${name}`;

export const KEYS = {
  instruments: KEY('instruments'),
  active: KEY('active'),
  prefs: KEY('prefs'),
  favorites: KEY('favorites'),
  sheets: KEY('sheets'),
  activeSheet: KEY('activeSheet'),
};

function readRaw(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readJson(key, fallback) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeKey(key) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* nothing to do */
  }
}

/** Instruments are stored as plain data; tunings as text, so they stay legible. */
export function serialiseInstrument(instrument) {
  return {
    id: instrument.id,
    catalogId: instrument.catalogId,
    label: instrument.label,
    strings: formatTuning(instrument.strings),
    fretCount: instrument.fretCount,
    heuristics: instrument.heuristics,
  };
}

export function deserialiseInstrument(data) {
  const instrument = instrumentInstance({
    id: data.id,
    catalogId: data.catalogId,
    label: data.label,
    strings: data.strings,
    fretCount: data.fretCount,
    heuristics: data.heuristics,
  });
  instrument.heuristics = refreshPreset(instrument, data.heuristics);
  return instrument;
}

/**
 * Bring a stored configuration up to date with the preset it names.
 *
 * A named preset *is* its rules: saying an instrument is on Fingerstyle says
 * everything about its configuration, so there is nothing of the user's to lose
 * by rebuilding it, and rebuilding is the only way a correction to a preset
 * ever reaches someone who set their instrument up last year. A configuration
 * the user has edited says `custom`, and that is kept exactly as written.
 *
 * It also carries renamed presets across: an instrument saved as Standard comes
 * back as Strumming.
 */
function refreshPreset(instrument, stored) {
  if (!stored?.preset) return instrument.heuristics;
  const id = resolvePresetId(stored.preset);
  if (!PRESETS[id]) return { ...stored, preset: stored.preset === id ? stored.preset : id };
  return configFor(instrument, id);
}

export function loadInstruments() {
  const raw = readJson(KEYS.instruments, null);
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    try {
      out.push(deserialiseInstrument(item));
    } catch {
      // A tuning that no longer parses should not take the whole list with it.
    }
  }
  return out;
}

export function saveInstruments(instruments) {
  return writeJson(KEYS.instruments, instruments.map(serialiseInstrument));
}

export function loadActiveId() {
  return readRaw(KEYS.active);
}

export function saveActiveId(id) {
  return writeRaw(KEYS.active, id);
}

export const DEFAULT_PREFS = {
  dialect: DEFAULT_DIALECT,
  orientation: 'vertical',
  handed: 'right',
  // Off: the chart names the harmony, which is what it is for. Turning this on
  // makes it name what the chosen shapes actually sound instead (§6.2).
  chartVoicedAs: false,
};

export function loadPrefs() {
  return { ...DEFAULT_PREFS, ...(readJson(KEYS.prefs, {}) ?? {}) };
}

export function savePrefs(prefs) {
  return writeJson(KEYS.prefs, prefs);
}

/** Wipe everything this app owns. Used by tests and by a future reset action. */
export function clearAll() {
  for (const key of Object.values(KEYS)) removeKey(key);
}

/**
 * Favourites store the chord and the fret pattern, not a rendered snapshot.
 * Finger assignment and scoring are recomputed on load, so a saved shape never
 * drifts out of date when those rules change.
 */
export function loadFavorites() {
  const raw = readJson(KEYS.favorites, []);
  return Array.isArray(raw) ? raw : [];
}

export function saveFavorites(favorites) {
  return writeJson(KEYS.favorites, favorites);
}

export function loadActiveSheetId() {
  return readRaw(KEYS.activeSheet);
}

export function saveActiveSheetId(id) {
  return id ? writeRaw(KEYS.activeSheet, id) : removeKey(KEYS.activeSheet);
}

/** A stable identity for one starred shape. */
export function favoriteKey({ instrumentId, chordText, frets }) {
  return `${instrumentId}|${chordText}|${frets.join(',')}`;
}
