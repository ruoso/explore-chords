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
import { renderDiagram, voicedAsLabel } from '../render/index.js';
import { renderFingeringGroups } from './fingering-groups.js';
import { t } from '../i18n/index.js';

export function renderResults(
  container,
  { store, results, chord, instrument, onShowMore, onToggleFavorite, onOpenRules }
) {
  clear(container);

  if (!chord) {
    container.append(
      el('p', { class: 'ec-empty' }, t('results.empty'))
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
        el('p', {}, t('results.none', { label: instrument.label })),
        el(
          'p',
          { class: 'ec-help' },
          t('results.noneHelp')
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            id: 'empty-open-rules',
            onClick: () => onOpenRules?.(),
          },
          t('results.adjustRules')
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
      // Every card here is the same chord, so only the bass is worth saying:
      // it is what tells these shapes apart (§6.2).
      const sounded = voicedAsLabel(fingering, { chord, dialect: prefs.dialect, full: false });

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
          sounded ? el('span', { class: 'ec-voiced-as' }, sounded) : null,
          el(
            'span',
            { class: `ec-badge ec-badge-${fingering.difficulty}` },
            t(`difficulty.${fingering.difficulty}`)
          )
        ),
        el(
          'button',
          {
            type: 'button',
            class: `ec-star${starred ? ' is-on' : ''}`,
            'aria-pressed': starred ? 'true' : 'false',
            'aria-label': t(starred ? 'results.removeLabel' : 'results.saveLabel', {
              shorthand: fingering.shorthand,
            }),
            onClick: () => onToggleFavorite?.(fingering),
          },
          el('span', { 'aria-hidden': 'true' }, starred ? '\u2605' : '\u2606'),
          t(starred ? 'results.saved' : 'results.save')
        )
      );
    },
  });
}
