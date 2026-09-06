/**
 * Service worker registration and the update prompt (docs/DESIGN.md §7).
 *
 * A new version installs in the background and then *asks*. Reloading under
 * someone mid-lesson, with a sheet open, would be worse than showing a stale
 * version for a few minutes.
 */

import { el, clear } from './dom.js';

export function setupUpdates(container) {
  if (!('serviceWorker' in navigator)) return null;

  let updateHandler = null;

  const show = () => {
    clear(container);
    container.hidden = false;
    container.append(
      el(
        'div',
        { class: 'ec-toast', role: 'status' },
        el('p', { class: 'ec-toast-text' }, 'A new version is ready.'),
        el(
          'div',
          { class: 'ec-toast-actions' },
          el(
            'button',
            {
              type: 'button',
              class: 'ec-button ec-button-small ec-button-primary',
              id: 'update-reload',
              onClick: () => updateHandler?.(),
            },
            'Reload'
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'ec-button ec-button-small',
              id: 'update-dismiss',
              onClick: () => {
                container.hidden = true;
                clear(container);
              },
            },
            'Later'
          )
        )
      )
    );
  };

  // Registered dynamically so the bundle does not hard-depend on the plugin's
  // virtual module when service workers are unavailable.
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const update = registerSW({
        onNeedRefresh() {
          show();
        },
      });
      updateHandler = () => update(true);
    })
    .catch(() => {
      // No service worker support, or the module is absent in a dev build.
    });

  return { show };
}
