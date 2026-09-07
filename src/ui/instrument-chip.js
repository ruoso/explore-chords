/**
 * The header instrument switcher (docs/DESIGN.md §2.1).
 *
 * The active instrument is ambient context, shown always, switched in one tap.
 * Everything on screen re-derives when it changes.
 */

import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';

export function renderInstrumentChip(container, { store, onAdd, onSwitch }) {
  clear(container);
  const state = store.state;
  const active = store.activeInstrument;
  if (!active) return;

  const details = el('details', { class: 'ec-chip' });
  const summary = el(
    'summary',
    { class: 'ec-chip-summary', 'aria-label': t('chip.summary', { label: active.label }) },
    el('span', { class: 'ec-chip-icon', 'aria-hidden': 'true' }, '♫'),
    el('span', { class: 'ec-chip-label' }, active.label)
  );

  const list = el('ul', { class: 'ec-chip-list' });
  for (const instrument of state.instruments) {
    const isActive = instrument.id === active.id;
    const button = el(
      'button',
      {
        type: 'button',
        class: `ec-chip-item${isActive ? ' is-active' : ''}`,
        'aria-current': isActive ? 'true' : null,
        onClick: () => {
          details.open = false;
          if (!isActive) onSwitch(instrument.id);
        },
      },
      el('span', {}, instrument.label),
      isActive ? el('span', { class: 'ec-chip-tick', 'aria-hidden': 'true' }, '✓') : null
    );
    list.append(el('li', {}, button));
  }

  list.append(
    el(
      'li',
      {},
      el(
        'button',
        { type: 'button', class: 'ec-chip-item ec-chip-add', onClick: () => {
          details.open = false;
          onAdd();
        } },
        t('chip.add')
      )
    )
  );

  details.append(summary, list);
  container.append(details);
  return details;
}
