/**
 * Application state (docs/DESIGN.md §3.3).
 *
 * One state object, one way to change it, and subscribers re-render their own
 * subtree. No virtual DOM: the subtrees are small and diagrams are cached by
 * content key.
 *
 * The important idea here is `effectiveInstrument`. A shared link or a song
 * sheet can carry its own instrument, and rather than retuning the content or
 * hijacking the user's default, the app enters a transient "viewing as" state.
 * Every consumer reads the effective instrument, so the override stays a
 * one-line concern instead of a flag threaded through the UI.
 */

import {
  loadInstruments,
  saveInstruments,
  loadActiveId,
  saveActiveId,
  loadPrefs,
  savePrefs,
  loadFavorites,
  saveFavorites,
  favoriteKey,
  loadActiveSheetId,
  saveActiveSheetId,
} from './persist.js';
import { loadSheets, saveSheets, newSheet } from './sheets.js';
import { migrateSong, chartKey, canMergeSongs, mergeSongs, parseSong } from '../core/song.js';
import { applySavedVoicings } from '../core/voicings.js';
import { formatTuning } from '../core/instrument.js';
import { DEFAULT_VIEW, isView } from './views.js';

/**
 * @typedef {object} AppState
 * @property {object[]} instruments      the user's set-up instruments
 * @property {string|null} activeId      persisted
 * @property {{instance:object, source:string}|null} viewAs  transient override
 * @property {object|null} chord
 * @property {string} chordText
 * @property {object[]} ambiguities
 * @property {{message:string}[]} errors
 * @property {object} prefs
 * @property {object|null} results
 * @property {boolean} searching
 */

export function createStore(initial = {}) {
  const instruments = initial.instruments ?? loadInstruments();
  const storedActive = initial.activeId ?? loadActiveId();
  const activeId =
    instruments.find((i) => i.id === storedActive)?.id ?? instruments[0]?.id ?? null;

  /** @type {AppState} */
  let state = {
    instruments,
    activeId,
    viewAs: null,
    chord: null,
    chordText: '',
    ambiguities: [],
    errors: [],
    prefs: initial.prefs ?? loadPrefs(),
    favorites: initial.favorites ?? loadFavorites(),
    sheets: initial.sheets ?? loadSheets(),
    activeSheetId: null,
    // A song opens to be read; editing it is the other of the two. Not
    // persisted: coming back to the app lands on the sheet, ready to read.
    sheetMode: 'view',
    view: initial.view ?? DEFAULT_VIEW,
    results: null,
    searching: false,
    ...initial.state,
  };

  // Restore the sheet that was open, so a reload does not drop the user out of
  // the song they were working on.
  const storedSheet = initial.activeSheetId ?? loadActiveSheetId();
  const restored = state.sheets.find((s) => s.id === storedSheet);
  if (restored) state.activeSheetId = restored.id;

  // Songs written in the earlier form — a `# Tuning` line, or an unlabelled
  // `# Voicings` block — are converted as they are loaded. An unlabelled block
  // is taken to be for the instrument in use, since that is where it was made.
  const active = state.instruments.find((i) => i.id === state.activeId) ?? null;
  if (active) {
    const tuning = formatTuning(active.strings);
    let changed = false;
    state.sheets = state.sheets.map((sheet) => {
      const body = migrateSong(sheet.body, tuning, state.prefs.dialect);
      if (body === sheet.body) return sheet;
      changed = true;
      return { ...sheet, body };
    });
    if (changed) saveSheets(state.sheets);
  }

  // The earlier "bring to this instrument" made a separate copy of a song per
  // instrument. Now that one song holds every instrument's voicings, copies
  // that are the same song — same title, identical chart, no tuning voiced
  // twice — fold into one. Anything that has diverged is left alone.
  {
    const groups = new Map();
    for (const sheet of state.sheets) {
      const key = `${sheet.title}\u0000${chartKey(sheet.body, state.prefs.dialect)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(sheet);
    }
    const dropped = new Set();
    let merged = false;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const ordered = [...group].sort((a, b) => (a.updated ?? 0) - (b.updated ?? 0));
      const bodies = ordered.map((s) => s.body);
      if (!canMergeSongs(bodies, state.prefs.dialect)) continue;
      ordered[0].body = mergeSongs(bodies, state.prefs.dialect);
      ordered[0].updated = Date.now();
      for (const extra of ordered.slice(1)) dropped.add(extra.id);
      merged = true;
    }
    if (merged) {
      state.sheets = state.sheets.filter((s) => !dropped.has(s.id));
      if (dropped.has(state.activeSheetId)) state.activeSheetId = null;
      saveSheets(state.sheets);
    }
  }

  const subscribers = new Set();

  function notify() {
    for (const fn of [...subscribers]) fn(state);
  }

  const store = {
    get state() {
      return state;
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    /** Apply a partial update and notify. */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      notify();
      return state;
    },

    /**
     * The instrument everything on screen is about: the transient override if
     * one is active, otherwise the user's own active instrument.
     */
    get effectiveInstrument() {
      return state.viewAs?.instance ?? state.instruments.find((i) => i.id === state.activeId) ?? null;
    },

    get activeInstrument() {
      return state.instruments.find((i) => i.id === state.activeId) ?? null;
    },

    /** True before the user has set up any instrument at all. */
    get needsSetup() {
      return state.instruments.length === 0;
    },

    addInstrument(instrument, { activate = true } = {}) {
      const instruments = [...state.instruments, instrument];
      const activeId = activate ? instrument.id : state.activeId ?? instrument.id;
      saveInstruments(instruments);
      saveActiveId(activeId);
      return store.set({ instruments, activeId, viewAs: null });
    },

    removeInstrument(id) {
      const instruments = state.instruments.filter((i) => i.id !== id);
      const activeId = state.activeId === id ? (instruments[0]?.id ?? null) : state.activeId;
      // Saved shapes are tagged by instrument, so they go too rather than
      // lingering as rows nothing can ever show.
      const favorites = state.favorites.filter((f) => f.instrumentId !== id);

      saveInstruments(instruments);
      saveFavorites(favorites);
      if (activeId) saveActiveId(activeId);
      return store.set({ instruments, activeId, favorites });
    },

    updateInstrument(id, patch) {
      const instruments = state.instruments.map((i) =>
        i.id === id ? { ...i, ...patch } : i
      );
      saveInstruments(instruments);
      return store.set({ instruments });
    },

    setActive(id) {
      if (!state.instruments.some((i) => i.id === id)) return state;
      saveActiveId(id);
      // Choosing an instrument deliberately clears any borrowed one.
      return store.set({ activeId: id, viewAs: null });
    },

    /**
     * Borrow an instrument for this view only. Never persisted: a reload
     * returns the user to their own instrument.
     */
    setViewAs(instance, source = 'link') {
      return store.set({ viewAs: instance ? { instance, source } : null });
    },

    clearViewAs() {
      return store.set({ viewAs: null });
    },

    /** Adopt the borrowed instrument as the user's own. */
    keepViewAsDefault() {
      if (!state.viewAs) return state;
      const borrowed = state.viewAs.instance;
      const existing = state.instruments.find((i) => sameTuning(i, borrowed));
      if (existing) {
        saveActiveId(existing.id);
        return store.set({ activeId: existing.id, viewAs: null });
      }
      return store.addInstrument(borrowed);
    },

    /** Star or unstar a shape. Returns true when it is now starred. */
    toggleFavorite({ instrumentId, chordText, frets }) {
      const entry = { instrumentId, chordText, frets };
      const key = favoriteKey(entry);
      const existing = state.favorites.findIndex((f) => favoriteKey(f) === key);
      const favorites =
        existing >= 0
          ? state.favorites.filter((_, i) => i !== existing)
          : [...state.favorites, { ...entry, added: Date.now() }];
      saveFavorites(favorites);
      store.set({ favorites });
      return existing < 0;
    },

    isFavorite({ instrumentId, chordText, frets }) {
      const key = favoriteKey({ instrumentId, chordText, frets });
      return state.favorites.some((f) => favoriteKey(f) === key);
    },

    /** Starred shapes for one instrument, newest first. */
    favoritesFor(instrumentId) {
      return state.favorites
        .filter((f) => f.instrumentId === instrumentId)
        .sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
    },

    // --- song sheets ------------------------------------------------------

    get activeSheet() {
      return state.sheets.find((s) => s.id === state.activeSheetId) ?? null;
    },

    /**
     * Every song. The chart is the same on every instrument; only the voicings
     * differ, and those live per tuning inside the text — so there is no such
     * thing as a song that belongs to one instrument.
     */
    sheetsFor() {
      return state.sheets;
    },

    /**
     * Bring a body up to the current form, and give chords that are new to the
     * song the shapes saved for them.
     *
     * Applied to what the user types, so a song pasted in the earlier form
     * converts as soon as it is saved. `previousBody` is what the song said
     * before this edit: only chords that were not in the chart then get a saved
     * shape, so clearing one you did not want does not just bring it back.
     */
    normaliseBody(body, previousBody = '') {
      const instrument = store.effectiveInstrument;
      if (!instrument) return body;
      const dialect = state.prefs.dialect;
      const migrated = migrateSong(body, formatTuning(instrument.strings), dialect);
      const before = new Set(parseSong(previousBody, dialect).symbols);
      const symbols = parseSong(migrated, dialect).symbols.filter((s) => !before.has(s));
      return applySavedVoicings(migrated, {
        symbols,
        favorites: store.favoritesFor(instrument.id),
        instrument,
        dialect,
      });
    },

    createSheet(title, body = '') {
      // Everything in a new song is new to it, so saved shapes apply throughout.
      const sheet = newSheet({ title, body: store.normaliseBody(body, '') });
      const sheets = [...state.sheets, sheet];
      saveSheets(sheets);
      saveActiveSheetId(sheet.id);
      store.set({ sheets, activeSheetId: sheet.id });
      return sheet;
    },

    addSheet(sheet, { activate = true } = {}) {
      const sheets = [...state.sheets, sheet];
      saveSheets(sheets);
      if (activate) saveActiveSheetId(sheet.id);
      store.set({ sheets, activeSheetId: activate ? sheet.id : state.activeSheetId });
      return sheet;
    },

    updateSheet(id, updater) {
      const sheets = state.sheets.map((s) =>
        s.id === id ? { ...(typeof updater === 'function' ? updater(s) : updater), updated: Date.now() } : s
      );
      saveSheets(sheets);
      return store.set({ sheets });
    },

    deleteSheet(id) {
      const sheets = state.sheets.filter((s) => s.id !== id);
      saveSheets(sheets);
      if (state.activeSheetId === id) saveActiveSheetId(null);
      return store.set({
        sheets,
        activeSheetId: state.activeSheetId === id ? null : state.activeSheetId,
      });
    },

    setActiveSheet(id, mode = 'view') {
      const sheet = state.sheets.find((s) => s.id === id) ?? null;
      saveActiveSheetId(sheet?.id ?? null);
      return store.set({ activeSheetId: sheet?.id ?? null, sheetMode: mode });
    },

    duplicateSheet(id) {
      const original = state.sheets.find((s) => s.id === id);
      if (!original) return null;
      const copy = newSheet({ title: `${original.title} (copy)`, body: original.body });
      // Deliberately not activated: duplicating from the list should leave you
      // looking at the list.
      return store.addSheet(copy, { activate: false });
    },

    setView(id) {
      return store.set({ view: isView(id) ? id : DEFAULT_VIEW });
    },

    setPrefs(patch) {
      const prefs = { ...state.prefs, ...patch };
      savePrefs(prefs);
      return store.set({ prefs });
    },
  };

  return store;
}

/** Two instruments are the same thing to play when their tunings agree. */
export function sameTuning(a, b) {
  if (!a || !b) return false;
  if (a.strings.length !== b.strings.length) return false;
  return a.strings.every(
    (p, i) =>
      p.note.letter === b.strings[i].note.letter &&
      p.note.accidental === b.strings[i].note.accidental &&
      p.octave === b.strings[i].octave
  );
}
