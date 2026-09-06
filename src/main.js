/**
 * Application entry point (docs/DESIGN.md §3.4).
 *
 * State changes are the only way the UI updates: the store notifies, each
 * module re-renders its own subtree.
 */

import { parseChord } from './core/notation/parse.js';
import { searchFingerings } from './core/search.js';
import { createStore, sameTuning } from './state/store.js';
import { readUrl, syncUrl } from './state/url.js';
import { el, clear, announce } from './ui/dom.js';
import { renderInstrumentForm } from './ui/instrument-form.js';
import { renderInstrumentChip } from './ui/instrument-chip.js';
import { renderViewAsBar } from './ui/view-as-bar.js';
import { renderResults } from './ui/results.js';
import { renderChordInput } from './ui/chord-input.js';
import { renderDisplayToggles } from './ui/display-toggles.js';
import { renderLibrary } from './ui/library.js';
import { renderNav } from './ui/nav.js';
import {
  renderInstrumentList,
  renderInstrumentEditor,
} from './ui/instrument-settings.js';
import { confirmDialog } from './ui/confirm-dialog.js';
import { renderSheetList, renderSheetEditor } from './ui/sheets-view.js';
import { renderSheetPrint } from './ui/sheet-print.js';
import { sheetForSharing, sheetFromSharing } from './state/sheets.js';
import { parseSong, songFitsTuning } from './core/song.js';
import { encodeSheetLink, decodeSheetLink } from './state/codec.js';
import { instrumentInstance, formatTuning } from './core/instrument.js';
import { setupUpdates } from './ui/update-toast.js';

const store = createStore();
const fromUrl = readUrl();

const root = document.querySelector('#app');

const nodes = {
  header: el('header', { class: 'ec-header' }),
  chip: el('div', { class: 'ec-header-chip' }),
  nav: el('div', { class: 'ec-nav-slot' }),
  viewAs: el('div', { class: 'ec-viewas-slot', hidden: true }),
  main: el('main', { class: 'ec-main', id: 'main' }),
  live: el('div', {
    class: 'ec-visually-hidden',
    role: 'status',
    'aria-live': 'polite',
  }),
  toast: el('div', { class: 'ec-toast-slot', hidden: true }),
};

function mount() {
  clear(root);
  nodes.header.append(
    el('h1', { class: 'ec-title' }, 'Explore Chords'),
    nodes.chip
  );
  root.append(nodes.header, nodes.nav, nodes.viewAs, nodes.main, nodes.live, nodes.toast);
}

/** Apply anything the URL carried, once, at startup. */
function applyUrlState() {
  const patch = {};
  if (fromUrl.view) patch.view = fromUrl.view;
  if (fromUrl.sheetId) patch.activeSheetId = fromUrl.sheetId;
  if (fromUrl.chordText) patch.chordText = fromUrl.chordText;
  if (fromUrl.dialect) patch.prefs = { ...store.state.prefs, dialect: fromUrl.dialect };
  if (fromUrl.orientation) {
    patch.prefs = { ...(patch.prefs ?? store.state.prefs), orientation: fromUrl.orientation };
  }
  if (Object.keys(patch).length) store.set(patch);

  // A link carrying a different instrument borrows it for this view only.
  if (fromUrl.instrument) {
    const mine = store.activeInstrument;
    if (!mine) {
      store.addInstrument(fromUrl.instrument);
    } else if (!sameTuning(mine, fromUrl.instrument)) {
      store.setViewAs(fromUrl.instrument, 'link');
    }
  }
}

function runSearch() {
  const { chordText, prefs, readings } = store.state;
  const instrument = store.effectiveInstrument;
  if (!instrument || !chordText) {
    store.set({ chord: null, results: null, ambiguities: [], errors: [] });
    return;
  }

  const parsed = parseChord(chordText, prefs.dialect, { readings });
  if (!parsed.chord) {
    // Parse errors are non-blocking: the last valid chord and its results stay
    // on screen while the user keeps typing (§2.2).
    store.set({ ambiguities: parsed.ambiguities, errors: parsed.errors });
    return;
  }

  const results = searchFingerings(parsed.chord, instrument);
  store.set({
    chord: parsed.chord,
    ambiguities: parsed.ambiguities,
    errors: [],
    results,
    expandedGroups: {},
  });
  announce(
    nodes.live,
    results.count === 0
      ? 'No fingerings found.'
      : `${results.count} fingerings in ${results.groups.length} positions.`
  );
}

// --- the chord explorer ----------------------------------------------------

let chordInput = null;
let resultsBox = null;

function renderResultsOnly() {
  if (!resultsBox) return;
  renderResults(resultsBox, {
    store,
    results: store.state.results,
    chord: store.state.chord,
    instrument: store.effectiveInstrument,
    onShowMore: (position) => {
      const expanded = { ...(store.state.expandedGroups ?? {}) };
      expanded[position] = !expanded[position];
      store.set({ expandedGroups: expanded });
      renderResultsOnly();
    },
    onToggleFavorite: (fingering) => {
      store.toggleFavorite({
        instrumentId: store.effectiveInstrument.id,
        chordText: store.state.chordText,
        frets: fingering.frets,
      });
      renderResultsOnly();
    },
    onOpenRules: () => navigate('instrument'),
  });
}

/**
 * Apply new chord text.
 *
 * The input area is updated in place rather than rebuilt, so whichever control
 * the user is holding keeps focus. `source` says which half of the two-way sync
 * initiated the change, so it is not written back over the user's own edit.
 */
function applyChordText(text, { source } = {}) {
  if (text === store.state.chordText) return;
  store.set({ chordText: text });
  runSearch();
  syncUrl(store.state, { instrument: store.effectiveInstrument });

  if (source === 'picker') chordInput?.setText(text);
  else chordInput?.syncFromChord(store.state.chord);

  chordInput?.renderStatus();
  renderResultsOnly();
}

function renderExplorer() {
  const inputBox = el('div', { class: 'ec-input-area' });
  const toggleBox = el('div', { class: 'ec-toggle-area' });
  resultsBox = el('div', { class: 'ec-results' });
  nodes.main.append(inputBox, toggleBox, resultsBox);

  chordInput = renderChordInput(inputBox, {
    store,
    onChange: (text, source) => applyChordText(text, { source }),
    onReading: (kind, reading) => {
      store.set({ readings: { ...(store.state.readings ?? {}), [kind]: reading } });
      runSearch();
      chordInput?.renderStatus();
      renderResultsOnly();
    },
  });

  const drawToggles = () =>
    renderDisplayToggles(toggleBox, {
      store,
      onChange: (patch) => {
        store.setPrefs(patch);
        syncUrl(store.state, { instrument: store.effectiveInstrument });
        drawToggles();
        renderResultsOnly();
      },
    });
  drawToggles();
  renderResultsOnly();
}

// --- song sheets -----------------------------------------------------------

/** Put a share link for the open sheet on screen, ready to copy. */
async function shareSheet() {
  const sheet = store.activeSheet;
  const instrument = store.effectiveInstrument;
  if (!sheet || !instrument) return;

  const fragment = await encodeSheetLink(sheetForSharing(sheet, instrument));
  const url = `${globalThis.location.origin}${globalThis.location.pathname}${fragment}`;
  const box = document.querySelector('#sheet-share-out');
  if (!box) return;
  clear(box);
  const field = el('input', {
    type: 'text',
    readonly: true,
    value: url,
    'aria-label': 'Share link for this song',
    class: 'ec-share-link',
  });
  box.append(
    el('p', { class: 'ec-help' }, 'Anyone opening this link sees the song as written.'),
    field
  );
  field.select();
}

/** Render the sheet into the print container and ask the browser to print. */
function printSheet() {
  const sheet = store.activeSheet;
  const instrument = store.effectiveInstrument;
  if (!sheet || !instrument) return;
  renderSheetPrint(document.querySelector('#print-root'), { store, sheet, instrument });
  document.body.classList.add('ec-printing');
  const done = () => {
    document.body.classList.remove('ec-printing');
    globalThis.removeEventListener('afterprint', done);
  };
  globalThis.addEventListener('afterprint', done);
  try {
    globalThis.print();
  } catch {
    done();
  }
}

function renderSheets() {
  const instrument = store.effectiveInstrument;
  const sheet = store.activeSheet;

  // A song open from another instrument cannot be rendered here: its voicings
  // are fret patterns for a different number of strings. Fall back to the list
  // rather than showing something meaningless.
  const fits = sheet ? songFitsTuning(parseSong(sheet.body), formatTuning(instrument.strings)) : false;
  if (sheet && !fits) store.setActiveSheet(null);

  if (!sheet || !fits) {
    renderSheetList(nodes.main, {
      store,
      onOpen: (id) => {
        store.setActiveSheet(id);
        navigate('sheets');
      },
      onChange: () => {
        clear(nodes.main);
        renderSheets();
      },
      onBring: (source) => {
        const copy = store.bringSheetHere(source.id);
        if (copy) navigate('sheets');
      },
    });
    return;
  }

  renderSheetEditor(nodes.main, {
    store,
    sheet,
    onBack: () => {
      store.setActiveSheet(null);
      navigate('sheets');
    },
    onChange: ({ keepFocus } = {}) => {
      // Editing the song rewrites the text, so the whole editor redraws. Focus
      // is restored explicitly, since losing it mid-typing would be worse than
      // the redraw itself.
      const activeId = keepFocus ? document.activeElement?.id : null;
      const caret =
        activeId && document.activeElement && 'selectionStart' in document.activeElement
          ? document.activeElement.selectionStart
          : null;
      clear(nodes.main);
      renderSheets();
      if (activeId) {
        const restored = document.getElementById(activeId);
        restored?.focus();
        if (caret !== null && restored && 'setSelectionRange' in restored) {
          restored.setSelectionRange(caret, caret);
        }
      }
    },
    onShare: shareSheet,
    onPrint: printSheet,
  });
}

// --- instruments -----------------------------------------------------------

function renderInstruments() {
  const editing = store.state.instrumentForm?.mode === 'edit'
    ? store.state.instruments.find((i) => i.id === store.state.instrumentForm.id)
    : null;

  if (!editing) {
    renderInstrumentList(nodes.main, {
      store,
      onAdd: () => {
        store.set({ instrumentForm: { mode: 'create' } });
        render();
      },
      onEdit: (instrument) => {
        store.set({ instrumentForm: { mode: 'edit', id: instrument.id } });
        render();
      },
      onUse: (instrument) => {
        store.setActive(instrument.id);
        store.setActiveSheet(null);
        runSearch();
        render();
      },
      onDelete: confirmDeleteInstrument,
    });
    return;
  }

  renderInstrumentEditor(nodes.main, {
    instrument: editing,
    onSave: (values) => {
      store.updateInstrument(editing.id, values);
      store.set({ instrumentForm: null });
      runSearch();
      render();
    },
    onCancel: () => {
      store.set({ instrumentForm: null });
      render();
    },
    onRules: (heuristics) => {
      store.updateInstrument(editing.id, { heuristics });
      runSearch();
      render();
    },
    onDelete: store.state.instruments.length > 1 ? confirmDeleteInstrument : null,
  });
}

// --- setup and routing -----------------------------------------------------

function navigate(view, extra = {}) {
  // Moving between screens abandons a half-finished instrument form, so you
  // never come back to an editor for something you are no longer looking at.
  store.set({ view, instrumentForm: null, ...extra });
  syncUrl(store.state, { instrument: store.effectiveInstrument });
  render();
}

/** Creating an instrument, first run or later, uses the same form as editing. */
function showCreate({ firstRun }) {
  clear(nodes.main);
  nodes.chip.hidden = firstRun;
  nodes.nav.hidden = firstRun;
  renderInstrumentForm(nodes.main, {
    mode: 'create',
    firstRun,
    onSubmit: (values) => {
      store.addInstrument(instrumentInstance(values));
      store.set({ instrumentForm: null });
      runSearch();
      render();
    },
    onCancel: firstRun
      ? null
      : () => {
          store.set({ instrumentForm: null });
          render();
        },
  });
}

/** Deleting takes its saved shapes with it, so it asks first. */
function confirmDeleteInstrument(instrument) {
  const shapes = store.favoritesFor(instrument.id).length;
  // Songs are not tied to an instrument: they carry their own tuning, so they
  // survive and simply appear under "songs for other instruments" until
  // something is tuned to match again.
  const message = shapes
    ? `Its ${shapes} saved shape${shapes === 1 ? '' : 's'} will go with it. ` +
      'Songs are kept, since they carry their own tuning. This cannot be undone.'
    : 'Songs are kept, since they carry their own tuning. This cannot be undone.';

  confirmDialog({
    title: `Delete ${instrument.label}?`,
    message,
    confirmLabel: 'Delete instrument',
    onConfirm: () => {
      store.removeInstrument(instrument.id);
      store.set({ instrumentForm: null });
      runSearch();
      render();
    },
  });
}

function render() {
  if (store.needsSetup) {
    showCreate({ firstRun: true });
    return;
  }
  if (store.state.instrumentForm?.mode === 'create') {
    showCreate({ firstRun: false });
    return;
  }

  nodes.chip.hidden = false;
  nodes.nav.hidden = false;

  renderInstrumentChip(nodes.chip, {
    store,
    onSwitch: (id) => {
      store.setActive(id);
      store.setActiveSheet(null);
      store.set({ instrumentForm: null });
      runSearch();
      syncUrl(store.state, { instrument: store.effectiveInstrument });
      render();
    },
    onAdd: () => {
      store.set({ instrumentForm: { mode: 'create' } });
      render();
    },
  });

  renderNav(nodes.nav, { store, onNavigate: (view) => navigate(view) });

  renderViewAsBar(nodes.viewAs, {
    store,
    onBack: () => {
      store.clearViewAs();
      runSearch();
      render();
    },
    onKeep: () => {
      store.keepViewAsDefault();
      runSearch();
      render();
    },
  });

  clear(nodes.main);
  switch (store.state.view) {
    case 'instrument':
      renderInstruments();
      break;

    case 'library':
      renderLibrary(nodes.main, {
        store,
        onOpen: (entry) => {
          store.set({ chordText: entry.chordText });
          runSearch();
          navigate('explore');
        },
        onRemove: (entry) => {
          store.toggleFavorite(entry);
          render();
        },
      });
      break;

    case 'sheets':
      renderSheets();
      break;

    default:
      renderExplorer();
      break;
  }
}



/**
 * A shared sheet arrives in the fragment. It is shown as a preview first: it
 * carries its own instrument, so importing it silently would change what the
 * user is looking at (§2.1, §8.2).
 */
async function applySharedSheet() {
  let payload;
  try {
    payload = await decodeSheetLink();
  } catch (error) {
    announce(nodes.live, error.message);
    return;
  }
  if (!payload) return;

  let instrument = store.activeInstrument;
  if (payload.instrument?.strings) {
    try {
      const shared = instrumentInstance({
        catalogId: payload.instrument.catalogId ?? null,
        label: payload.instrument.label ?? 'Shared instrument',
        strings: payload.instrument.strings,
        fretCount: payload.instrument.fretCount,
      });
      if (!instrument || !sameTuning(instrument, shared)) {
        store.setViewAs(shared, 'sheet');
        instrument = shared;
      }
    } catch {
      // A tuning that no longer parses should not block the import.
    }
  }

  const sheet = sheetFromSharing(payload);
  store.addSheet(sheet);
  // Land on the song that was just imported, rather than leaving the user on
  // the chord screen wondering whether the link worked.
  store.set({ view: 'sheets' });
  try {
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
  } catch {
    /* history may be unavailable */
  }
  render();
  announce(nodes.live, `Imported the song "${sheet.title}".`);
}

mount();
applyUrlState();
if (!store.needsSetup) runSearch();
render();

// Exposed for the end-to-end tests, which need to reason about state rather
// than only about pixels.
globalThis.__ec = { store, updates: null };

const updates = setupUpdates(nodes.toast);
globalThis.__ec.updates = updates;

applySharedSheet();

// A share link opened while the app is already loaded only changes the
// fragment, so no navigation happens and the import would never run.
globalThis.addEventListener('hashchange', () => {
  applySharedSheet();
});
