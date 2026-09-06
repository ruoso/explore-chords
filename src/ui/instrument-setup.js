/**
 * First-run setup and "add instrument" (docs/DESIGN.md §2.1).
 *
 * First run *is* instrument setup: the user lands in the explorer already
 * configured. There is deliberately no "choose an instrument" field sitting in
 * the middle of the chord form — the instrument is ambient context, not a query
 * parameter.
 */

import { CATALOG, instrumentInstance, parseTuning } from '../core/instrument.js';
import { el, clear } from './dom.js';

/**
 * @param {object} options
 * @param {(instrument: object) => void} options.onDone
 * @param {() => void} [options.onCancel]
 * @param {boolean} [options.firstRun]
 */
export function renderInstrumentSetup(container, { onDone, onCancel, firstRun = true }) {
  clear(container);

  const form = el('form', { class: 'ec-setup', novalidate: true });

  form.append(
    el('h2', { class: 'ec-setup-title' }, firstRun ? 'Choose your instrument' : 'Add an instrument'),
    el(
      'p',
      { class: 'ec-setup-lead' },
      firstRun
        ? 'Everything is shown for this instrument. You can add others and switch at any time.'
        : 'It joins your list; the header switcher moves between them.'
    )
  );

  const instrumentField = el('div', { class: 'ec-field' });
  const instrumentSelect = el('select', { id: 'setup-instrument', name: 'instrument' });
  for (const entry of CATALOG) {
    instrumentSelect.append(el('option', { value: entry.id }, entry.name));
  }
  instrumentField.append(
    el('label', { for: 'setup-instrument' }, 'Instrument'),
    instrumentSelect
  );

  const tuningField = el('div', { class: 'ec-field' });
  const tuningSelect = el('select', { id: 'setup-tuning', name: 'tuning' });
  tuningField.append(el('label', { for: 'setup-tuning' }, 'Tuning'), tuningSelect);

  const customField = el('div', { class: 'ec-field' });
  const customInput = el('input', {
    id: 'setup-custom',
    name: 'custom',
    type: 'text',
    placeholder: 'E2, A2, D3, G3, B3, E4',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const customHelp = el(
    'p',
    { class: 'ec-help', id: 'setup-custom-help' },
    'Any comma-separated pitch list works, including re-entrant tunings.'
  );
  customInput.setAttribute('aria-describedby', 'setup-custom-help');
  customField.append(
    el('label', { for: 'setup-custom' }, 'Or a custom tuning'),
    customInput,
    customHelp
  );

  const error = el('p', { class: 'ec-error', role: 'alert', hidden: true });

  const actions = el('div', { class: 'ec-actions' });
  const submit = el(
    'button',
    { type: 'submit', class: 'ec-button ec-button-primary' },
    firstRun ? 'Start playing' : 'Add instrument'
  );
  actions.append(submit);
  if (onCancel) {
    const cancel = el('button', { type: 'button', class: 'ec-button' }, 'Cancel');
    cancel.addEventListener('click', onCancel);
    actions.append(cancel);
  }

  form.append(instrumentField, tuningField, customField, error, actions);

  function refreshTunings() {
    const entry = CATALOG.find((e) => e.id === instrumentSelect.value);
    clear(tuningSelect);
    for (const tuning of entry.tunings) {
      tuningSelect.append(
        el('option', { value: tuning.name }, `${tuning.name} — ${tuning.strings}`)
      );
    }
  }

  instrumentSelect.addEventListener('change', refreshTunings);
  refreshTunings();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;

    const entry = CATALOG.find((e) => e.id === instrumentSelect.value);
    const custom = customInput.value.trim();
    let strings = custom;
    let label = `${entry.name} · Custom`;

    if (!custom) {
      const tuning = entry.tunings.find((t) => t.name === tuningSelect.value);
      strings = tuning.strings;
      label = `${entry.name} · ${tuning.name}`;
    }

    try {
      parseTuning(strings);
    } catch (e) {
      error.textContent = `That tuning does not read: ${e.message}`;
      error.hidden = false;
      customInput.focus();
      return;
    }

    onDone(
      instrumentInstance({
        catalogId: entry.id,
        label,
        strings,
        fretCount: entry.fretCount,
      })
    );
  });

  container.append(form);
  instrumentSelect.focus();
  return form;
}
