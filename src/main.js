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
  });
}

function renderExplorer() {
  clear(nodes.main);

  const instrument = store.effectiveInstrument;
  const { chord, results } = store.state;

  const inputBox = el('div', { class: 'ec-input-area' });
  resultsBox = el('div', { class: 'ec-results' });
  nodes.main.append(inputBox, resultsBox);

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

  renderResults(resultsBox, {
    store,
    results,
    chord,
    instrument,
    onShowMore: (position) => {
      const expanded = { ...(store.state.expandedGroups ?? {}) };
      expanded[position] = !expanded[position];
      store.set({ expandedGroups: expanded });
      renderResultsOnly();
    },
  });
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

mount();
applyUrlState();
if (!store.needsSetup) runSearch();
render();

// Exposed for the end-to-end tests, which need to reason about state rather
// than only about pixels.
globalThis.__ec = { store };
