/**
 * The transient "viewing as" bar (docs/DESIGN.md §2.1).
 *
 * A shared link or a song sheet can carry its own instrument. Rather than
 * silently retuning the content or changing the user's default, the app borrows
 * that instrument for this view only and says so. One mechanism serves both
 * cases.
 */

import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';

export function renderViewAsBar(container, { store, onBack, onKeep }) {
  clear(container);
  const { viewAs } = store.state;
  if (!viewAs) {
    container.hidden = true;
    return null;
  }

  container.hidden = false;
  const mine = store.activeInstrument;
  const source = t(viewAs.source === 'sheet' ? 'viewAs.fromSheet' : 'viewAs.fromLink');

  const bar = el(
    'div',
    { class: 'ec-viewas', role: 'status' },
    el(
      'p',
      { class: 'ec-viewas-text' },
      el('span', { class: 'ec-viewas-icon', 'aria-hidden': 'true' }, '⚠'),
      t('viewAs.viewing', { label: viewAs.instance.label, source })
    ),
    el(
      'div',
      { class: 'ec-viewas-actions' },
      mine
        ? el(
            'button',
            { type: 'button', class: 'ec-button ec-button-small', onClick: onBack },
            t('viewAs.back', { label: mine.label })
          )
        : null,
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', onClick: onKeep },
        t('viewAs.keep')
      )
    )
  );

  container.append(bar);
  return bar;
}
