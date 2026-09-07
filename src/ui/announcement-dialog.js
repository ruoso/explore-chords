/**
 * The tutorial and "what changed" dialogs (docs/DESIGN.md §2.8).
 *
 * One dialog for both, because they are the same thing: a page of headed
 * paragraphs the app shows once unprompted and keeps available from Help.
 *
 * Native <dialog>, so focus trapping and Escape come for free. Escape and the
 * backdrop count as closing, and closing an announcement the app opened by
 * itself is what marks it seen; opening one from Help marks nothing.
 */

import { el } from './dom.js';
import { t } from '../i18n/index.js';
import { withContent } from '../data/announcements.js';
import {
  pendingAnnouncement,
  tutorialOf,
  latestReleaseOf,
  byId,
} from '../state/announcements.js';

/**
 * @param {object} options
 * @param {object} options.announcement
 * @param {object[]} [options.releases]   several release notes to show as one,
 *   newest first; the first is `announcement`
 * @param {object|null} options.alternate   the other one to offer a link to
 * @param {() => void} options.onClose
 * @param {(other: object) => void} options.onSwitch
 */
export function openAnnouncement({ announcement: entry, releases = [], alternate, onClose, onSwitch }) {
  document.querySelector('#announcement-dialog')?.remove();
  // Text is looked up at open time, so it follows the current language.
  const announcement = withContent(entry);
  const combined = releases.length > 1 ? releases.map(withContent) : null;

  const dialog = el('dialog', {
    class: 'ec-dialog ec-announcement',
    id: 'announcement-dialog',
    'data-announcement': announcement.id,
    'data-releases': combined ? combined.map((r) => r.id).join(' ') : null,
    'aria-labelledby': 'announcement-title',
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose();
  };

  const body = el('div', { class: 'ec-announcement-body' });
  const renderSections = (sections, level) => {
    for (const section of sections) {
      body.append(
        el(
          'section',
          { class: 'ec-announcement-section' },
          el(level, { class: 'ec-announcement-heading' }, section.heading),
          el('p', { class: 'ec-announcement-text' }, section.text)
        )
      );
    }
  };
  if (combined) {
    // Several releases missed: each keeps its own title over its sections,
    // one level down, so the dialog reads as one page rather than a stack.
    for (const release of combined) {
      body.append(el('h3', { class: 'ec-announcement-release' }, release.title));
      renderSections(release.sections, 'h4');
    }
  } else {
    renderSections(announcement.sections, 'h3');
  }
  const title = combined ? t('announce.sinceLast') : announcement.title;

  const isTutorial = announcement.kind === 'tutorial';
  const actions = el('div', { class: 'ec-dialog-actions ec-announcement-actions' });
  if (alternate) {
    actions.append(
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small',
          id: 'announcement-switch',
          onClick: () => {
            closed = true;
            if (dialog.open) dialog.close();
            dialog.remove();
            onSwitch(alternate);
          },
        },
        t(isTutorial ? 'announce.whatsNew' : 'announce.showTutorial')
      )
    );
  }
  actions.append(
    el(
      'button',
      {
        type: 'button',
        class: 'ec-button ec-button-small ec-button-primary',
        id: 'announcement-close',
        onClick: close,
      },
      t(isTutorial ? 'announce.letsGo' : 'announce.close')
    )
  );

  dialog.append(
    el('h2', { class: 'ec-dialog-title', id: 'announcement-title' }, title),
    body,
    actions
  );

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  // Escape fires `cancel`; the browser then closes the dialog itself.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  document.body.append(dialog);
  dialog.showModal();
  document.querySelector('#announcement-close')?.focus();
  return dialog;
}

/**
 * The controller: what to show on open, and how Help reopens things.
 *
 * `maybeShow` runs once per page load, the first time the app proper renders —
 * after first-run setup, since a tutorial describing screens you cannot see
 * yet would be noise.
 */
export function setupAnnouncements({ store }) {
  let shownThisLoad = false;

  const seen = () => store.state.prefs.seenAnnouncements ?? [];
  const markSeen = (ids) => {
    if (!ids.length) return;
    store.setPrefs({ seenAnnouncements: [...new Set([...seen(), ...ids])] });
  };

  function show(announcement, { toMark = [], releases = [] } = {}) {
    const alternate =
      announcement.kind === 'tutorial' ? latestReleaseOf() : tutorialOf();
    openAnnouncement({
      announcement,
      releases,
      alternate: alternate && alternate.id !== announcement.id ? alternate : null,
      onClose: () => markSeen(toMark),
      // Moving on to the other page is engagement enough: what the app opened
      // by itself counts as seen, and the other opens as if from Help.
      onSwitch: (other) => {
        markSeen(toMark);
        show(other);
      },
    });
  }

  return {
    maybeShow() {
      if (shownThisLoad) return;
      shownThisLoad = true;
      const pending = pendingAnnouncement(seen());
      if (pending) {
        show(pending.announcement, { toMark: pending.markSeen, releases: pending.releases });
      }
    },
    open(id) {
      const announcement = byId(id);
      if (announcement) show(announcement);
    },
  };
}
