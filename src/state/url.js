/**
 * URL state (docs/DESIGN.md §8.1).
 *
 *     ?c=Cmaj7%2311&i=6guitar&t=E2,A2,D3,G3,B3,E4&h=jazz
 *
 * The chord travels in canonical form via its symbol, so a recipient reading a
 * different dialect still gets the right chord. The instrument travels as a
 * catalog id plus a tuning; when it differs from the recipient's own active
 * instrument it raises the "viewing as" bar rather than retuning their content
 * or hijacking their default.
 */

import { instrumentInstance, catalogEntry } from '../core/instrument.js';
import { formatTuning } from '../core/instrument.js';
import { DIALECT_IDS } from '../core/notation/dialects.js';
import { PRESET_IDS } from '../core/heuristics.js';
import { isView } from './views.js';
import { t } from '../i18n/index.js';

/** Read app state out of a URL's query string. */
export function readUrl(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search);
  const out = {};

  const view = params.get('v');
  if (view && isView(view)) out.view = view;

  const sheetId = params.get('sheet');
  if (sheetId) out.sheetId = sheetId;

  const chordText = params.get('c');
  if (chordText) out.chordText = chordText;

  const dialect = params.get('d');
  if (dialect && DIALECT_IDS.includes(dialect)) out.dialect = dialect;

  const preset = params.get('h');
  if (preset && PRESET_IDS.includes(preset)) out.preset = preset;

  const tuning = params.get('t');
  if (tuning) {
    const catalogId = params.get('i');
    const entry = catalogId ? catalogEntry(catalogId) : undefined;
    try {
      out.instrument = instrumentInstance({
        catalogId: entry ? catalogId : null,
        label: params.get('l') ?? entry?.name ?? t('sheets.sharedInstrument'),
        strings: tuning,
        fretCount: entry?.fretCount,
      });
    } catch {
      // A malformed tuning in a link should not stop the app loading.
    }
  }

  const orientation = params.get('o');
  if (orientation === 'horizontal' || orientation === 'vertical') {
    out.orientation = orientation;
  }

  return out;
}

/** Build the query string for the current state. */
export function writeUrl({
  chordText,
  instrument,
  dialect,
  preset,
  orientation,
  view,
  sheetId,
} = {}) {
  const params = new URLSearchParams();
  if (view && view !== 'explore') params.set('v', view);
  if (sheetId) params.set('sheet', sheetId);
  if (chordText) params.set('c', chordText);
  if (instrument) {
    if (instrument.catalogId) params.set('i', instrument.catalogId);
    params.set('t', formatTuning(instrument.strings));
    if (instrument.label) params.set('l', instrument.label);
  }
  if (dialect) params.set('d', dialect);
  if (preset && preset !== 'standard') params.set('h', preset);
  if (orientation && orientation !== 'vertical') params.set('o', orientation);
  return params.toString();
}

/**
 * Replace the address bar without adding a history entry.
 * Every navigation in this app lives in the query string and fragment, so a
 * project-subpath deploy needs no SPA fallback (§3.1).
 */
export function syncUrl(state, { instrument } = {}) {
  const query = writeUrl({
    view: state.view,
    sheetId: state.view === 'sheets' ? state.activeSheetId : null,
    chordText: state.chordText,
    instrument,
    dialect: state.prefs.dialect,
    preset: instrument?.heuristics?.preset,
    orientation: state.prefs.orientation,
  });
  const url = `${globalThis.location.pathname}${query ? `?${query}` : ''}`;
  try {
    globalThis.history.replaceState(null, '', url);
  } catch {
    /* history may be unavailable in some embedding contexts */
  }
}
