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
import { PRESET_IDS, PRESET_LABELS, withOverrides } from '../core/heuristics.js';
import { renderInstrumentForm } from './instrument-form.js';

const RULES = [
  ['rootInBass', 'Root must be the lowest note'],
  ['requireThird', 'Require the 3rd'],
  ['omitFifth', 'The 5th may be omitted'],
  ['allowRootless', 'Allow rootless voicings'],
  ['requireExtensions', 'Require every named extension'],
  ['allowBarre', 'Allow barre chords'],
  ['allowInnerMutes', 'Allow a muted string between sounding ones'],
  ['allowDoubling', 'Allow a note on more than one string'],
  ['allowDuplicatePitch', 'Allow the identical pitch twice'],
];

const LIMITS = [
  ['maxSpan', 'Maximum stretch (frets)', 1, 6],
  ['minSoundingStrings', 'Fewest strings sounding', 1, 8],
  ['maxResultsPerGroup', 'Shapes shown per position', 1, 20],
];

const WEIGHT_LABELS = {
  spanPerFret: 'Stretch, per fret',
  barre: 'Barre',
  fullBarre: 'Full barre, extra',
  perFinger: 'Each finger',
  innerMute: 'Inner muted string',
  mutedString: 'Each muted string',
  positionPerFret: 'Position, per fret',
  omittedFifth: 'Omitting the 5th',
  rootless: 'Omitting the root',
  nonRootBass: 'Unrequested inversion',
  openString: 'Each open string (a bonus)',
  nonAdjacentStretch: 'Wide stretch',
};

/** The list of instruments. */
export function renderInstrumentList(container, { store, onAdd, onEdit, onUse, onDelete }) {
  clear(container);
  const page = el('div', { class: 'ec-page' });
  page.append(
    el('h2', { class: 'ec-page-title' }, 'Instruments'),
    el(
      'p',
      { class: 'ec-help' },
      'Everything on screen is for the instrument in use. Each keeps its own tuning, voicing rules, saved shapes and songs.'
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
            isActive ? el('span', { class: 'ec-badge' }, 'In use') : null,
            isReentrant(instrument) ? el('span', { class: 'ec-badge' }, 'Re-entrant') : null
          ),
          el(
            'p',
            { class: 'ec-instrument-tuning' },
            `${formatTuning(instrument.strings)} · ${instrument.fretCount} frets`
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
                  'aria-label': `Use ${instrument.label}`,
                  onClick: () => onUse(instrument),
                },
                'Use'
              ),
          el(
            'button',
            {
              type: 'button',
              class: 'ec-button ec-button-small',
              'aria-label': `Edit ${instrument.label}`,
              onClick: () => onEdit(instrument),
            },
            'Edit'
          ),
          store.state.instruments.length > 1
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'ec-button ec-button-small',
                  'aria-label': `Delete ${instrument.label}`,
                  onClick: () => onDelete(instrument),
                },
                'Delete'
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
        'Add instrument'
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
      '← All instruments'
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
  const presetName =
    config.preset === 'custom' ? 'Custom' : (PRESET_LABELS[config.preset] ?? 'Custom');
  const apply = (patch) => onRules(withOverrides(config, patch));

  const rulesPanel = el('section', { class: 'ec-panel', 'aria-labelledby': 'settings-rules' });
  rulesPanel.append(
    el(
      'h3',
      { class: 'ec-panel-title', id: 'settings-rules' },
      'Voicing rules',
      el('span', { class: 'ec-panel-tag' }, presetName)
    ),
    el('p', { class: 'ec-help' }, `How chords are voiced on ${instrument.label}.`)
  );

  const presetSelect = el('select', {
    id: 'heuristics-preset',
    onChange: () => onRules(configFor(instrument, presetSelect.value)),
  });
  for (const id of PRESET_IDS) {
    presetSelect.append(
      el('option', { value: id, selected: id === config.preset || null }, PRESET_LABELS[id])
    );
  }
  if (config.preset === 'custom') {
    presetSelect.append(el('option', { value: 'custom', selected: true }, 'Custom'));
  }
  rulesPanel.append(
    el('div', { class: 'ec-field' }, el('label', { for: 'heuristics-preset' }, 'Preset'), presetSelect)
  );

  const rules = el('fieldset', { class: 'ec-rules' });
  rules.append(el('legend', {}, 'Rules'));
  for (const [key, label] of RULES) {
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
        label
      )
    );
  }
  rulesPanel.append(rules);

  const limits = el('fieldset', { class: 'ec-limits' });
  limits.append(el('legend', {}, 'Limits'));
  for (const [key, label, min, max] of LIMITS) {
    const id = `limit-${key}`;
    limits.append(
      el(
        'div',
        { class: 'ec-field ec-field-inline' },
        el('label', { for: id }, label),
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
    el('summary', {}, 'Difficulty weights'),
    el(
      'p',
      { class: 'ec-help' },
      'How much each thing counts towards a shape being hard. Negative values make a shape easier.'
    )
  );
  const weightGrid = el('div', { class: 'ec-weights-grid' });
  for (const [key, label] of Object.entries(WEIGHT_LABELS)) {
    const id = `weight-${key}`;
    weightGrid.append(
      el(
        'div',
        { class: 'ec-field ec-field-inline' },
        el('label', { for: id }, label),
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
          'Delete this instrument'
        )
      )
    );
  }

  container.append(page);
  return page;
}
