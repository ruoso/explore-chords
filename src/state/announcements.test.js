import { describe, it, expect } from 'vitest';
import { pendingAnnouncement, tutorialOf, latestReleaseOf, byId } from './announcements.js';
import { ANNOUNCEMENTS, withContent } from '../data/announcements.js';
import { LOCALES, setLocale, DEFAULT_LOCALE } from '../i18n/index.js';

const list = [
  { id: 'welcome', kind: 'tutorial', title: 'Hi', sections: [] },
  { id: '0.1.0', kind: 'release', title: 'Old', sections: [] },
  { id: '0.2.0', kind: 'release', title: 'New', sections: [] },
];

describe('what to show on open', () => {
  it('shows the tutorial on a first open, and counts everything as seen', () => {
    const p = pendingAnnouncement([], list);
    expect(p.announcement.id).toBe('welcome');
    // A newcomer is not then told what changed in versions they never used.
    expect(p.markSeen).toEqual(['welcome', '0.1.0', '0.2.0']);
  });

  it('shows the newest unseen release note after that', () => {
    const p = pendingAnnouncement(['welcome', '0.1.0'], list);
    expect(p.announcement.id).toBe('0.2.0');
    expect(p.releases.map((a) => a.id)).toEqual(['0.2.0']);
    expect(p.markSeen).toEqual(['0.2.0']);
  });

  it('folds several missed releases into one, newest first, all counted as seen', () => {
    const p = pendingAnnouncement(['welcome'], list);
    expect(p.announcement.id).toBe('0.2.0');
    expect(p.releases.map((a) => a.id)).toEqual(['0.2.0', '0.1.0']);
    expect(p.markSeen).toEqual(['0.1.0', '0.2.0']);
  });

  it('shows nothing when everything has been seen', () => {
    expect(pendingAnnouncement(['welcome', '0.1.0', '0.2.0'], list)).toBeNull();
  });

  it('does not re-show the tutorial once anything has been seen', () => {
    // Someone who dismissed the tutorial before any release existed.
    const p = pendingAnnouncement(['welcome'], [list[0]]);
    expect(p).toBeNull();
  });

  it('finds the tutorial and the latest release', () => {
    expect(tutorialOf(list).id).toBe('welcome');
    expect(latestReleaseOf(list).id).toBe('0.2.0');
    expect(byId('0.1.0', list).title).toBe('Old');
    expect(byId('nope', list)).toBeNull();
  });
});

describe('the real announcements', () => {
  it('start with the tutorial and have a release to show', () => {
    expect(ANNOUNCEMENTS[0].kind).toBe('tutorial');
    expect(latestReleaseOf()).not.toBeNull();
    for (const a of ANNOUNCEMENTS) {
      expect(a.id).toBeTruthy();
      // Written out in every language, not only the source one.
      for (const locale of LOCALES) {
        setLocale(locale.id);
        const full = withContent(a);
        expect(full.title, `${a.id} in ${locale.id}`).not.toBe(a.id);
        expect(full.sections.length, `${a.id} in ${locale.id}`).toBeGreaterThan(0);
        for (const s of full.sections) {
          expect(s.heading).toBeTruthy();
          expect(s.text).toBeTruthy();
        }
      }
      setLocale(DEFAULT_LOCALE);
    }
  });

  it('have unique ids', () => {
    const ids = ANNOUNCEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
