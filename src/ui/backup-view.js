/**
 * Saving everything to a file, and putting it back (docs/DESIGN.md §8.4).
 *
 * Its own screen, with its own place in the navigation. It lived on the
 * instrument screen first, on the reasoning that that is the closest thing here
 * to a settings page — which is true and beside the point: a backup is about
 * everything, not about an instrument, and something you are told to do before
 * you lose your phone has to be somewhere you can find without being told where
 * to look.
 */

import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';

export function renderBackupPage(container, { onSave, onRestore }) {
  clear(container);
  const page = el('div', { class: 'ec-page' });
  const error = el('p', { class: 'ec-error', id: 'backup-error', role: 'alert', hidden: true });

  // The real control is the button; the input is machinery, kept out of the way
  // of anything that reads or tabs through the page.
  const file = el('input', {
    type: 'file',
    id: 'backup-file',
    accept: '.zip,application/zip',
    class: 'ec-visually-hidden',
    tabindex: '-1',
    'aria-hidden': 'true',
    onChange: (event) => {
      const chosen = event.target.files?.[0];
      event.target.value = '';
      if (chosen) onRestore(chosen, error);
    },
  });

  page.append(
    el('h2', { class: 'ec-page-title' }, t('backup.title')),
    el('p', { class: 'ec-help' }, t('backup.help')),
    el(
      'div',
      { class: 'ec-actions' },
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-primary',
          id: 'backup-save',
          onClick: () => onSave(error),
        },
        t('backup.save')
      ),
      el(
        'button',
        { type: 'button', class: 'ec-button', id: 'backup-restore', onClick: () => file.click() },
        t('backup.restore')
      )
    ),
    file,
    error,
    el('h3', { class: 'ec-panel-title' }, t('backup.insideTitle')),
    el('p', { class: 'ec-help' }, t('backup.inside')),
    el(
      'pre',
      { class: 'ec-backup-tree' },
      'settings.json\nsaved-chords.json\nsongs/Valsa.txt\nsongs/Blackbird.txt'
    )
  );

  container.append(page);
  return page;
}
