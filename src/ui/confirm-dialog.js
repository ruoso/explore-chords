/**
 * A confirmation modal for actions that throw work away.
 *
 * Native <dialog>, so focus trapping and Escape come for free. Escape and the
 * backdrop both cancel, because the safe answer should be the easy one.
 */

import { el } from './dom.js';

export function confirmDialog({ title, message, confirmLabel = 'Delete', onConfirm }) {
  const existing = document.querySelector('#confirm-dialog');
  if (existing) existing.remove();

  const dialog = el('dialog', {
    class: 'ec-dialog ec-dialog-confirm',
    id: 'confirm-dialog',
    'aria-labelledby': 'confirm-dialog-title',
  });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  dialog.append(
    el('h2', { class: 'ec-dialog-title', id: 'confirm-dialog-title' }, title),
    el('p', { class: 'ec-dialog-body' }, message),
    el(
      'div',
      { class: 'ec-dialog-actions' },
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'confirm-cancel', onClick: close },
        'Cancel'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small ec-button-danger',
          id: 'confirm-ok',
          onClick: () => {
            close();
            onConfirm();
          },
        },
        confirmLabel
      )
    )
  );

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
  document.querySelector('#confirm-cancel')?.focus();
  return dialog;
}
