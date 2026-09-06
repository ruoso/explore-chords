/**
 * The printable song sheet (docs/DESIGN.md §2.5).
 *
 * A diagram legend at the top — each distinct chord and fingering once — then
 * the progressions per section. Rendered into a container that is hidden on
 * screen and shown when printing, so the print layout is part of the app rather
 * than a separate page that can silently rot.
 */

import { el, clear } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import { fingeringFromFrets } from '../core/search.js';
import { renderDiagram } from '../render/index.js';
import { sheetLegend } from '../state/sheets.js';

export function renderSheetPrint(container, { store, sheet, instrument }) {
  clear(container);
  if (!sheet || !instrument) return;

  const dialect = store.state.prefs.dialect;

  const article = el('article', { class: 'ec-print' });
  article.append(
    el('h1', { class: 'ec-print-title' }, sheet.title),
    el('p', { class: 'ec-print-instrument' }, instrument.label)
  );

  // --- legend -------------------------------------------------------------

  const legend = sheetLegend(sheet);
  if (legend.length > 0) {
    const list = el('ul', { class: 'ec-print-legend', 'aria-label': 'Chord shapes used' });
    for (const entry of legend) {
      const parsed = parseChord(entry.chordText, dialect);
      if (!parsed.chord) continue;
      const fingering = fingeringFromFrets(entry.frets, parsed.chord, instrument);
      if (!fingering) continue;
      list.append(
        el(
          'li',
          { class: 'ec-print-chord' },
          el('p', { class: 'ec-print-chord-name' }, entry.chordText),
          el('div', {
            html: renderDiagram(
              fingering,
              { chord: parsed.chord, dialect, instrument },
              { orientation: 'vertical', handed: store.state.prefs.handed }
            ),
          })
        )
      );
    }
    article.append(list);
  }

  // --- progressions -------------------------------------------------------

  for (const section of sheet.sections) {
    if (section.slots.length === 0) continue;
    article.append(
      el(
        'section',
        { class: 'ec-print-section' },
        el('h2', { class: 'ec-print-section-name' }, section.name),
        el(
          'p',
          { class: 'ec-print-progression' },
          section.slots.map((slot) => slot.chordText).join('  ·  ')
        )
      )
    );
  }

  container.append(article);
  return article;
}
