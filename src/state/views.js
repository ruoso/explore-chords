/**
 * Which screen is showing.
 *
 * The explorer is a tool, not a dashboard: it holds the chord input and the
 * results, and nothing else. Instrument settings, saved shapes and song sheets
 * are their own screens, reached from the navigation.
 *
 * Views live in the query string like all other state (docs/DESIGN.md §8.1),
 * so a project-subpath deploy needs no SPA fallback.
 */

export const VIEWS = {
  explore: { id: 'explore', label: 'Chords', title: 'Explore chords' },
  instrument: { id: 'instrument', label: 'Instrument', title: 'Instrument settings' },
  library: { id: 'library', label: 'Saved', title: 'Saved shapes' },
  sheets: { id: 'sheets', label: 'Songs', title: 'Song sheets' },
};

export const DEFAULT_VIEW = 'explore';

export function isView(id) {
  return Object.prototype.hasOwnProperty.call(VIEWS, id);
}

export function viewOf(id) {
  return VIEWS[isView(id) ? id : DEFAULT_VIEW];
}
