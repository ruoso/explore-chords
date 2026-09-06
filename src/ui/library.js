/**
 * The library of saved shapes (docs/DESIGN.md §2.6, §8.3).
 *
 * Favourites are tagged by instrument and filtered to the active one by
 * default, because a guitar shape means nothing on a ukulele.
 *
 * A saved shape stores its chord and fret pattern, never a rendered snapshot:
 * the fingering is rebuilt on display, so a starred shape cannot drift out of
 * date when finger assignment or scoring changes.
 */

import { el, clear } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import { fingeringFromFrets } from '../core/search.js';
import { renderDiagram } from '../render/index.js';
import { DIFFICULTY_LABELS } from '../core/score.js';

export function renderLibrary(container, { store, onOpen, onRemove }) {
  clear(container);
  const instrument = store.effectiveInstrument;
  if (!instrument) return;

  const saved = store.favoritesFor(instrument.id);

  const panel = el('details', { class: 'ec-library', id: 'library' });
  panel.append(
    el(
      'summary',
      { class: 'ec-library-summary', id: 'library-toggle' },
      'Saved shapes',
      el('span', { class: 'ec-library-count' }, String(saved.length))
    )
  );

  const body = el('div', { class: 'ec-library-body' });

  if (saved.length === 0) {
    body.append(
      el(
        'p',
        { class: 'ec-help' },
        `Nothing saved for ${instrument.label} yet. Star a shape to keep it here.`
      )
    );
  } else {
    const list = el('ul', {
      class: 'ec-grid',
      tabindex: '0',
      'aria-label': `Saved shapes for ${instrument.label}`,
    });

    for (const entry of saved) {
      const parsed = parseChord(entry.chordText, store.state.prefs.dialect);
      if (!parsed.chord) continue;
      const fingering = fingeringFromFrets(entry.frets, parsed.chord, instrument);
      if (!fingering) continue;

      list.append(
        el(
          'li',
          { class: 'ec-card' },
          el('p', { class: 'ec-card-chord' }, entry.chordText),
          el('div', {
            class: 'ec-card-diagram',
            html: renderDiagram(
              fingering,
              { chord: parsed.chord, dialect: store.state.prefs.dialect, instrument },
              {
                orientation: store.state.prefs.orientation,
                handed: store.state.prefs.handed,
              }
            ),
          }),
          el(
            'p',
            { class: 'ec-caption' },
            el('span', { class: 'ec-shorthand' }, fingering.shorthand),
            el(
              'span',
              { class: `ec-badge ec-badge-${fingering.difficulty}` },
              DIFFICULTY_LABELS[fingering.difficulty]
            )
          ),
          el(
            'div',
            { class: 'ec-card-actions' },
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                onClick: () => onOpen(entry),
              },
              'Open'
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                'aria-label': `Remove ${entry.chordText} ${fingering.shorthand} from your library`,
                onClick: () => onRemove(entry),
              },
              'Remove'
            )
          )
        )
      );
    }

    body.append(list);
  }

  panel.append(body);
  container.append(panel);
  return panel;
}
