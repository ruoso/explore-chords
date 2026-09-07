/**
 * Which announcement to show, if any (docs/DESIGN.md §2.8).
 *
 * The rule is small enough to state whole. On a first open — nothing seen yet
 * — show the tutorial, and count everything current as seen, so a newcomer is
 * not then told what changed in versions they never used. Otherwise show the
 * newest release note not yet seen. Opening something by hand, from the Help
 * link, changes none of this.
 */

import { ANNOUNCEMENTS } from '../data/announcements.js';

export function tutorialOf(list = ANNOUNCEMENTS) {
  return list.find((a) => a.kind === 'tutorial') ?? null;
}

export function latestReleaseOf(list = ANNOUNCEMENTS) {
  const releases = list.filter((a) => a.kind === 'release');
  return releases[releases.length - 1] ?? null;
}

export function byId(id, list = ANNOUNCEMENTS) {
  return list.find((a) => a.id === id) ?? null;
}

export function allIds(list = ANNOUNCEMENTS) {
  return list.map((a) => a.id);
}

/**
 * @param {string[]} seen   ids already shown
 * @returns {{ announcement: object, markSeen: string[] } | null}
 *   what to show, and which ids to record as seen once it is closed
 */
export function pendingAnnouncement(seen = [], list = ANNOUNCEMENTS) {
  const seenSet = new Set(seen);

  if (seenSet.size === 0) {
    const tutorial = tutorialOf(list);
    if (tutorial) return { announcement: tutorial, markSeen: allIds(list) };
  }

  const unseen = list.filter((a) => a.kind === 'release' && !seenSet.has(a.id));
  const newest = unseen[unseen.length - 1];
  if (newest) return { announcement: newest, markSeen: [newest.id] };

  return null;
}
