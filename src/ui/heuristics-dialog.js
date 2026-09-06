/**
 * Voicing rules: presets plus the expert panel (docs/DESIGN.md §2.4).
 *
 * These belong to the instrument, not the app. A bass and a ukulele want
 * permanently different rules, so editing here writes to the active instrument
 * instance and is saved with it. Switching instruments switches rules.
 */

import { el, clear } from './dom.js';
import { PRESET_IDS, PRESET_LABELS, withOverrides } from '../core/heuristics.js';
import { configFor } from '../core/instrument.js';

/** Rules exposed as plain on/off switches. */
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

/** Numeric limits. */
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

export function renderHeuristicsPanel(container, { store, onChange }) {
  clear(container);
  const instrument = store.effectiveInstrument;
  if (!instrument) return;

  const config = instrument.heuristics;
  const presetName =
    config.preset === 'custom' ? 'Custom' : (PRESET_LABELS[config.preset] ?? 'Custom');

  const panel = el('details', { class: 'ec-heuristics', id: 'heuristics' });
  panel.append(
    el(
      'summary',
      { class: 'ec-heuristics-summary', id: 'heuristics-toggle' },
      'Voicing rules',
      el('span', { class: 'ec-heuristics-preset' }, presetName)
    )
  );

  const body = el('div', { class: 'ec-heuristics-body' });

  body.append(
    el(
      'p',
      { class: 'ec-help' },
      `These rules belong to ${instrument.label}. Each instrument keeps its own.`
    )
  );

  // --- preset -------------------------------------------------------------

  const presetSelect = el('select', {
    id: 'heuristics-preset',
    onChange: () => {
      // Instrument-derived defaults are reapplied on top of the preset, so
      // choosing "Jazz" cannot silently re-enable a root bass on a ukulele.
      onChange(configFor(instrument, presetSelect.value));
    },
  });
  for (const id of PRESET_IDS) {
    presetSelect.append(
      el('option', { value: id, selected: id === config.preset || null }, PRESET_LABELS[id])
    );
  }
  if (config.preset === 'custom') {
    presetSelect.append(el('option', { value: 'custom', selected: true }, 'Custom'));
  }

  body.append(
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'heuristics-preset' }, 'Preset'),
      presetSelect
    )
  );

  // --- rules --------------------------------------------------------------

  const apply = (patch) => onChange(withOverrides(config, patch));

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
  body.append(rules);

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
  body.append(limits);

  // --- weights ------------------------------------------------------------

  const advanced = el('details', { class: 'ec-weights' });
  advanced.append(el('summary', {}, 'Difficulty weights'));
  advanced.append(
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
  body.append(advanced);

  panel.append(body);
  container.append(panel);
  return panel;
}
