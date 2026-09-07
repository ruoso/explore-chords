/**
 * Choose how one chord is played in a song sheet.
 *
 * A modal listing the fingerings the search found for that chord on the song's
 * instrument, so a teacher picks the shape they want taught rather than
 * accepting whichever the ranking put first.
 *
 * Grouped and ordered exactly as the chord explorer shows them — open position
 * first, then up the neck, easiest first within each — because a shape a user
 * has already found there should be in the same place here.
 *
 * Uses a native <dialog>, which brings focus trapping, Escape to close and
 * inert background for free — all of which are easy to get wrong by hand.
 */

import { el, clear } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import { searchFingerings } from '../core/search.js';
import { renderDiagram } from '../render/index.js';
import { t, errorText } from '../i18n/index.js';
import { renderFingeringGroups } from './fingering-groups.js';

export function openVoicingDialog({
  store,
  chordText,
  instrument,
  chosen,
  // What the chart is actually showing, which may be a default rather than
  // a choice. The picker highlights this so it opens on the shape in effect.
  current = chosen,
  onChoose,
  scope = 'occurrence',
  usedIn = 1,
  label,
}) {
  const existing = document.querySelector('#voicing-dialog');
  if (existing) existing.remove();

  const dialog = el('dialog', { class: 'ec-dialog', id: 'voicing-dialog' });
  const dialect = store.state.prefs.dialect;
  const parsed = parseChord(chordText, dialect);

  const everywhere = scope === 'all';
  const heading = el(
    'h2',
    { class: 'ec-dialog-title', id: 'voicing-dialog-title' },
    everywhere
      ? t('picker.changeEverywhere', { label: label ?? chordText })
      : t('picker.howPlayed', { chord: chordText })
  );
  dialog.setAttribute('aria-labelledby', 'voicing-dialog-title');

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const body = el('div', { class: 'ec-dialog-body' });

  if (!parsed.chord) {
    body.append(
      el('p', { class: 'ec-error' }, parsed.errors[0] ? errorText(parsed.errors[0]) : t('picker.noParse'))
    );
  } else {
    const results = searchFingerings(parsed.chord, instrument);

    if (results.count === 0) {
      body.append(
        el(
          'p',
          { class: 'ec-help' },
          t('picker.none', { chord: chordText, label: instrument.label })
        )
      );
    } else {
      body.append(
        el(
          'p',
          { class: 'ec-help' },
          (everywhere ? t('picker.replaces', { count: usedIn }) : t('picker.changesOne')) +
            t('picker.ways', { count: results.count })
        )
      );

      const grid = el('div', { class: 'ec-dialog-groups' });
      // Expansion is local to the dialog: which groups you opened while picking
      // a voicing is not app state worth keeping.
      const expanded = {};

      const draw = () => {
        clear(grid);
        renderFingeringGroups(grid, {
          groups: results.groups,
          expanded,
          idPrefix: 'voicing-group',
          onToggleGroup: (position) => {
            expanded[position] = !expanded[position];
            draw();
          },
          renderItem: (fingering) => {
            const isChosen =
              Array.isArray(current) && current.join(',') === fingering.frets.join(',');
            return el(
              'li',
              {},
              el(
                'button',
                {
                  type: 'button',
                  class: `ec-dialog-choice${isChosen ? ' is-chosen' : ''}`,
                  'aria-pressed': isChosen ? 'true' : 'false',
                  'aria-label': `${fingering.shorthand}, ${t(
                    `difficulty.${fingering.difficulty}`
                  )}${isChosen ? t('picker.chosen') : ''}`,
                  onClick: () => {
                    onChoose(fingering.frets);
                    close();
                  },
                },
                el('span', {
                  class: 'ec-card-diagram',
                  html: renderDiagram(
                    fingering,
                    { chord: parsed.chord, dialect, instrument },
                    {
                      orientation: store.state.prefs.orientation,
                      handed: store.state.prefs.handed,
                    }
                  ),
                }),
                el(
                  'span',
                  { class: 'ec-caption' },
                  el('span', { class: 'ec-shorthand' }, fingering.shorthand),
                  el(
                    'span',
                    { class: `ec-badge ec-badge-${fingering.difficulty}` },
                    t(`difficulty.${fingering.difficulty}`)
                  )
                )
              )
            );
          },
        });
      };

      draw();
      body.append(grid);
    }
  }

  const actions = el(
    'div',
    { class: 'ec-dialog-actions' },
    chosen
      ? el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            id: 'voicing-clear',
            onClick: () => {
              onChoose(null);
              close();
            },
          },
          t(everywhere ? 'picker.clearEverywhere' : 'picker.clearChoice')
        )
      : null,
    el(
      'button',
      { type: 'button', class: 'ec-button ec-button-small', id: 'voicing-cancel', onClick: close },
      t('picker.cancel')
    )
  );

  dialog.append(heading, body, actions);
  // Clicking the backdrop closes, matching what a modal looks like it does.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
