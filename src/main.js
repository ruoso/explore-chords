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
import { renderBackupPage } from './ui/backup-view.js';
import { renderNav } from './ui/nav.js';
import {
  renderInstrumentList,
  renderInstrumentEditor,
} from './ui/instrument-settings.js';
import { confirmDialog } from './ui/confirm-dialog.js';
import { renderSheetList, renderSheetEditor, renderSheetView } from './ui/sheets-view.js';
import { renderSheetPrint } from './ui/sheet-print.js';
import { sheetForSharing, sheetFromSharing } from './state/sheets.js';
import { encodeSheetLink, decodeSheetLink } from './state/codec.js';
import { instrumentInstance } from './core/instrument.js';
import { createZip, readZip } from './state/zip.js';
import { backupFiles, backupFileName, readBackup } from './state/backup.js';
import {
  saveInstruments,
  saveActiveId,
  savePrefs,
  saveFavorites,
  deserialiseInstrument,
  DEFAULT_PREFS,
} from './state/persist.js';
import { saveSheets } from './state/sheets.js';
import { setupUpdates } from './ui/update-toast.js';
import { setupInstallPrompt } from './ui/install-prompt.js';
import { setupAnnouncements } from './ui/announcement-dialog.js';
import { renderLocaleSelect, applyLocale } from './ui/locale-select.js';
import { t, errorText } from './i18n/index.js';

const store = createStore();
let install = null;
let announcements = null;
const fromUrl = readUrl();

const root = document.querySelector('#app');

const nodes = {
  header: el('header', { class: 'ec-header' }),
  actions: el('div', { class: 'ec-header-actions' }),
  locale: el('div', { class: 'ec-header-locale' }),
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
  install: el('div', { class: 'ec-install-slot', hidden: true }),
};

function mount() {
  clear(root);
  nodes.header.append(el('h1', { class: 'ec-title' }, t('app.name')), nodes.actions);
  renderHeaderActions();
  root.append(
    nodes.header,
    nodes.nav,
    nodes.viewAs,
    nodes.main,
    nodes.live,
    nodes.install,
    nodes.toast
  );
}

/**
 * The header's controls, redrawn whenever the language changes, since the
 * header is otherwise built once.
 */
function renderHeaderActions() {
  clear(nodes.actions);
  const help = el(
    'button',
    { type: 'button', class: 'ec-help-button', id: 'help-open', 'aria-label': t('header.helpLabel') },
    t('header.help')
  );
  help.addEventListener('click', () => announcements?.open('welcome'));
  renderLocaleSelect(nodes.locale, {
    store,
    onChange: (locale) => {
      store.setPrefs({ locale });
      applyLocale(store);
      renderHeaderActions();
      render();
    },
  });
  nodes.actions.append(nodes.locale, help, nodes.chip);
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
      ? t('results.announceNone')
      : t('results.announceCount', { count: results.count, positions: results.groups.length })
  );

  // Now the user has seen what the app does, it is fair to ask about installing.
  if (results.count > 0) install?.offer();
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
    'aria-label': t('editor.shareLabel'),
    class: 'ec-share-link',
  });
  box.append(
    el('p', { class: 'ec-help' }, t('editor.shareHelp')),
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
  const sheet = store.activeSheet;
  if (!sheet) {
    renderSheetList(nodes.main, {
      store,
      onOpen: (id, mode) => {
        store.setActiveSheet(id, mode);
        navigate('sheets');
      },
      onChange: () => {
        clear(nodes.main);
        renderSheets();
      },
    });
    return;
  }

  const redraw = () => {
    clear(nodes.main);
    renderSheets();
  };
  const toList = () => {
    store.setActiveSheet(null);
    navigate('sheets');
  };

  // Reading and editing are two pages over one song, and a song opens to be
  // read (state/store.js). The editor is a page away in either direction.
  if (store.state.sheetMode !== 'edit') {
    renderSheetView(nodes.main, {
      store,
      sheet,
      onBack: toList,
      onEdit: () => {
        store.set({ sheetMode: 'edit' });
        redraw();
      },
      onShare: shareSheet,
      onPrint: printSheet,
    });
    return;
  }

  renderSheetEditor(nodes.main, {
    store,
    sheet,
    onBack: toList,
    onView: () => {
      store.set({ sheetMode: 'view' });
      redraw();
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

/**
 * Everything the app knows, in one file the user keeps (§8.4).
 *
 * A blob and a link that clicks itself: there is nowhere to send it and nothing
 * to ask a server for, which is the whole point of a browser holding the data.
 */
async function saveBackup(error) {
  error.hidden = true;
  try {
    const at = new Date();
    const blob = await createZip(backupFiles(store.state, at), at);
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: backupFileName(at) });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    error.textContent = t('backup.failed', { reason: errorText(e) });
    error.hidden = false;
  }
}

/**
 * Put a backup back, over everything that is here.
 *
 * Restoring is replacing — a backup is the state of a device, not a set of
 * changes to merge into one — so it asks first and says what the file holds.
 * The new state is written to storage and the page reloaded, so that everything
 * comes up through the same load path as any other visit: the migrations, the
 * preset refresh, all of it.
 */
async function restoreBackup(file, error) {
  error.hidden = true;
  let backup;
  try {
    backup = readBackup(await readZip(await file.arrayBuffer()));
  } catch (e) {
    error.textContent = t('backup.failed', { reason: errorText(e) });
    error.hidden = false;
    return;
  }

  confirmDialog({
    title: t('backup.confirmTitle', { name: file.name }),
    message: t('backup.confirmBody', {
      instruments: t('backup.instruments', { count: backup.instruments.length }),
      songs: t('backup.songs', { count: backup.sheets.length }),
    }),
    confirmLabel: t('backup.confirmButton'),
    onConfirm: () => {
      const instruments = [];
      for (const entry of backup.instruments) {
        try {
          instruments.push(deserialiseInstrument(entry));
        } catch {
          // One instrument whose tuning no longer parses must not take the
          // rest of the backup with it.
        }
      }
      saveInstruments(instruments);
      saveActiveId(instruments.some((i) => i.id === backup.activeId) ? backup.activeId : null);
      if (backup.prefs) savePrefs({ ...DEFAULT_PREFS, ...backup.prefs });
      saveFavorites(backup.favorites);
      saveSheets(backup.sheets);
      // Reloaded onto a bare address, not the one we are on: every bit of
      // screen state lives in the query string (§8.1), so reloading with it
      // would come up "viewing as" the instrument this device had before the
      // restore — one that the backup has just replaced.
      globalThis.location.replace(globalThis.location.pathname);
    },
  });
}

/** Deleting takes its saved shapes with it, so it asks first. */
function confirmDeleteInstrument(instrument) {
  const shapes = store.favoritesFor(instrument.id).length;
  // Songs are not tied to an instrument: they carry their own tuning, so they
  // survive and simply appear under "songs for other instruments" until
  // something is tuned to match again.
  const message =
    (shapes ? t('instruments.confirmShapes', { count: shapes }) : '') + t('instruments.confirmSongs');

  confirmDialog({
    title: t('instruments.confirmTitle', { label: instrument.label }),
    message,
    confirmLabel: t('instruments.confirmButton'),
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

  // The app proper is on screen: the first time that happens, say hello or
  // say what changed. Not during setup — a tutorial about screens you cannot
  // see yet would be noise.
  announcements?.maybeShow();

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

    case 'backup':
      renderBackupPage(nodes.main, { onSave: saveBackup, onRestore: restoreBackup });
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
    announce(nodes.live, errorText(error));
    return;
  }
  if (!payload) return;

  let instrument = store.activeInstrument;
  if (payload.instrument?.strings) {
    try {
      const shared = instrumentInstance({
        catalogId: payload.instrument.catalogId ?? null,
        label: payload.instrument.label ?? t('sheets.sharedInstrument'),
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
  announce(nodes.live, t('sheets.imported', { title: sheet.title }));
}

applyLocale(store);
mount();
applyUrlState();
if (!store.needsSetup) runSearch();
render();

// Exposed for the end-to-end tests, which need to reason about state rather
// than only about pixels.
globalThis.__ec = { store, updates: null, install: null };

globalThis.__ec.updates = setupUpdates(nodes.toast);

install = setupInstallPrompt(nodes.install, { store });
globalThis.__ec.install = install;

announcements = setupAnnouncements({ store });
globalThis.__ec.announcements = announcements;
// The initial render ran before the controller existed; give it its chance now.
if (!store.needsSetup && !store.state.instrumentForm) announcements.maybeShow();

applySharedSheet();

// A share link opened while the app is already loaded only changes the
// fragment, so no navigation happens and the import would never run.
globalThis.addEventListener('hashchange', () => {
  applySharedSheet();
});
