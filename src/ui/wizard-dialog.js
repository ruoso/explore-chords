/**
 * Choose every voicing in a song at once (docs/DESIGN.md §2.10).
 *
 * Two steps, because a wizard that rewrote thirty shapes on one click would be
 * something you undo rather than something you use: pick a policy, see what it
 * would do, then accept it. What it shows is the song as the plan would leave
 * it — the same diagrams, the same "voiced as" labels, the same footnote
 * markers — arrived at by actually applying the plan to a copy of the text, so
 * the preview cannot drift from the result.
 *
 * Where a policy has a stylistic choice inside it, the control for it sits
 * here rather than on a step of its own: an option is much easier to
 * understand when you can watch thirty shapes answer to it.
 *
 * Native <dialog>, so focus trapping, Escape and an inert background come for
 * free, as everywhere else in the app.
 */

import { el, clear } from './dom.js';
import { parseChord } from '../core/notation/parse.js';
import {
  parseSong,
  setVoicingsForOccurrences,
  voicingsFor,
  songLegend,
  countForKey,
} from '../core/song.js';
import { fingeringFromFrets } from '../core/search.js';
import { plannersFor, planVoicings, plannerById, optionDefaults } from '../core/voicing-plan/index.js';
import { sourcesFor, citation } from '../data/sources.js';
import { renderDiagram, voicedAsLabel, neckInset, boxWidth } from '../render/index.js';
import { t, tr } from '../i18n/index.js';

/**
 * What one planner does, and whose practice it is following.
 *
 * Per planner, never shared: what backs the choro texture says nothing about
 * keeping a hand near the nut, and a planner that cites no source should say so
 * rather than borrow someone else's authority.
 *
 * The rules answer to the choices in force, so the list never claims a third
 * while the control beside it says otherwise.
 */
function howItWorks(plannerId, choices) {
  const planner = plannerById(plannerId);
  const rules = [...(tr(['wizard', 'planners', plannerId, 'how']) ?? [])];
  for (const option of planner?.options ?? []) {
    const rule = tr([
      'wizard',
      'planners',
      plannerId,
      'options',
      option.id,
      'rules',
      choices[option.id],
    ]);
    if (rule) rules.push(rule);
  }
  const sources = sourcesFor([
    ...(planner?.sources ?? []),
    ...(planner?.options ?? []).flatMap((o) => o.sources ?? []),
  ]);

  const details = el('details', { class: 'ec-wizard-how' });
  details.append(el('summary', {}, t('wizard.how')));

  const steps = el('ol', { class: 'ec-wizard-rules' });
  for (const rule of rules) steps.append(el('li', {}, rule));
  details.append(el('h4', { class: 'ec-wizard-how-title' }, t('wizard.howTitle')), steps);

  if (sources.length === 0) {
    details.append(el('p', { class: 'ec-help' }, t('wizard.noSources')));
    return details;
  }

  const seen = new Set();
  const list = el('ul', { class: 'ec-wizard-sources' });
  for (const source of sources) {
    if (seen.has(source.id)) continue;
    seen.add(source.id);
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

export function openWizardDialog({
  store,
  sheet,
  instrument,
  tuning,
  dialect,
  variation,
  onChange,
}) {
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
              onClick: () => previewStep(planner.id, optionDefaults(planner)),
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

  /**
   * One stylistic question, as a group of radios.
   *
   * The dialog renders these without knowing what any of them mean — that is
   * what keeps it from growing a branch per planner.
   */
  const optionControl = (plannerId, option, choices) => {
    const group = el('fieldset', { class: 'ec-wizard-option', id: `wizard-option-${option.id}` });
    group.append(
      el(
        'legend',
        {},
        t(`wizard.planners.${plannerId}.options.${option.id}.label`)
      )
    );
    for (const value of option.values) {
      const id = `wizard-${option.id}-${value}`;
      group.append(
        el(
          'label',
          { class: 'ec-wizard-option-value', for: id },
          el('input', {
            type: 'radio',
            id,
            name: `wizard-${option.id}`,
            value,
            checked: choices[option.id] === value,
            onChange: () => previewStep(plannerId, { ...choices, [option.id]: value }),
          }),
          el('span', {}, t(`wizard.planners.${plannerId}.options.${option.id}.values.${value}`))
        )
      );
    }
    return group;
  };

  /** Step two: the song as this plan would leave it. */
  const previewStep = (plannerId, choices) => {
    const planner = plannerById(plannerId);
    const already = voicingsFor(song, tuning, variation);
    const plan = planVoicings(plannerId, song, instrument, { dialect, existing: already, choices });

    // Applied to a copy, then read back: the per-bar shapes a planner returns
    // become keys here, and what the legend shows is what the sheet will show.
    const next = setVoicingsForOccurrences(sheet.body, plan.shapes, {
      tuning,
      dialect,
      variation,
    });
    const nextSong = parseSong(next, dialect);
    const entries = songLegend(nextSong, tuning, variation);
    const changing = entries.filter((e) => {
      const before = already.get(e.key);
      return !before || before.join() !== e.frets.join();
    }).length;

    clear(body);
    clear(actions);
    body.append(
      el('h3', { class: 'ec-wizard-chosen' }, t(`wizard.planners.${plannerId}.name`)),
      el('p', { class: 'ec-help' }, t(`wizard.planners.${plannerId}.text`))
    );
    for (const option of planner.options ?? []) {
      body.append(optionControl(plannerId, option, choices));
    }
    body.append(
      // In the context of the planner it explains, so the sources shown are
      // the ones actually behind these shapes.
      howItWorks(plannerId, choices),
      el(
        'p',
        { class: 'ec-wizard-summary', id: 'wizard-summary' },
        changing === 0
          ? t('wizard.nothing')
          : t('wizard.summary', { count: changing, total: entries.length })
      )
    );

    if (plan.missing.length > 0) {
      const symbols = [...new Set(plan.missing.map((at) => plan.reading.line[at].ref.symbol))];
      body.append(
        el(
          'p',
          { class: 'ec-error', id: 'wizard-missing' },
          t('wizard.missing', { list: symbols.join(', ') })
        )
      );
    }

    const grid = el('ul', { class: 'ec-wizard-preview', id: 'wizard-preview' });
    for (const entry of entries) {
      const chord = parseChord(entry.symbol, dialect).chord;
      if (!chord) continue;
      const fingering = fingeringFromFrets(entry.frets, chord, instrument);
      if (!fingering) continue;
      const sounded = voicedAsLabel(fingering, {
        chord,
        dialect,
        full: true,
        name: entry.symbol,
      });
      const before = already.get(entry.key);
      const same = Boolean(before) && before.join() === entry.frets.join();
      // How many bars this shape covers, so a chord the plan deliberately split
      // into two is visible as two before it is accepted, not after.
      const bars = countForKey(nextSong, entry.key);

      grid.append(
        el(
          'li',
          {
            class: `ec-wizard-shape${same ? ' is-unchanged' : ''}`,
            style:
              `--ec-box-width: ${boxWidth(fingering.frets.length)}px;` +
              `--ec-neck-inset: ${neckInset()}px`,
          },
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
          }),
          el('p', { class: 'ec-wizard-covers' }, t('wizard.covers', { count: bars }))
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
            // The very text the preview was built from, so what you accepted is
            // what you get.
            store.updateSheet(sheet.id, (s) => ({ ...s, body: next }));
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
