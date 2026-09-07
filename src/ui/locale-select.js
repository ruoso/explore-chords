/**
 * The language switcher (docs/DESIGN.md §2.9).
 *
 * A plain <select> in the header, its options each written in their own
 * language, because that is how you find yours. With nothing chosen the app
 * follows the browser; choosing one is remembered on this device.
 */

import { el, clear } from './dom.js';
import { LOCALES, t, setLocale, detectLocale, currentLocale, isLocale } from '../i18n/index.js';

/** Make the language in the preferences (or the browser's) the current one. */
export function applyLocale(store) {
  const preferred = store.state.prefs.locale;
  const id = setLocale(isLocale(preferred) ? preferred : detectLocale());
  document.documentElement.lang = id;
  return id;
}

export function renderLocaleSelect(container, { store, onChange }) {
  clear(container);
  void store;
  const select = el('select', {
    id: 'locale-select',
    class: 'ec-locale',
    'aria-label': t('locale.label'),
    onChange: () => onChange(select.value),
  });
  for (const locale of LOCALES) {
    select.append(
      el('option', { value: locale.id, selected: locale.id === currentLocale() || null }, locale.name)
    );
  }
  container.append(select);
  return select;
}
