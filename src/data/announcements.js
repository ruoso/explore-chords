/**
 * Things the app tells the user unprompted: the tutorial, and what changed.
 *
 * One list, in order. The tutorial is shown the first time the app proper is
 * opened; a release note is shown once, on the first open after it appears
 * here. Adding an entry is the whole release process — give it the version
 * from package.json as its id, and write its text under `announcements.<id>`
 * in every language (src/i18n/locales), where the unit tests will notice if
 * one is missing.
 *
 * Content is structured rather than HTML, so it renders through the same
 * element helper as everything else and cannot smuggle in markup.
 */

import { tr } from '../i18n/index.js';

export const ANNOUNCEMENTS = [
  { id: 'welcome', kind: 'tutorial' },
  { id: '0.2.0', kind: 'release' },
  { id: '0.3.0', kind: 'release' },
  { id: '0.4.0', kind: 'release' },
  { id: '0.5.0', kind: 'release' },
  { id: '0.6.0', kind: 'release' },
  { id: '0.7.0', kind: 'release' },
  { id: '0.8.0', kind: 'release' },
  { id: '0.9.0', kind: 'release' },
];

/**
 * An announcement with its title and sections, in the current language.
 * @returns {{ id: string, kind: string, title: string, sections: {heading:string, text:string}[] }}
 */
export function withContent(announcement) {
  const content = tr(['announcements', announcement.id]) ?? {};
  return {
    ...announcement,
    title: content.title ?? announcement.id,
    sections: content.sections ?? [],
  };
}
