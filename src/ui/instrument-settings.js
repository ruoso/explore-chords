/**
 * The instrument screen (docs/DESIGN.md §2.1, §2.5).
 *
 * A list of the instruments you have, each with use, edit and delete, plus add.
 * Editing opens the same form used for adding, so the two are symmetrical, and
 * it edits *that* instrument rather than whichever happens to be active.
 *
 * Voicing rules sit inside the editor rather than on the list, because they
 * belong to one instrument. A bass and a ukulele want permanently different
 * rules, so editing them is part of editing the instrument.
 */

import { el, clear } from './dom.js';
import { formatTuning, configFor, isReentrant } from '../core/instrument.js';
import { PRESET_IDS, withOverrides } from '../core/heuristics.js';
import { t } from '../i18n/index.js';
import { renderInstrumentForm, presetLabel } from './instrument-form.js';

/** Each rule, limit and weight is labelled by its key under `rules` in the translations. */
const RULES = [
  'rootInBass',
  'requireThird',
  'omitFifth',
  'allowRootless',
  'requireExtensions',
  'allowBarre',
  'allowInnerMutes',
  'allowDoubling',
  'allowDuplicatePitch',
];

const LIMITS = [
  ['maxSpan', 1, 6],
  ['minSoundingStrings', 1, 8],
  ['maxResultsPerGroup', 1, 20],
];

const WEIGHTS = [
  'spanPerFret',
  'barre',
  'fullBarre',
  'perFinger',
  'innerMute',
  'mutedString',
  'positionPerFret',
  'omittedFifth',
  'rootless',
  'nonRootBass',
  'openString',
  'nonAdjacentStretch',
];

/** The list of instruments. */
export function renderInstrumentList(container, { store, onAdd, onEdit, onUse, onDelete }) {
  clear(container);
  const page = el('div', { class: 'ec-page' });
  page.append(
    el('h2', { class: 'ec-page-title' }, t('instruments.title')),
    el(
      'p',
      { class: 'ec-help' },
      t('instruments.help')
    )
  );

  const list = el('ul', { class: 'ec-instrument-list' });
  for (const instrument of store.state.instruments) {
    const isActive = instrument.id === store.state.activeId;
    list.append(
      el(
        'li',
        { class: `ec-instrument-row${isActive ? ' is-active' : ''}` },
        el(
          'div',
          { class: 'ec-instrument-info' },
          el(
            'p',
            { class: 'ec-instrument-name' },
            instrument.label,
            isActive ? el('span', { class: 'ec-badge' }, t('instruments.inUse')) : null,
            isReentrant(instrument) ? el('span', { class: 'ec-badge' }, t('instruments.reentrant')) : null
          ),
          el(
            'p',
            { class: 'ec-instrument-tuning' },
            t('instruments.meta', { tuning: formatTuning(instrument.strings), count: instrument.fretCount })
          )
        ),
        el(
          'div',
          { class: 'ec-instrument-actions' },
          isActive
            ? null
            : el(
                'button',
                {
                  type: 'button',
                  class: 'ec-button ec-button-small',
                  'aria-label': t('instruments.useLabel', { label: instrument.label }),
                  onClick: () => onUse(instrument),
                },
                t('instruments.use')
              ),
          el(
            'button',
            {
              type: 'button',
              class: 'ec-button ec-button-small',
              'aria-label': t('instruments.editLabel', { label: instrument.label }),
              onClick: () => onEdit(instrument),
            },
            t('instruments.edit')
          ),
          store.state.instruments.length > 1
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'ec-button ec-button-small',
                  'aria-label': t('instruments.deleteLabel', { label: instrument.label }),
                  onClick: () => onDelete(instrument),
                },
                t('instruments.delete')
              )
            : null
        )
      )
    );
  }

  page.append(
    list,
    el(
      'div',
      { class: 'ec-actions' },
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-primary', id: 'instrument-add', onClick: onAdd },
        t('instruments.add')
      )
    )
  );

  container.append(page);
  return page;
}

/** The editor for one instrument: the shared form, plus its voicing rules. */
export function renderInstrumentEditor(
  container,
  { instrument, onSave, onCancel, onDelete, onRules }
) {
  clear(container);
  if (!instrument) return;

  const page = el('div', { class: 'ec-page' });
  page.append(
    el(
      'button',
      { type: 'button', class: 'ec-button ec-button-small ec-back', id: 'instrument-back', onClick: onCancel },
      t('instruments.back')
    )
  );

  const formBox = el('div', {});
  renderInstrumentForm(formBox, {
    mode: 'edit',
    instrument,
    onSubmit: onSave,
    onCancel,
  });
  page.append(formBox);

  // --- voicing rules ------------------------------------------------------

  const config = instrument.heuristics;
  const presetName = presetLabel(config.preset);
  const apply = (patch) => onRules(withOverrides(config, patch));

  const rulesPanel = el('section', { class: 'ec-panel', 'aria-labelledby': 'settings-rules' });
  rulesPanel.append(
    el(
      'h3',
      { class: 'ec-panel-title', id: 'settings-rules' },
      t('rules.title'),
      el('span', { class: 'ec-panel-tag' }, presetName)
    ),
    el('p', { class: 'ec-help' }, t('rules.help', { label: instrument.label }))
  );

  const presetSelect = el('select', {
    id: 'heuristics-preset',
    onChange: () => onRules(configFor(instrument, presetSelect.value)),
  });
  for (const id of PRESET_IDS) {
    presetSelect.append(
      el('option', { value: id, selected: id === config.preset || null }, presetLabel(id))
    );
  }
  if (config.preset === 'custom') {
    presetSelect.append(el('option', { value: 'custom', selected: true }, presetLabel('custom')));
  }
  rulesPanel.append(
    el('div', { class: 'ec-field' }, el('label', { for: 'heuristics-preset' }, t('rules.preset')), presetSelect)
  );

  const rules = el('fieldset', { class: 'ec-rules' });
  rules.append(el('legend', {}, t('rules.rules')));
  for (const key of RULES) {
    const id = `rule-${key}`;
    rules.append(
      el(
        'label',
        { class: 'ec-rule', for: id },
        el('input', {
          type: 'checkbox',
          id,
          checked: config[key] || null,
          onChange: (event) => apply({ [key]: event.target.checked }),
        }),
        t(`rules.${key}`)
      )
    );
  }
  rulesPanel.append(rules);

  const limits = el('fieldset', { class: 'ec-limits' });
  limits.append(el('legend', {}, t('rules.limits')));
  for (const [key, min, max] of LIMITS) {
    const id = `limit-${key}`;
    limits.append(
      el(
        'div',
        { class: 'ec-field ec-field-inline' },
        el('label', { for: id }, t(`rules.${key}`)),
        el('input', {
          type: 'number',
          id,
          min,
          max,
          step: 1,
          value: config[key],
          onChange: (event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) apply({ [key]: value });
          },
        })
      )
    );
  }
  rulesPanel.append(limits);

  const advanced = el('details', { class: 'ec-weights' });
  advanced.append(
    el('summary', {}, t('rules.weights')),
    el(
      'p',
      { class: 'ec-help' },
      t('rules.weightsHelp')
    )
  );
  const weightGrid = el('div', { class: 'ec-weights-grid' });
  for (const key of WEIGHTS) {
    const id = `weight-${key}`;
    weightGrid.append(
      el(
        'div',
        { class: 'ec-field ec-field-inline' },
        el('label', { for: id }, t(`rules.weight.${key}`)),
        el('input', {
          type: 'number',
          id,
          step: '0.1',
          value: config.weights[key] ?? 0,
          onChange: (event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value)) apply({ weights: { [key]: value } });
          },
        })
      )
    );
  }
  advanced.append(weightGrid);
  rulesPanel.append(advanced);
  page.append(rulesPanel);

  if (onDelete) {
    page.append(
      el(
        'div',
        { class: 'ec-actions ec-danger' },
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            id: 'instrument-delete',
            onClick: () => onDelete(instrument),
          },
          t('instruments.deleteThis')
        )
      )
    );
  }

  container.append(page);
  return page;
}
