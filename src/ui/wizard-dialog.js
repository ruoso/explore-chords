/**
 * Choose every voicing in a song at once (docs/DESIGN.md §2.10).
 *
 * Two steps, because a wizard that rewrote thirty shapes on one click would be
 * something you undo rather than something you use: pick a policy, see what it
 * would do, then accept it. What it shows is the same diagram and the same
 * "voiced as" label the song will carry, so the preview is the thing itself
 * rather than a description of it.
 *
 * Native <dialog>, so focus trapping, Escape and an inert background come for
 * free, as everywhere else in the app.
 */

import { el, clear } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import { parseSong, setVoicingForKey, voicingsFor, compareVoicings } from '../core/song.js';
import { fingeringFromFrets } from '../core/search.js';
import { plannersFor, planVoicings, plannerById } from '../core/voicing-plan.js';
import { sourcesFor, citation } from '../data/sources.js';
import { renderDiagram, voicedAsLabel } from '../render/index.js';
import { t, tr } from '../i18n/index.js';

/**
 * What one planner does, and whose practice it is following.
 *
 * Per planner, never shared: what backs the choro texture says nothing about
 * keeping a hand near the nut, and a planner that cites no source should say so
 * rather than borrow someone else's authority.
 */
function howItWorks(plannerId) {
  const rules = tr(['wizard', 'planners', plannerId, 'how']) ?? [];
  const sources = sourcesFor(plannerById(plannerId)?.sources ?? []);

  const details = el('details', { class: 'ec-wizard-how' });
  details.append(el('summary', {}, t('wizard.how')));

  const steps = el('ol', { class: 'ec-wizard-rules' });
  for (const rule of rules) steps.append(el('li', {}, rule));
  details.append(el('h4', { class: 'ec-wizard-how-title' }, t('wizard.howTitle')), steps);

  if (sources.length === 0) {
    details.append(el('p', { class: 'ec-help' }, t('wizard.noSources')));
    return details;
  }

  const list = el('ul', { class: 'ec-wizard-sources' });
  for (const source of sources) {
    list.append(
      el(
        'li',
        {},
        source.url
          ? el(
              'a',
              { href: source.url, target: '_blank', rel: 'noreferrer noopener' },
              citation(source)
            )
          : citation(source)
      )
    );
  }
  details.append(el('h4', { class: 'ec-wizard-how-title' }, t('wizard.sources')), list);
  return details;
}

export function openWizardDialog({ store, sheet, instrument, tuning, dialect, onChange }) {
  const existing = document.querySelector('#wizard-dialog');
  if (existing) existing.remove();

  const dialog = el('dialog', {
    class: 'ec-dialog ec-dialog-wizard',
    id: 'wizard-dialog',
    'aria-labelledby': 'wizard-dialog-title',
  });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const heading = el('h2', { class: 'ec-dialog-title', id: 'wizard-dialog-title' }, t('wizard.title'));
  const body = el('div', { class: 'ec-dialog-body' });
  const actions = el('div', { class: 'ec-dialog-actions' });

  const song = parseSong(sheet.body, dialect);
  const planners = plannersFor(instrument);

  /** Step one: what the wizard can do, and why you would want each. */
  const chooseStep = () => {
    clear(body);
    clear(actions);
    body.append(el('p', { class: 'ec-help' }, t('wizard.help')));

    const list = el('ul', { class: 'ec-wizard-planners' });
    for (const planner of planners) {
      list.append(
        el(
          'li',
          {},
          el(
            'button',
            {
              type: 'button',
              class: 'ec-wizard-planner',
              id: `wizard-${planner.id}`,
              onClick: () => previewStep(planner.id),
            },
            el('span', { class: 'ec-wizard-planner-name' }, t(`wizard.planners.${planner.id}.name`)),
            el('span', { class: 'ec-wizard-planner-text' }, t(`wizard.planners.${planner.id}.text`))
          )
        )
      );
    }
    body.append(list);

    actions.append(
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'wizard-cancel', onClick: close },
        t('wizard.cancel')
      )
    );
  };

  /** Step two: the shapes it chose, exactly as the song would carry them. */
  const previewStep = (plannerId) => {
    const already = voicingsFor(song, tuning);
    const plan = planVoicings(plannerId, song, instrument, { dialect, existing: already });
    const changing = plan.chosen.size - plan.unchanged.length;

    clear(body);
    clear(actions);
    body.append(
      el('h3', { class: 'ec-wizard-chosen' }, t(`wizard.planners.${plannerId}.name`)),
      el('p', { class: 'ec-help' }, t(`wizard.planners.${plannerId}.text`)),
      // In the context of the planner it explains, so the sources shown are
      // the ones actually behind these shapes.
      howItWorks(plannerId),
      el(
        'p',
        { class: 'ec-wizard-summary', id: 'wizard-summary' },
        changing === 0
          ? t('wizard.nothing')
          : t('wizard.summary', { count: changing, total: plan.chosen.size })
      )
    );

    if (plan.missing.length > 0) {
      body.append(
        el(
          'p',
          { class: 'ec-error', id: 'wizard-missing' },
          t('wizard.missing', { list: plan.missing.join(', ') })
        )
      );
    }

    // In the order the legend uses, so the preview reads like the printed sheet.
    const entries = [...plan.chosen.keys()]
      .map((key) => {
        const occurrence = song.occurrences.find((c) => c.key === key);
        return { key, symbol: occurrence.symbol, index: occurrence.index };
      })
      .sort(compareVoicings);

    const grid = el('ul', { class: 'ec-wizard-preview', id: 'wizard-preview' });
    for (const entry of entries) {
      const chord = parseChord(entry.symbol, dialect).chord;
      if (!chord) continue;
      const frets = plan.chosen.get(entry.key);
      const fingering = fingeringFromFrets(frets, chord, instrument);
      if (!fingering) continue;
      const sounded = voicedAsLabel(fingering, { chord, dialect, full: true });
      const same = plan.unchanged.includes(entry.key);

      grid.append(
        el(
          'li',
          { class: `ec-wizard-shape${same ? ' is-unchanged' : ''}` },
          el(
            'p',
            { class: 'ec-print-chord-name' },
            el('span', {}, entry.key),
            sounded ? el('span', { class: 'ec-voiced-as' }, sounded) : null
          ),
          el('div', {
            html: renderDiagram(
              fingering,
              { chord, dialect, instrument },
              { orientation: 'vertical', handed: store.state.prefs.handed }
            ),
          })
        )
      );
    }
    body.append(grid);

    actions.append(
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'wizard-back', onClick: chooseStep },
        t('wizard.back')
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small ec-button-primary',
          id: 'wizard-apply',
          disabled: changing === 0,
          onClick: () => {
            // One edit per key, threaded through the same function the picker
            // uses, so the footnote and tidying rules apply exactly as they
            // would to thirty separate choices.
            let text = sheet.body;
            for (const [key, frets] of plan.chosen) {
              text = setVoicingForKey(text, key, frets, { tuning, dialect });
            }
            store.updateSheet(sheet.id, (s) => ({ ...s, body: text }));
            close();
            onChange();
          },
        },
        t('wizard.apply')
      )
    );
  };

  chooseStep();
  dialog.append(heading, body, actions);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
