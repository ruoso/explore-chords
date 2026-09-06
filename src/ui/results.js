/**
 * The result grid (docs/DESIGN.md §2.3).
 *
 * Ranked by difficulty, grouped by position, open first. Each group is a
 * horizontally scrollable row on a phone and a wrapped grid on a wider screen.
 *
 * The grouping itself lives in fingering-groups.js, shared with the song's
 * voicing picker so the same search reads the same way wherever you meet it.
 *
 * The scroll containers are the accessibility risk here: a row that can only be
 * reached with a mouse or a swipe is unusable by keyboard, so each is focusable
 * and every card is in the tab order (§6.1).
 */

import { el, clear } from './dom.js';
import { renderDiagram } from '../render/index.js';
import { DIFFICULTY_LABELS } from '../core/score.js';
import { renderFingeringGroups } from './fingering-groups.js';

export function renderResults(
  container,
  { store, results, chord, instrument, onShowMore, onToggleFavorite, onOpenRules }
) {
  clear(container);

  if (!chord) {
    container.append(
      el('p', { class: 'ec-empty' }, 'Enter a chord to see how it can be played.')
    );
    return;
  }

  if (!results || results.count === 0) {
    // Plainly empty, never an approximation dressed up as the chord asked for
    // (§2.3). Auto-relaxing the rules is a deferred question (§11).
    container.append(
      el(
        'div',
        { class: 'ec-empty' },
        el('p', {}, `No fingerings for this chord on ${instrument.label}.`),
        el(
          'p',
          { class: 'ec-help' },
          'It may need more strings than this instrument has, or your voicing rules may be too strict.'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            id: 'empty-open-rules',
            onClick: () => onOpenRules?.(),
          },
          'Adjust voicing rules'
        )
      )
    );
    return;
  }

  const { prefs } = store.state;

  renderFingeringGroups(container, {
    groups: results.groups,
    expanded: store.state.expandedGroups ?? {},
    onToggleGroup: onShowMore,
    renderItem: (fingering) => {
      const starred = store.isFavorite({
        instrumentId: instrument.id,
        chordText: store.state.chordText,
        frets: fingering.frets,
      });

      return el(
        'li',
        { class: 'ec-card' },
        el('div', {
          class: 'ec-card-diagram',
          html: renderDiagram(
            fingering,
            { chord, dialect: prefs.dialect, instrument },
            { orientation: prefs.orientation, handed: prefs.handed }
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
          'button',
          {
            type: 'button',
            class: `ec-star${starred ? ' is-on' : ''}`,
            'aria-pressed': starred ? 'true' : 'false',
            'aria-label': `${starred ? 'Remove' : 'Save'} ${fingering.shorthand} ${
              starred ? 'from' : 'to'
            } your library`,
            onClick: () => onToggleFavorite?.(fingering),
          },
          el('span', { 'aria-hidden': 'true' }, starred ? '\u2605' : '\u2606'),
          starred ? ' Saved' : ' Save'
        )
      );
    },
  });
}
