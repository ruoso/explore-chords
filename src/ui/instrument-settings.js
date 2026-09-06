/**
 * Instrument settings (docs/DESIGN.md §2.1, §2.4).
 *
 * Everything about the active instrument lives here: what it is called, how it
 * is tuned, and how it should be voiced. The voicing rules belong on this
 * screen rather than beside the chord input, because they are a property of the
 * instrument, not of the search you happen to be running.
 *
 * Naming matters more than it looks. A user with three custom tunings needs to
 * tell them apart in the switcher, and "Guitar (6-string) · Custom" three times
 * over is useless.
 */

import { el, clear } from './dom.js';
import { parseTuning, formatTuning, configFor, CATALOG } from '../core/instrument.js';
import { PRESET_IDS, PRESET_LABELS, withOverrides } from '../core/heuristics.js';

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

export function renderInstrumentSettings(container, { store, onChange, onAdd, onDelete }) {
  clear(container);
  const instrument = store.effectiveInstrument;
  if (!instrument) return;

  const isBorrowed = Boolean(store.state.viewAs);
  const config = instrument.heuristics;
  const presetName =
    config.preset === 'custom' ? 'Custom' : (PRESET_LABELS[config.preset] ?? 'Custom');

  const page = el('div', { class: 'ec-page' });
  page.append(el('h2', { class: 'ec-page-title' }, 'Instrument'));

  if (isBorrowed) {
    page.append(
      el(
        'p',
        { class: 'ec-help' },
        'This instrument came from a link or a song sheet. Keep it as your default to edit it permanently.'
      )
    );
  }

  // --- identity -----------------------------------------------------------

  const identity = el('section', { class: 'ec-panel', 'aria-labelledby': 'settings-identity' });
  identity.append(el('h3', { class: 'ec-panel-title', id: 'settings-identity' }, 'Name and tuning'));

  const nameInput = el('input', {
    type: 'text',
    id: 'instrument-name',
    value: instrument.label,
    maxlength: '60',
    autocomplete: 'off',
  });

  const tuningInput = el('input', {
    type: 'text',
    id: 'instrument-tuning',
    value: formatTuning(instrument.strings),
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'instrument-tuning-help',
  });

  const fretsInput = el('input', {
    type: 'number',
    id: 'instrument-frets',
    min: '5',
    max: '30',
    step: '1',
    value: instrument.fretCount,
  });

  const error = el('p', { class: 'ec-error', id: 'instrument-error', role: 'alert', hidden: true });

  identity.append(
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-name' }, 'Name'),
      nameInput,
      el(
        'p',
        { class: 'ec-help' },
        'Shown in the switcher. Give custom tunings names you will recognise.'
      )
    ),
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-tuning' }, 'Tuning'),
      tuningInput,
      el(
        'p',
        { class: 'ec-help', id: 'instrument-tuning-help' },
        'Lowest string first. Any comma-separated pitch list works, including re-entrant tunings.'
      )
    ),
    el(
      'div',
      { class: 'ec-field ec-field-inline' },
      el('label', { for: 'instrument-frets' }, 'Frets'),
      fretsInput
    ),
    error,
    el(
      'div',
      { class: 'ec-actions' },
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-primary',
          id: 'instrument-save',
          onClick: () => {
            error.hidden = true;
            const name = nameInput.value.trim();
            if (!name) {
              error.textContent = 'Give the instrument a name.';
              error.hidden = false;
              nameInput.focus();
              return;
            }
            let strings;
            try {
              strings = parseTuning(tuningInput.value);
            } catch (e) {
              error.textContent = `That tuning does not read: ${e.message}`;
              error.hidden = false;
              tuningInput.focus();
              return;
            }
            const frets = Number(fretsInput.value);
            onChange({
              label: name,
              strings,
              fretCount: Number.isFinite(frets) ? frets : instrument.fretCount,
            });
          },
        },
        'Save'
      )
    )
  );
  page.append(identity);

  // --- voicing rules ------------------------------------------------------

  const apply = (patch) => onChange({ heuristics: withOverrides(config, patch) });

  const rulesPanel = el('section', { class: 'ec-panel', 'aria-labelledby': 'settings-rules' });
  rulesPanel.append(
    el(
      'h3',
      { class: 'ec-panel-title', id: 'settings-rules' },
      'Voicing rules',
      el('span', { class: 'ec-panel-tag' }, presetName)
    ),
    el(
      'p',
      { class: 'ec-help' },
      'How chords are voiced on this instrument. Each instrument keeps its own rules.'
    )
  );

  const presetSelect = el('select', {
    id: 'heuristics-preset',
    onChange: () => onChange({ heuristics: configFor(instrument, presetSelect.value) }),
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

  // --- your instruments ---------------------------------------------------

  const list = el('section', { class: 'ec-panel', 'aria-labelledby': 'settings-list' });
  list.append(el('h3', { class: 'ec-panel-title', id: 'settings-list' }, 'Your instruments'));

  const ul = el('ul', { class: 'ec-instrument-list' });
  for (const item of store.state.instruments) {
    const isActive = item.id === store.state.activeId;
    ul.append(
      el(
        'li',
        { class: `ec-instrument-row${isActive ? ' is-active' : ''}` },
        el(
          'div',
          { class: 'ec-instrument-info' },
          el('p', { class: 'ec-instrument-name' }, item.label),
          el('p', { class: 'ec-instrument-tuning' }, formatTuning(item.strings))
        ),
        el(
          'div',
          { class: 'ec-instrument-actions' },
          isActive
            ? el('span', { class: 'ec-badge' }, 'Active')
            : el(
                'button',
                {
                  type: 'button',
                  class: 'ec-button ec-button-small',
                  onClick: () => {
                    store.setActive(item.id);
                    onChange(null);
                  },
                },
                'Use'
              ),
          store.state.instruments.length > 1
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'ec-button ec-button-small',
                  'aria-label': `Delete ${item.label}`,
                  onClick: () => onDelete(item),
                },
                'Delete'
              )
            : null
        )
      )
    );
  }
  list.append(
    ul,
    el(
      'div',
      { class: 'ec-actions' },
      el(
        'button',
        { type: 'button', class: 'ec-button', id: 'instrument-add', onClick: onAdd },
        'Add instrument'
      )
    )
  );
  page.append(list);

  // Reference, so someone writing a custom tuning has something to copy.
  const reference = el('details', { class: 'ec-panel ec-reference' });
  reference.append(el('summary', {}, 'Standard tunings for reference'));
  const table = el('table', { class: 'ec-reference-table' });
  table.append(
    el('thead', {}, el('tr', {}, el('th', {}, 'Instrument'), el('th', {}, 'Tuning')))
  );
  const tbody = el('tbody', {});
  for (const entry of CATALOG) {
    for (const tuning of entry.tunings) {
      tbody.append(
        el(
          'tr',
          {},
          el('td', {}, `${entry.name} · ${tuning.name}`),
          el('td', { class: 'ec-reference-tuning' }, tuning.strings)
        )
      );
    }
  }
  table.append(tbody);
  reference.append(table);
  page.append(reference);

  container.append(page);
  return page;
}
