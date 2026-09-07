/**
 * Diagram display toggles (docs/DESIGN.md §2.3).
 *
 * Vertical chord box or horizontal neck, and a left-handed mirror. Both are
 * display concerns: they change how a fingering is drawn, never which
 * fingerings are found.
 */

import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';

export function renderDisplayToggles(container, { store, onChange }) {
  clear(container);
  const { orientation, handed } = store.state.prefs;

  const group = el('div', {
    class: 'ec-toggles',
    role: 'group',
    'aria-label': t('toggles.label'),
  });

  const toggle = (label, pressed, onClick) =>
    el(
      'button',
      {
        type: 'button',
        class: `ec-toggle${pressed ? ' is-on' : ''}`,
        'aria-pressed': pressed ? 'true' : 'false',
        onClick,
      },
      label
    );

  group.append(
    toggle(t('toggles.neck'), orientation === 'horizontal', () =>
      onChange({ orientation: orientation === 'horizontal' ? 'vertical' : 'horizontal' })
    ),
    toggle(t('toggles.left'), handed === 'left', () =>
      onChange({ handed: handed === 'left' ? 'right' : 'left' })
    )
  );

  container.append(group);
}
