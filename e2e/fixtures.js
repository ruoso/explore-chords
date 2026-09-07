import { test as base, expect } from '@playwright/test';

/**
 * Shared test fixtures.
 *
 * Every spec takes `test` from here rather than from Playwright directly, so
 * checks that should hold on every screen run without each spec asking.
 *
 * The one check so far: no unexpected scrollbars. A scroll container appears
 * whenever content pokes outside a box that has overflow set — a negative
 * margin inside a sideways-scrolling section, say — and it is the kind of
 * regression nobody notices until it ships, because nothing is *wrong*, it
 * just looks broken. So at the end of every test, whatever screen it left
 * open is scanned for elements that scroll on an axis they were not meant to.
 */

/**
 * Where scrolling is intended, by axis. Anything else that actually scrolls —
 * scroll size beyond client size with overflow auto or scroll — is a bug.
 * The document itself may scroll down, never sideways.
 */
const INTENDED = [
  { selector: 'textarea', axes: ['y'] },
  { selector: '.ec-grid', axes: ['x'] },
  { selector: '.ec-nav-list', axes: ['x'] },
  { selector: '.ec-song-section', axes: ['x'] },
  { selector: '.ec-dialog', axes: ['y'] },
];

/** Every element scrolling on an axis it was not meant to, described. */
export async function unexpectedScrollbars(page) {
  return page.evaluate((intended) => {
    const describe = (el) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    const scrolls = (overflow) => overflow === 'auto' || overflow === 'scroll';
    const out = [];

    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) {
      out.push(`document scrolls sideways (${root.scrollWidth} > ${root.clientWidth})`);
    }

    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[hidden]') || el.closest('.ec-print-root')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      // A dialog that is not open is not rendered.
      if (el.closest('dialog:not([open])')) continue;

      const allowed = intended.filter((i) => el.matches(i.selector)).flatMap((i) => i.axes);
      const x = scrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      const y = scrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      if (x && !allowed.includes('x')) {
        out.push(`${describe(el)} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
      }
      if (y && !allowed.includes('y')) {
        out.push(`${describe(el)} scrolls vertically (${el.scrollHeight} > ${el.clientHeight})`);
      }
    }
    return out;
  }, INTENDED);
}

/** Assert the screen as it stands has no scrollbar it was not meant to. */
export async function expectNoUnexpectedScrollbars(page) {
  expect(await unexpectedScrollbars(page), 'unexpected scrollbars').toEqual([]);
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await use(page);
    // After the test, on whatever it left on screen. Skipped if the page is
    // already gone, since a closed page is not a layout bug.
    if (page.isClosed()) return;
    try {
      await expectNoUnexpectedScrollbars(page);
    } catch (error) {
      if (error?.matcherResult) throw error; // the assertion itself: a real finding
      // Anything else — navigation mid-check, a torn-down context — is not ours.
    }
  },
});

export { expect };
