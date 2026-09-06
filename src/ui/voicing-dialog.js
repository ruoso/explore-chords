/**
 * Choose how one chord is played in a song sheet.
 *
 * A modal listing every fingering the search found for that chord on the
 * sheet's instrument, so a teacher picks the shape they want taught rather than
 * accepting whichever the ranking put first.
 *
 * Uses a native <dialog>, which brings focus trapping, Escape to close and
 * inert background for free — all of which are easy to get wrong by hand.
 */

import { el } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import { searchFingerings, allFingerings } from '../core/search.js';
import { renderDiagram } from '../render/index.js';
import { DIFFICULTY_LABELS } from '../core/score.js';

export function openVoicingDialog({ store, chordText, instrument, chosen, onChoose }) {
  const existing = document.querySelector('#voicing-dialog');
  if (existing) existing.remove();

  const dialog = el('dialog', { class: 'ec-dialog', id: 'voicing-dialog' });
  const dialect = store.state.prefs.dialect;
  const parsed = parseChord(chordText, dialect);

  const heading = el('h2', { class: 'ec-dialog-title', id: 'voicing-dialog-title' },
    `How is ${chordText} played?`);
  dialog.setAttribute('aria-labelledby', 'voicing-dialog-title');

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const body = el('div', { class: 'ec-dialog-body' });

  if (!parsed.chord) {
    body.append(
      el('p', { class: 'ec-error' }, parsed.errors[0]?.message ?? 'That chord does not parse.')
    );
  } else {
    const results = searchFingerings(parsed.chord, instrument);
    const fingerings = allFingerings(results);

    if (fingerings.length === 0) {
      body.append(
        el(
          'p',
          { class: 'ec-help' },
          `No fingerings for ${chordText} on ${instrument.label}. Its voicing rules may be too strict.`
        )
      );
    } else {
      body.append(
        el(
          'p',
          { class: 'ec-help' },
          `${fingerings.length} ways to play it, easiest first. The choice applies wherever ${chordText} appears in this song.`
        )
      );

      const list = el('ul', { class: 'ec-dialog-grid', 'aria-label': `Fingerings for ${chordText}` });
      for (const fingering of fingerings) {
        const isChosen =
          Array.isArray(chosen) && chosen.join(',') === fingering.frets.join(',');
        list.append(
          el(
            'li',
            {},
            el(
              'button',
              {
                type: 'button',
                class: `ec-dialog-choice${isChosen ? ' is-chosen' : ''}`,
                'aria-pressed': isChosen ? 'true' : 'false',
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
                  { orientation: store.state.prefs.orientation, handed: store.state.prefs.handed }
                ),
              }),
              el(
                'span',
                { class: 'ec-caption' },
                el('span', { class: 'ec-shorthand' }, fingering.shorthand),
                el(
                  'span',
                  { class: `ec-badge ec-badge-${fingering.difficulty}` },
                  DIFFICULTY_LABELS[fingering.difficulty]
                )
              )
            )
          )
        );
      }
      body.append(list);
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
          'Clear choice'
        )
      : null,
    el(
      'button',
      { type: 'button', class: 'ec-button ec-button-small', id: 'voicing-cancel', onClick: close },
      'Cancel'
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
