/**
 * Add a set of voicings to a song (docs/DESIGN.md §2.13).
 *
 * One instrument may want several sets in one song: an easy version and a
 * fuller one, or two runs of the wizard kept side by side. The song text holds
 * them all, each named by its heading, so a new set is a name and a decision
 * about where its shapes start from.
 *
 * Copying is the usual need — "the same, but with these three changed" — and an
 * empty set is the other, where every chord sits on its default until one is
 * chosen, exactly as a song with no voicings at all already behaves.
 */

import { el } from './dom.js';
import { addVoicingSet, voicingSetsFor, parseSong } from '../core/song.js';
import { t } from '../i18n/index.js';

export function openSetDialog({ store, sheet, tuning, dialect, from, fromLabel, onAdd }) {
  const existing = document.querySelector('#set-dialog');
  if (existing) existing.remove();

  const dialog = el('dialog', {
    class: 'ec-dialog ec-dialog-set',
    id: 'set-dialog',
    'aria-labelledby': 'set-dialog-title',
  });
  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const name = el('input', {
    type: 'text',
    id: 'set-name',
    class: 'ec-chord-input',
    placeholder: t('editor.setPlaceholder'),
    autocomplete: 'off',
  });
  const copy = el('input', { type: 'checkbox', id: 'set-copy', checked: true });
  const error = el('p', { class: 'ec-error', id: 'set-error', hidden: true });

  const add = () => {
    const wanted = name.value.trim();
    if (!wanted) {
      error.textContent = t('editor.setNeedsName');
      error.hidden = false;
      name.focus();
      return;
    }
    // A name already in use would silently land you in that set rather than a
    // new one, which is worse than saying so.
    const taken = voicingSetsFor(parseSong(sheet.body, dialect), tuning).some(
      (entry) => entry.name === wanted
    );
    if (taken) {
      error.textContent = t('editor.setTaken', { name: wanted });
      error.hidden = false;
      name.focus();
      return;
    }

    const next = addVoicingSet(sheet.body, {
      tuning,
      name: wanted,
      copyFrom: copy.checked ? from : null,
      dialect,
    });
    store.updateSheet(sheet.id, (s) => ({ ...s, body: next }));
    // Added sets are for working in, so the new one becomes the one in use.
    store.chooseVoicingSet(sheet.id, tuning, wanted);
    close();
    onAdd?.();
  };

  const form = el('form', { class: 'ec-set-form', novalidate: true });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    add();
  });
  form.append(
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'set-name' }, t('editor.setName')),
      name
    ),
    el('label', { class: 'ec-song-option', for: 'set-copy' }, copy, t('editor.setCopy', { name: fromLabel })),
    error
  );

  dialog.append(
    el('h2', { class: 'ec-dialog-title', id: 'set-dialog-title' }, t('editor.setAdd')),
    el('p', { class: 'ec-help' }, t('editor.setHelp')),
    form,
    el(
      'div',
      { class: 'ec-dialog-actions' },
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'set-cancel', onClick: close },
        t('editor.setCancel')
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small ec-button-primary',
          id: 'set-add',
          onClick: add,
        },
        t('editor.setConfirm')
      )
    )
  );

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
  name.focus();
  return dialog;
}
