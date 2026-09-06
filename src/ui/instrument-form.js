/**
 * The instrument form, used for both creating and editing (docs/DESIGN.md §2.1).
 *
 * One form, one set of fields, whichever you are doing. Creating used to offer
 * a catalog and a tuning preset but no name, while editing offered a name and a
 * free-text tuning but no pickers — two different forms for the same data, and
 * no way to rename what you had just made.
 *
 * The tuning text is the source of truth; choosing a preset fills it in. That
 * way an arbitrary tuning is never second-class (§4.3), and a preset is just a
 * convenient way to type one.
 */

import { el, clear } from './dom.js';
import { CATALOG, catalogEntry, parseTuning, formatTuning } from '../core/instrument.js';

const CUSTOM = '__custom__';

/**
 * @param {HTMLElement} container
 * @param {object} options
 * @param {'create'|'edit'} options.mode
 * @param {object} [options.instrument]   the one being edited
 * @param {boolean} [options.firstRun]
 * @param {(values: object) => void} options.onSubmit
 * @param {() => void} [options.onCancel]
 */
export function renderInstrumentForm(
  container,
  { mode, instrument, firstRun = false, onSubmit, onCancel }
) {
  clear(container);

  const editing = mode === 'edit';
  const startingCatalog = instrument?.catalogId ?? CATALOG[0].id;
  const startingTuning = instrument ? formatTuning(instrument.strings) : null;

  const form = el('form', { class: 'ec-instrument-form', novalidate: true });

  form.append(
    el(
      'h2',
      { class: 'ec-page-title' },
      editing ? 'Edit instrument' : firstRun ? 'Choose your instrument' : 'Add an instrument'
    )
  );
  if (!editing) {
    form.append(
      el(
        'p',
        { class: 'ec-help' },
        firstRun
          ? 'Everything is shown for this instrument. You can add others and switch at any time.'
          : 'It joins your list; the header switcher moves between them.'
      )
    );
  }

  // --- instrument type ----------------------------------------------------

  const catalogSelect = el('select', { id: 'instrument-catalog', name: 'catalog' });
  for (const entry of CATALOG) {
    catalogSelect.append(
      el('option', { value: entry.id, selected: entry.id === startingCatalog || null }, entry.name)
    );
  }

  // --- tuning -------------------------------------------------------------

  const presetSelect = el('select', { id: 'instrument-tuning-preset', name: 'preset' });

  const tuningInput = el('input', {
    type: 'text',
    id: 'instrument-tuning',
    name: 'tuning',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'E2, A2, D3, G3, B3, E4',
    'aria-describedby': 'instrument-tuning-help',
  });

  const fretsInput = el('input', {
    type: 'number',
    id: 'instrument-frets',
    name: 'frets',
    min: '5',
    max: '30',
    step: '1',
  });

  // --- name ---------------------------------------------------------------

  const nameInput = el('input', {
    type: 'text',
    id: 'instrument-name',
    name: 'name',
    maxlength: '60',
    autocomplete: 'off',
  });

  // The name follows the pickers until the user writes their own, at which
  // point it is theirs and nothing overwrites it.
  let nameIsUsers = editing;
  nameInput.addEventListener('input', () => {
    nameIsUsers = true;
  });

  function suggestedName() {
    const entry = catalogEntry(catalogSelect.value);
    const preset =
      presetSelect.value === CUSTOM
        ? 'Custom'
        : (entry?.tunings.find((t) => t.name === presetSelect.value)?.name ?? 'Custom');
    return `${entry?.name ?? 'Instrument'} · ${preset}`;
  }

  function refreshName() {
    if (!nameIsUsers) nameInput.value = suggestedName();
  }

  function fillPresets({ keepTuning = false } = {}) {
    const entry = catalogEntry(catalogSelect.value);
    clear(presetSelect);
    for (const tuning of entry.tunings) {
      presetSelect.append(el('option', { value: tuning.name }, `${tuning.name} — ${tuning.strings}`));
    }
    presetSelect.append(el('option', { value: CUSTOM }, 'Custom tuning'));

    if (!keepTuning) {
      presetSelect.value = entry.tunings[0].name;
      tuningInput.value = entry.tunings[0].strings;
      fretsInput.value = String(entry.fretCount);
    }
    refreshName();
  }

  catalogSelect.addEventListener('change', () => fillPresets());

  presetSelect.addEventListener('change', () => {
    if (presetSelect.value === CUSTOM) {
      tuningInput.focus();
    } else {
      const entry = catalogEntry(catalogSelect.value);
      const tuning = entry.tunings.find((t) => t.name === presetSelect.value);
      if (tuning) tuningInput.value = tuning.strings;
    }
    refreshName();
  });

  // Typing a tuning by hand means it is no longer one of the presets.
  tuningInput.addEventListener('input', () => {
    const entry = catalogEntry(catalogSelect.value);
    const match = entry?.tunings.find((t) => t.strings === tuningInput.value.trim());
    presetSelect.value = match ? match.name : CUSTOM;
    refreshName();
  });

  fillPresets();

  // When editing, the stored values win over the catalog defaults.
  if (instrument) {
    const entry = catalogEntry(instrument.catalogId);
    const match = entry?.tunings.find((t) => t.strings === startingTuning);
    presetSelect.value = match ? match.name : CUSTOM;
    tuningInput.value = startingTuning;
    fretsInput.value = String(instrument.fretCount);
    nameInput.value = instrument.label;
  }

  const error = el('p', { class: 'ec-error', id: 'instrument-error', role: 'alert', hidden: true });

  form.append(
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-catalog' }, 'Instrument'),
      catalogSelect
    ),
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-tuning-preset' }, 'Tuning'),
      presetSelect
    ),
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-tuning' }, 'Strings'),
      tuningInput,
      el(
        'p',
        { class: 'ec-help', id: 'instrument-tuning-help' },
        'Lowest string first. Any comma-separated pitch list works, including re-entrant tunings.'
      )
    ),
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
      { class: 'ec-field ec-field-inline' },
      el('label', { for: 'instrument-frets' }, 'Frets'),
      fretsInput
    ),
    error
  );

  const actions = el('div', { class: 'ec-actions' });
  actions.append(
    el(
      'button',
      { type: 'submit', class: 'ec-button ec-button-primary', id: 'instrument-save' },
      editing ? 'Save changes' : firstRun ? 'Start playing' : 'Add instrument'
    )
  );
  if (onCancel) {
    actions.append(
      el(
        'button',
        { type: 'button', class: 'ec-button', id: 'instrument-cancel', onClick: onCancel },
        'Cancel'
      )
    );
  }
  form.append(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
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
    onSubmit({
      catalogId: catalogSelect.value,
      label: name,
      strings,
      fretCount: Number.isFinite(frets) && frets > 0 ? frets : catalogEntry(catalogSelect.value).fretCount,
    });
  });

  container.append(form);
  (editing ? nameInput : catalogSelect).focus();
  return form;
}
