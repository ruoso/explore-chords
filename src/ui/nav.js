/**
 * Screen navigation.
 *
 * The explorer is a tool, not a dashboard. Instrument settings, saved shapes
 * and song sheets each get their own screen so the chord view holds only the
 * input and the results.
 */

import { el, clear } from './dom.js';
import { VIEWS } from '../state/views.js';

export function renderNav(container, { store, onNavigate }) {
  clear(container);
  const current = store.state.view;

  const nav = el('nav', { class: 'ec-nav', 'aria-label': 'Sections' });
  const list = el('ul', { class: 'ec-nav-list' });

  for (const view of Object.values(VIEWS)) {
    const active = view.id === current;
    list.append(
      el(
        'li',
        {},
        el(
          'button',
          {
            type: 'button',
            class: `ec-nav-item${active ? ' is-active' : ''}`,
            id: `nav-${view.id}`,
            'aria-current': active ? 'page' : null,
            onClick: () => onNavigate(view.id),
          },
          view.label
        )
      )
    );
  }

  nav.append(list);
  container.append(nav);
}
