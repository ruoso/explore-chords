/**
 * Saved shapes (docs/DESIGN.md §2.6, §8.3).
 *
 * Its own screen rather than a panel on the chord view, which was becoming a
 * stack of drawers. Favourites are tagged by instrument and shown for the
 * active one, because a guitar shape means nothing on a ukulele.
 *
 * A saved shape stores its chord and fret pattern, never a rendered snapshot:
 * the fingering is rebuilt on display, so it cannot drift out of date when
 * finger assignment or scoring changes.
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
  const page = el('div', { class: 'ec-page' });
  page.append(el('h2', { class: 'ec-page-title' }, 'Saved shapes'));

  if (saved.length === 0) {
    page.append(
      el(
        'p',
        { class: 'ec-empty' },
        `Nothing saved for ${instrument.label} yet. Star a shape on the chords screen to keep it here.`
      )
    );
    container.append(page);
    return page;
  }

  page.append(
    el('p', { class: 'ec-help' }, `${saved.length} saved for ${instrument.label}.`)
  );

  const list = el('ul', {
    class: 'ec-grid',
    tabindex: '0',
    'aria-label': `Saved shapes for ${instrument.label}`,
  });

  for (const entry of saved) {
    const chord = parseChord(entry.chordText, store.state.prefs.dialect).chord;
    if (!chord) continue;
    const fingering = fingeringFromFrets(entry.frets, chord, instrument);
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
            { chord, dialect: store.state.prefs.dialect, instrument },
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
              'aria-label': `Show ${entry.chordText} on the chords screen`,
              onClick: () => onOpen(entry),
            },
            'Open'
          ),
          el(
            'button',
            {
              type: 'button',
              class: 'ec-button ec-button-small',
              'aria-label': `Remove ${entry.chordText} ${fingering.shorthand} from your saved shapes`,
              onClick: () => onRemove(entry),
            },
            'Remove'
          )
        )
      )
    );
  }

  page.append(list);
  container.append(page);
  return page;
}
