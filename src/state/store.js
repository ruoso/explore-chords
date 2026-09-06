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
} from './persist.js';

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
    results: null,
    searching: false,
    ...initial.state,
  };

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
      saveInstruments(instruments);
      if (activeId) saveActiveId(activeId);
      return store.set({ instruments, activeId });
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
