/**
 * The reading view: a song laid out on pages (docs/DESIGN.md §2.6).
 *
 * The printed sheet is drawn by ui/sheet-print.js, and this puts that same
 * sheet onto pages the size of the screen, so what you read is what will come
 * out of the printer — including where it runs out of page.
 *
 * The browser will fragment content into columns, but it will not tell you what
 * did not fit, and there is no way to flow one element's overflow into another.
 * So the pages are filled by hand: put a line on the page, ask the page whether
 * it still fits, and if it does not, take the line back and start a new page.
 * The browser is still doing the layout *within* a page — the columns, the
 * spanning charts — which is what keeps this a preview of print rather than a
 * second opinion about it.
 */

import { el, clear } from './dom.js';
import { renderSheetPrint } from './sheet-print.js';
import { t } from '../i18n/index.js';

/** A page shorter than this is more page furniture than song. */
const MIN_PAGE_HEIGHT = 420;
/** Room left below a page, so the next one shows that it is there. */
const PAGE_GAP = 10;
/** Wait for a drag to stop before laying the song out again. */
const RESIZE_SETTLE = 150;
/**
 * How much shorter the window has to get before it counts as a resize.
 *
 * A phone hides its address bar as you scroll, which fires a resize and takes
 * a tenth off the height. Laying the song out again for that would move the
 * page out from under whoever is reading it, mid-scroll.
 */
const RESIZE_SLACK = 0.25;

/**
 * @param {HTMLElement} container
 * @param {{store: object, sheet: object, instrument: object}} options
 * @returns {number} how many pages the song came to
 */
export function renderSongPages(container, { store, sheet, instrument, startAt = 0 }) {
  clear(container);
  const pages = el('div', { class: 'ec-song-pages' });
  container.append(pages);

  // Drawn once, in the document, so the sheet can measure itself: the column
  // width comes from the song's own longest line (sheet-print.js).
  const stage = el('div', { class: 'ec-song-stage' });
  pages.append(stage);
  // No cap on the columns: a page here is as wide as the screen, and on screen
  // there is no page to turn, so the width is worth using (sheet-print.js).
  const article = renderSheetPrint(stage, { store, sheet, instrument, maxColumns: null });
  if (!article) return 0;

  const source = article.querySelector('.ec-print-body');
  const columnWidth = source?.style.columnWidth ?? '';
  const columnCount = source?.style.columnCount ?? '';

  // Everything the sheet is made of, in reading order: the heading of a section
  // and then its lines, one at a time, because a verse has to be able to carry
  // on over the fold.
  const items = [];
  for (const section of article.querySelectorAll('.ec-print-section')) {
    for (const node of [...section.children]) items.push({ section, node });
  }
  const legend = article.querySelector('.ec-print-legend');
  if (legend) items.push({ section: null, node: legend });

  // What is left of the sheet once the flowing part is taken out: the title and
  // the instrument it is written for.
  const header = [...article.children].filter((node) => node !== source);

  const geometry = pageGeometry(pages);
  let page = null;
  let body = null;
  let wrapper = null;
  let wrapperFor = null;
  let placed = 0;

  const startPage = () => {
    page = el('div', { class: 'ec-song-page' });
    page.style.width = `${geometry.width}px`;
    page.style.height = `${geometry.height}px`;
    // The first page carries the title, exactly as the printed one does.
    if (pages.querySelectorAll('.ec-song-page').length === 0) page.append(...header);
    body = el('div', { class: 'ec-print-body' });
    body.style.columnWidth = columnWidth;
    body.style.columnCount = columnCount;
    page.append(body);
    pages.append(page);
    wrapper = null;
    wrapperFor = null;
    placed = 0;
  };

  // Two ways to run out of page, depending on how many columns fit. Where
  // there are several, what does not fit becomes another column and the page
  // grows sideways; where there is only one, it simply overflows the bottom.
  const overflows = () =>
    body.scrollWidth > body.clientWidth + 1 || body.scrollHeight > body.clientHeight + 1;

  const place = ({ section, node }) => {
    if (section !== wrapperFor || !wrapper) {
      wrapper = section ? el('div', { class: section.className }) : body;
      wrapperFor = section;
      if (wrapper !== body) body.append(wrapper);
    }
    wrapper.append(node);
  };

  startPage();
  for (const item of items) {
    place(item);
    if (!overflows()) {
      placed += 1;
      continue;
    }
    // It did not fit. A page with nothing else on it has to keep it anyway,
    // or a line taller than a page would go round for ever.
    if (placed === 0) {
      placed += 1;
      continue;
    }
    item.node.remove();
    if (wrapper !== body && wrapper.children.length === 0) wrapper.remove();
    startPage();
    place(item);
    placed = 1;
  }

  stage.remove();
  const sheets = [...pages.querySelectorAll('.ec-song-page')];
  renderPager(container, sheets);
  // Laid out again after a resize: stay on the page that was being read.
  if (startAt > 0) turnToPage(sheets, startAt, false);
  watchResize(container, { store, sheet, instrument }, geometry, sheets);
  return sheets.length;
}

/**
 * A page is the screen: all the width there is, and as tall as the window.
 *
 * Not the shape of A4, deliberately. What is worth seeing here is *that* the
 * song runs past the end of a page and where it breaks when it does, and a
 * screen-shaped page shows that while using the whole screen to do it. A
 * paper-shaped one would leave a third of a wide window empty for the sake of
 * a proportion nobody is holding up to it.
 */
function pageGeometry(within) {
  const width = Math.round(within.getBoundingClientRect().width || window.innerWidth);
  // The window, less a sliver so the next page shows its edge. Nothing is
  // pinned over the top of it: the header scrolls away with everything else,
  // so a page turned to has the whole window.
  const height = Math.max(MIN_PAGE_HEIGHT, window.innerHeight - PAGE_GAP);
  return { width, height };
}

/** The page being read: the one whose top is nearest the top of the window. */
function pageInView(sheets) {
  let best = 0;
  let closest = Infinity;
  sheets.forEach((sheet, i) => {
    const distance = Math.abs(sheet.getBoundingClientRect().top);
    if (distance < closest) {
      closest = distance;
      best = i;
    }
  });
  return best;
}

/** Put one page in the clear, at the top of the window. */
function turnToPage(sheets, index, animate) {
  const sheet = sheets[Math.max(0, Math.min(sheets.length - 1, index))];
  if (!sheet) return;
  const top = sheet.getBoundingClientRect().top + window.scrollY;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  window.scrollTo({ top, behavior: animate && !still ? 'smooth' : 'auto' });
}

/**
 * Lay the song out again when the window changes size, since a page *is* the
 * window and how much of the song fits on one follows from that.
 *
 * Only for a change worth the trouble: a different width, or a good deal less
 * height. See RESIZE_SLACK. The listener replaces itself on every layout, so
 * there is never more than one, and it goes away with the page it belongs to.
 */
function watchResize(container, options, geometry, sheets) {
  let timer = null;
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      window.removeEventListener('resize', onResize);
      if (!container.isConnected) return;
      const next = pageGeometry(container);
      const changed =
        next.width !== geometry.width ||
        Math.abs(next.height - geometry.height) > geometry.height * RESIZE_SLACK;
      if (!changed) {
        window.addEventListener('resize', onResize);
        return;
      }
      renderSongPages(container, { ...options, startAt: pageInView(sheets) });
    }, RESIZE_SETTLE);
  };
  window.addEventListener('resize', onResize);
}

/**
 * Up and down, over the song.
 *
 * Playing from a screen is not reading a web page: you want the next page, not
 * fourteen lines further down, and you want it without hunting for where you
 * were. So the arrows put a whole page in the clear, and say which one of how
 * many you are on.
 *
 * The scroll listener takes itself off once the pages it belongs to are gone,
 * which is what stands in for a teardown hook: every screen here is drawn by
 * throwing the last one away.
 */
function renderPager(container, sheets) {
  if (sheets.length < 2) return;

  // The middle of the pager puts the page you are on back where it belongs,
  // for when a scroll has left it halfway up the window.
  const count = el('button', {
    type: 'button',
    class: 'ec-pager-count',
    'aria-label': t('editor.snapPage'),
  });
  const up = el(
    'button',
    { type: 'button', class: 'ec-pager-button', 'aria-label': t('editor.previousPage') },
    '↑'
  );
  const down = el(
    'button',
    { type: 'button', class: 'ec-pager-button', 'aria-label': t('editor.nextPage') },
    '↓'
  );
  const pager = el('div', { class: 'ec-pager', role: 'group' }, up, count, down);

  const current = () => pageInView(sheets);

  const show = () => {
    const at = current();
    count.textContent = `${at + 1}/${sheets.length}`;
    pager.setAttribute('aria-label', t('editor.pageOf', { current: at + 1, total: sheets.length }));
    up.disabled = at === 0;
    down.disabled = at === sheets.length - 1;
  };

  count.addEventListener('click', () => turnToPage(sheets, current(), true));
  up.addEventListener('click', () => turnToPage(sheets, current() - 1, true));
  down.addEventListener('click', () => turnToPage(sheets, current() + 1, true));

  const onScroll = () => {
    if (!sheets[0].isConnected) {
      window.removeEventListener('scroll', onScroll);
      return;
    }
    show();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  show();
  container.append(pager);
}
