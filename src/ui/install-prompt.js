/**
 * Suggesting the app be installed (docs/DESIGN.md §7).
 *
 * Installing a PWA is not discoverable: on Android it is buried in a browser
 * menu, and on iOS it is Share then "Add to Home Screen", which nobody finds by
 * accident. A teacher who wants this on a phone for a lesson with no signal has
 * to be told it is possible.
 *
 * Two paths, because the platforms differ:
 *
 * - Where `beforeinstallprompt` fires (Android, desktop Chromium) the browser
 *   hands us the real prompt, so the button installs directly.
 * - iOS Safari never fires it and has no API, so the only honest thing is to
 *   show the steps.
 *
 * It waits until the user has actually searched a chord. Asking to install
 * before someone has seen what the app does is asking for a refusal, and the
 * refusal is permanent.
 */

import { el, clear } from './dom.js';
import { t } from '../i18n/index.js';

const DISMISSED = 'installPromptDismissed';

/** Already installed, or launched from the home screen. */
export function isInstalled() {
  try {
    return (
      globalThis.matchMedia?.('(display-mode: standalone)').matches === true ||
      globalThis.navigator?.standalone === true
    );
  } catch {
    return false;
  }
}

function isIos() {
  const ua = globalThis.navigator?.userAgent ?? '';
  // iPadOS reports as a Mac, so touch support is what distinguishes it.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && (globalThis.navigator?.maxTouchPoints ?? 0) > 1)
  );
}

export function setupInstallPrompt(container, { store }) {
  let deferred = null;
  let shown = false;
  let dismissedThisSession = false;

  const canOffer = () =>
    !isInstalled() &&
    !store.state.prefs[DISMISSED] &&
    !dismissedThisSession &&
    (deferred !== null || isIos());

  const hide = () => {
    container.hidden = true;
    clear(container);
    shown = false;
  };

  const dismiss = (forever) => {
    if (forever) store.setPrefs({ [DISMISSED]: true });
    dismissedThisSession = true;
    hide();
  };

  function show() {
    if (shown || !canOffer()) return;
    shown = true;
    clear(container);
    container.hidden = false;

    const forever = el('input', { type: 'checkbox', id: 'install-never' });

    const actions = el('div', { class: 'ec-install-actions' });

    if (deferred) {
      actions.append(
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small ec-button-primary',
            id: 'install-accept',
            onClick: async () => {
              const prompt = deferred;
              deferred = null;
              hide();
              try {
                prompt.prompt();
                await prompt.userChoice;
              } catch {
                // The browser may refuse a stale prompt; nothing to do.
              }
            },
          },
          t('install.install')
        )
      );
    }

    actions.append(
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small',
          id: 'install-dismiss',
          onClick: () => dismiss(forever.checked),
        },
        t(deferred ? 'install.notNow' : 'install.gotIt')
      )
    );

    container.append(
      el(
        'section',
        { class: 'ec-install', 'aria-label': t('install.label') },
        el(
          'div',
          { class: 'ec-install-text' },
          el('p', { class: 'ec-install-title' }, t('install.title')),
          deferred
            ? el(
                'p',
                { class: 'ec-help' },
                t('install.promptHelp')
              )
            : el(
                'p',
                { class: 'ec-help' },
                t('install.iosHelp')
              )
        ),
        actions,
        el(
          'label',
          { class: 'ec-install-never', for: 'install-never' },
          forever,
          t('install.never')
        )
      )
    );
  }

  globalThis.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's own banner from appearing on top of ours.
    event.preventDefault();
    deferred = event;
  });

  globalThis.addEventListener('appinstalled', () => {
    deferred = null;
    hide();
  });

  return {
    /** Called once the user has done something worth installing the app for. */
    offer() {
      show();
    },
    hide,
    canOffer,
  };
}
