/**
 * The printable song sheet (docs/DESIGN.md §2.5).
 *
 * The chart first, then a diagram legend — each voicing the song uses, once,
 * labelled the way the chart refers to it. The chart leads because it is what
 * gets read while playing; the shapes are looked up. Defaults print like any
 * other shape: on paper a student needs the shape, not its provenance.
 * Rendered into a container that is hidden on screen and shown when printing,
 * so the print layout is part of the app rather than a separate page that can
 * silently rot.
 */

import { el, clear } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import { parseSong, compareVoicings } from '../core/song.js';
import { layoutSection } from '../core/chart-layout.js';
import { resolveSongVoicings } from '../core/voicings.js';
import {
  renderDiagram,
  voicedAsLabel,
  voicedAsSymbol,
  neckInset,
  boxWidth,
} from '../render/index.js';
import { t } from '../i18n/index.js';

/**
 * Diagrams in the legend are looked up rather than read along with, so they are
 * drawn smaller than the chart — but not so small that the dots crowd. Printed
 * at 0.7 they came out under two centimetres across, which is a shape you have
 * to lean in to read on a music stand.
 */
const PRINT_DIAGRAM_SIZE = 1;

/**
 * Columns a printed sheet may be broken into, at most.
 *
 * On paper, reading down one column and back up the next is work, and doing it
 * three times across a page is worse than turning to a second sheet. On screen
 * there is no page to turn, so the reading view lifts the cap and takes as many
 * columns as the width allows — `maxColumns: null`.
 */
const MAX_PRINT_COLUMNS = 2;

/**
 * Give the sheet as many columns as the page can hold.
 *
 * A song with its words is narrow and tall — a sung line is about a third of
 * the width of A4 and there are as many of them as the song has lines — so a
 * single column wastes most of the paper and spends pages doing it. Two columns
 * routinely turn two pages into one.
 *
 * How many fit is not ours to decide: the paper size and the margins are chosen
 * in the print dialog, and the app never learns them. What the app *can* measure
 * is how narrow a column the song could live in. So it measures that and sets
 * `column-width`, and the browser fits as many as the real page allows, down to
 * one when the song needs it.
 *
 * The measure is the longest line anyone sings, so no sung line wraps. Chart
 * lines are left out of it: their measures sit in a grid and cannot wrap, and
 * one four-chord intro is easily wider than a verse — enough to force a single
 * column and cost a page for the sake of one row. Those sections span every
 * column instead, the way a wide figure does in a magazine.
 */
function fitColumns(container, body, maxColumns) {
  const inline = container.getAttribute('style');
  // Laid out off-screen and unbounded, so every line can report the width it
  // would rather have. Hidden rather than removed: it still has to have
  // geometry to be measured.
  container.setAttribute(
    'style',
    'display:block;position:absolute;visibility:hidden;left:-99999px;top:0;width:99999px'
  );

  const naturalWidth = (node) => {
    const before = node.style.width;
    node.style.width = 'max-content';
    const width = node.getBoundingClientRect().width;
    node.style.width = before;
    return width;
  };
  const widest = (nodes) => (nodes.length === 0 ? 0 : Math.max(...nodes.map(naturalWidth)));

  const sung = [...body.querySelectorAll('.ec-print-sung')];
  const charts = [...body.querySelectorAll('.ec-print-chart')];
  const column = sung.length > 0 ? widest(sung) : widest(charts);
  const spanning = new Set();
  if (column > 0) {
    for (const chart of charts) {
      if (naturalWidth(chart) > column) spanning.add(chart);
    }
  }

  if (inline === null) container.removeAttribute('style');
  else container.setAttribute('style', inline);

  if (!(column > 0)) return;
  body.style.columnWidth = `${Math.ceil(column)}px`;
  if (maxColumns !== null) body.style.columnCount = String(maxColumns);
  for (const section of spanning) section.classList.add('is-full-width');
}

export function renderSheetPrint(container, { store, sheet, instrument, maxColumns }) {
  clear(container);
  if (!sheet || !instrument) return;

  const dialect = store.state.prefs.dialect;
  const song = parseSong(sheet.body, dialect);

  const article = el('article', { class: 'ec-print' });
  article.append(
    el('h1', { class: 'ec-print-title' }, sheet.title),
    el('p', { class: 'ec-print-instrument' }, instrument.label)
  );

  // The sections go in a box of their own, because that box is what gets broken
  // into columns. The title stays outside it: a spanning element at the very
  // start of a multicol pushed everything after it to the next page, leaving a
  // first page with nothing on it but the title.
  const body = el('div', { class: 'ec-print-body' });
  article.append(body);

  const resolved = resolveSongVoicings(song, instrument, dialect);

  /**
   * What each chord reads as, where the shape sounds something else.
   *
   * Empty unless the option is on. The chart names the harmony, which is what a
   * chart is for; with the option on it names what the chosen shapes actually
   * sound, so a player reading the sheet sees the chord under their fingers
   * (§6.2). Only the chords where the two differ are in here — elsewhere there
   * is nothing to say.
   *
   * The legend reads from the same map, so the two agree: when the chart has
   * been renamed, that name is the shape's only name and there is no second one
   * beside it to reconcile.
   */
  const soundedNames = new Map();
  if (store.state.prefs.chartVoicedAs) {
    for (const [key, entry] of resolved) {
      const occurrence = song.occurrences.find((c) => c.key === key);
      const chord = parseChord(occurrence.symbol, dialect).chord;
      if (!chord) continue;
      const symbol = voicedAsSymbol(entry.fingering, {
        chord,
        dialect,
        name: occurrence.symbol,
      });
      if (symbol) soundedNames.set(key, symbol);
    }
  }
  const renamed = store.state.prefs.chartVoicedAs;
  const chartName = (segment) => soundedNames.get(segment.chord.key) ?? segment.chord.raw;

  for (const section of song.sections) {
    const block = el('section', { class: 'ec-print-section' });
    if (section.name) block.append(el('h2', { class: 'ec-print-section-name' }, section.name));
    // A table per section: measures line up in columns, as on a written chart,
    // and a measure with several chords splits its column between them.
    // The same segments the screen draws, so words come with them: a sheet is
    // played from, and a verse without its words is not much use on a stand.
    let table = null;
    const closeTable = () => {
      if (table) block.append(table.el);
      table = null;
    };

    for (const row of layoutSection(section)) {
      if (row.lyrics) {
        closeTable();
        if (row.blank) {
          block.append(el('div', { class: 'ec-print-break' }));
          continue;
        }
        const line = el('div', { class: 'ec-print-sung' });
        // An empty chord where a segment has none, so words before the first
        // chord stay on the same row as the rest of the line they are sung on.
        const chorded = row.measures.some((cells) => cells.some((c) => c.segment.chord));
        for (const cells of row.measures) {
          cells.forEach(({ segment }, j) => {
            line.append(
              el(
                'span',
                { class: `ec-print-segment${j === 0 ? ' is-measure-start' : ''}` },
                segment.chord || segment.mark || chorded
                  ? el(
                      'span',
                      {
                        class: `ec-print-segment-chord${
                          segment.chord || segment.mark ? '' : ' is-blank'
                        }`,
                      },
                      segment.chord ? chartName(segment) : segment.mark || '\u00a0'
                    )
                  : null,
                el('span', { class: 'ec-print-segment-words' }, segment.lyric)
              )
            );
          });
        }
        block.append(line);
        continue;
      }

      if (!table) {
        const node = el('table', { class: 'ec-print-chart', role: 'presentation' });
        const body = el('tbody');
        node.append(body);
        table = { el: node, body };
      }
      const line = el('tr', { class: 'ec-print-line' });
      for (const cells of row.measures) {
        cells.forEach(({ segment, span }, j) => {
          line.append(
            el(
              'td',
              {
                class: `ec-print-cell${j === 0 ? ' is-measure-start' : ''}`,
                colspan: span > 1 ? String(span) : null,
              },
              segment.chord ? chartName(segment) : segment.mark
            )
          );
        });
      }
      table.body.append(line);
    }
    closeTable();
    body.append(block);
  }

  const legend = [...resolved.entries()]
    .map(([key, r]) => {
      const occurrence = song.occurrences.find((c) => c.key === key);
      return { key, symbol: occurrence.symbol, index: occurrence.index, fingering: r.fingering };
    })
    .sort(compareVoicings);

  if (legend.length > 0) {
    const list = el('ul', { class: 'ec-print-legend', 'aria-label': t('print.legend') });
    for (const entry of legend) {
      const chord = parseChord(entry.symbol, dialect).chord;
      if (!chord) continue;
      const { fingering } = entry;
      // Normally the chart's name with the sounded one beside it, so the two
      // can be compared (§6.2). Once the chart itself has been renamed there is
      // nothing to compare: the sounded name is the name, and repeating it in
      // the margin would say the same thing twice.
      const name = renamed ? (soundedNames.get(entry.key) ?? entry.key) : entry.key;
      const sounded = renamed
        ? null
        : voicedAsLabel(fingering, { chord, dialect, full: true, name: entry.symbol });
      list.append(
        el(
          'li',
          {
            class: 'ec-print-chord',
            // The diagram's width, so a name and its label wrap to a second
            // line rather than stretching the cell (§6.2).
            style:
              `--ec-box-width: ${boxWidth(fingering.frets.length, PRINT_DIAGRAM_SIZE)}px;` +
              `--ec-neck-inset: ${neckInset(PRINT_DIAGRAM_SIZE)}px`,
          },
          el(
            'p',
            { class: 'ec-print-chord-name' },
            el('span', {}, name),
            sounded ? el('span', { class: 'ec-voiced-as' }, sounded) : null
          ),
          el('div', {
            html: renderDiagram(
              fingering,
              { chord, dialect, instrument },
              {
                orientation: 'vertical',
                handed: store.state.prefs.handed,
                size: PRINT_DIAGRAM_SIZE,
              }
            ),
          })
        )
      );
    }
    // In with the sections, at the end of the flow, rather than under the whole
    // sheet. A legend of its own outside the columns is a block the page has to
    // find room for after they have taken what they want, and a filled column
    // wants the whole page — so the shapes went overleaf on their own, a sheet
    // of paper for four diagrams. In the flow they take the room the last
    // column has left, which is usually exactly where they were anyway.
    body.append(list);
  }

  container.append(article);
  fitColumns(container, body, maxColumns === undefined ? MAX_PRINT_COLUMNS : maxColumns);
  return article;
}
