/**
 * Add a variation of a song's voicings (docs/DESIGN.md §2.13).
 *
 * One instrument may want several variations in one song: an easy version and a
 * fuller one, or two runs of the wizard kept side by side. The song text holds
 * them all, each named by its heading, so a new variation is a name and a
 * decision about where its shapes start from.
 *
 * Copying is the usual need — "the same, but with these three changed" — and an
 * empty variation is the other, where every chord sits on its default until one is
 * chosen, exactly as a song with no voicings at all already behaves.
 */

import { el } from './dom.js';
import { addVariation, variationsFor, parseSong } from '../core/song.js';
import { t } from '../i18n/index.js';

export function openVariationDialog({
  store,
  sheet,
  tuning,
  dialect,
  from,
  fromLabel,
  onAdd,
}) {
  const existing = document.querySelector('#variation-dialog');
  if (existing) existing.remove();

  const dialog = el('dialog', {
    class: 'ec-dialog ec-dialog-variation',
    id: 'variation-dialog',
    'aria-labelledby': 'variation-dialog-title',
  });
  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const name = el('input', {
    type: 'text',
    id: 'variation-name',
    class: 'ec-chord-input',
    placeholder: t('editor.variationPlaceholder'),
    autocomplete: 'off',
  });
  const copy = el('input', { type: 'checkbox', id: 'variation-copy', checked: true });
  const error = el('p', { class: 'ec-error', id: 'variation-error', hidden: true });

  const add = () => {
    const wanted = name.value.trim();
    if (!wanted) {
      error.textContent = t('editor.variationNeedsName');
      error.hidden = false;
      name.focus();
      return;
    }
    // A name already in use would silently land you in that variation rather
    // than a new one, which is worse than saying so.
    const taken = variationsFor(parseSong(sheet.body, dialect), tuning).some(
      (entry) => entry.name === wanted
    );
    if (taken) {
      error.textContent = t('editor.variationTaken', { name: wanted });
      error.hidden = false;
      name.focus();
      return;
    }

    const next = addVariation(sheet.body, {
      tuning,
      name: wanted,
      copyFrom: copy.checked ? from : null,
      dialect,
    });
    store.updateSheet(sheet.id, (s) => ({ ...s, body: next }));
    // A variation is added to be worked in, so it becomes the one in use.
    store.chooseVariation(sheet.id, tuning, wanted);
    close();
    onAdd?.();
  };

  const form = el('form', { class: 'ec-variation-form', novalidate: true });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    add();
  });
  form.append(
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'variation-name' }, t('editor.variationName')),
      name
    ),
    el('label', { class: 'ec-song-option', for: 'variation-copy' }, copy, t('editor.variationCopy', { name: fromLabel })),
    error
  );

  dialog.append(
    el('h2', { class: 'ec-dialog-title', id: 'variation-dialog-title' }, t('editor.variationAdd')),
    el('p', { class: 'ec-help' }, t('editor.variationHelp')),
    form,
    el(
      'div',
      { class: 'ec-dialog-actions' },
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'variation-cancel', onClick: close },
        t('editor.variationCancel')
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small ec-button-primary',
          id: 'variation-confirm',
          onClick: add,
        },
        t('editor.variationConfirm')
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
