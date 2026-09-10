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
import { renderDiagram } from '../render/index.js';
import { t } from '../i18n/index.js';

/**
 * Diagrams in the legend are looked up, not read along with, so they are drawn
 * smaller than on screen: a full song's shapes should fit on one row or two.
 */
const PRINT_DIAGRAM_SIZE = 0.7;

export function renderSheetPrint(container, { store, sheet, instrument }) {
  clear(container);
  if (!sheet || !instrument) return;

  const dialect = store.state.prefs.dialect;
  const song = parseSong(sheet.body, dialect);

  const article = el('article', { class: 'ec-print' });
  article.append(
    el('h1', { class: 'ec-print-title' }, sheet.title),
    el('p', { class: 'ec-print-instrument' }, instrument.label)
  );

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
                segment.chord || chorded
                  ? el(
                      'span',
                      { class: `ec-print-segment-chord${segment.chord ? '' : ' is-blank'}` },
                      segment.chord ? segment.chord.raw : '\u00a0'
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
              segment.chord ? segment.chord.raw : ''
            )
          );
        });
      }
      table.body.append(line);
    }
    closeTable();
    article.append(block);
  }

  const resolved = resolveSongVoicings(song, instrument, dialect);
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
      list.append(
        el(
          'li',
          { class: 'ec-print-chord' },
          el('p', { class: 'ec-print-chord-name' }, entry.key),
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
    article.append(list);
  }

  container.append(article);
  return article;
}
