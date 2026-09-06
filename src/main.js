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
import { renderInstrumentSetup } from './ui/instrument-setup.js';
import { renderInstrumentChip } from './ui/instrument-chip.js';
import { renderViewAsBar } from './ui/view-as-bar.js';
import { renderResults } from './ui/results.js';
import { renderChordInput } from './ui/chord-input.js';
import { renderDisplayToggles } from './ui/display-toggles.js';
import { renderHeuristicsPanel } from './ui/heuristics-dialog.js';
import { renderLibrary } from './ui/library.js';
import { renderSheetEditor } from './ui/sheet-editor.js';
import { renderSheetPrint } from './ui/sheet-print.js';
import { sheetForSharing, sheetFromSharing } from './state/sheets.js';
import { encodeSheetLink, decodeSheetLink } from './state/codec.js';
import { instrumentInstance } from './core/instrument.js';

const store = createStore();
const fromUrl = readUrl();

const root = document.querySelector('#app');

const nodes = {
  header: el('header', { class: 'ec-header' }),
  chip: el('div', { class: 'ec-header-chip' }),
  viewAs: el('div', { class: 'ec-viewas-slot', hidden: true }),
  main: el('main', { class: 'ec-main', id: 'main' }),
  live: el('div', {
    class: 'ec-visually-hidden',
    role: 'status',
    'aria-live': 'polite',
  }),
};

function mount() {
  clear(root);
  nodes.header.append(
    el('h1', { class: 'ec-title' }, 'Explore Chords'),
    nodes.chip
  );
  root.append(nodes.header, nodes.viewAs, nodes.main, nodes.live);
}

/** Apply anything the URL carried, once, at startup. */
function applyUrlState() {
  const patch = {};
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

function showSetup({ firstRun }) {
  clear(nodes.main);
  nodes.chip.hidden = true;
  renderInstrumentSetup(nodes.main, {
    firstRun,
    onDone: (instrument) => {
      store.addInstrument(instrument);
      nodes.chip.hidden = false;
      render();
      runSearch();
    },
    onCancel: firstRun
      ? null
      : () => {
          render();
        },
  });
}

/** The live chord-input controls, built once per explorer render. */
let chordInput = null;
let resultsBox = null;

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

let libraryBox = null;
let sheetsBox = null;

function renderSheetsOnly() {
  if (!sheetsBox) return;
  const wasOpen = sheetsBox.querySelector('details')?.open;
  renderSheetEditor(sheetsBox, {
    store,
    onChange: () => renderSheetsOnly(),
    onShare: () => shareSheet(),
    onPrint: () => printSheet(),
  });
  if (wasOpen) sheetsBox.querySelector('details').open = true;
  renderResultsOnly();
}

/** Put a share link for the open sheet on screen, ready to copy. */
async function shareSheet() {
  const sheet = store.activeSheet;
  const instrument = store.effectiveInstrument;
  if (!sheet || !instrument) return;
  const fragment = await encodeSheetLink(sheetForSharing(sheet, instrument));
  const url = `${globalThis.location.origin}${globalThis.location.pathname}${fragment}`;
  const box = document.querySelector('#sheet-share-out') ?? el('div', { id: 'sheet-share-out' });
  clear(box);
  box.className = 'ec-share-out';
  const field = el('input', {
    type: 'text',
    readonly: true,
    value: url,
    'aria-label': 'Share link for this sheet',
    class: 'ec-share-link',
  });
  box.append(
    el('p', { class: 'ec-help' }, 'Anyone opening this link sees the sheet as written.'),
    field
  );
  sheetsBox.querySelector('.ec-sheets-body')?.append(box);
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

function renderLibraryOnly() {
  if (!libraryBox) return;
  const wasOpen = libraryBox.querySelector('details')?.open;
  renderLibrary(libraryBox, {
    store,
    onOpen: (entry) => {
      applyChordText(entry.chordText, { source: 'library' });
      chordInput?.setText(entry.chordText);
    },
    onRemove: (entry) => {
      store.toggleFavorite(entry);
      renderLibraryOnly();
      renderResultsOnly();
    },
  });
  if (wasOpen) libraryBox.querySelector('details').open = true;
}

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
    onAddToSheet: store.activeSheet
      ? (fingering) => {
          store.addSlot({
            chordText: store.state.chordText,
            frets: fingering.frets,
          });
          renderSheetsOnly();
        }
      : null,
    onToggleFavorite: (fingering) => {
      store.toggleFavorite({
        instrumentId: store.effectiveInstrument.id,
        chordText: store.state.chordText,
        frets: fingering.frets,
      });
      renderResultsOnly();
      renderLibraryOnly();
    },
  });
}

function renderExplorer() {
  clear(nodes.main);

  const instrument = store.effectiveInstrument;
  const { chord, results } = store.state;

  const inputBox = el('div', { class: 'ec-input-area' });
  const heuristicsBox = el('div', { class: 'ec-heuristics-area' });
  libraryBox = el('div', { class: 'ec-library-area' });
  sheetsBox = el('div', { class: 'ec-sheets-area' });
  const toggleBox = el('div', { class: 'ec-toggle-area' });
  resultsBox = el('div', { class: 'ec-results' });
  nodes.main.append(inputBox, heuristicsBox, libraryBox, sheetsBox, toggleBox, resultsBox);

  const drawHeuristics = () => {
    const panel = renderHeuristicsPanel(heuristicsBox, {
      store,
      onChange: (config) => {
        const target = store.state.viewAs?.instance ?? store.activeInstrument;
        // Rules belong to the instrument, so this writes to the instance and is
        // saved with it (§2.4).
        if (store.state.viewAs) {
          store.set({ viewAs: { ...store.state.viewAs, instance: { ...target, heuristics: config } } });
        } else {
          store.updateInstrument(target.id, { heuristics: config });
        }
        runSearch();
        const wasOpen = heuristicsBox.querySelector('details')?.open;
        drawHeuristics();
        if (wasOpen) heuristicsBox.querySelector('details').open = true;
        renderResultsOnly();
      },
    });
    return panel;
  };
  drawHeuristics();
  renderLibraryOnly();
  renderSheetsOnly();

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

  void chord;
  void results;
  void instrument;
  renderResultsOnly();
}

function render() {
  if (store.needsSetup) {
    showSetup({ firstRun: true });
    return;
  }

  nodes.chip.hidden = false;
  renderInstrumentChip(nodes.chip, {
    store,
    onSwitch: (id) => {
      store.setActive(id);
      runSearch();
      syncUrl(store.state, { instrument: store.effectiveInstrument });
      render();
    },
    onAdd: () => showSetup({ firstRun: false }),
  });

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

  renderExplorer();
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

  const sheet = sheetFromSharing(payload, instrument?.id ?? null);
  store.addSheet(sheet);
  try {
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
  } catch {
    /* history may be unavailable */
  }
  render();
  announce(nodes.live, `Imported the song sheet "${sheet.title}".`);
}

mount();
applyUrlState();
if (!store.needsSetup) runSearch();
render();

// Exposed for the end-to-end tests, which need to reason about state rather
// than only about pixels.
globalThis.__ec = { store };

applySharedSheet();

// A share link opened while the app is already loaded only changes the
// fragment, so no navigation happens and the import would never run.
globalThis.addEventListener('hashchange', () => {
  applySharedSheet();
});
