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
import { t, hasMessage, errorText } from '../i18n/index.js';

const CUSTOM = '__custom__';

/** Catalog entries and preset tunings are named by id; a name we have no text for shows as is. */
export function catalogName(entry) {
  return hasMessage(`catalog.${entry.id}`) ? t(`catalog.${entry.id}`) : entry.name;
}
export function tuningName(name) {
  return hasMessage(['tuning', name]) ? t(['tuning', name]) : name;
}

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
      t(editing ? 'form.edit' : firstRun ? 'form.choose' : 'form.add')
    )
  );
  if (!editing) {
    form.append(
      el(
        'p',
        { class: 'ec-help' },
        t(firstRun ? 'form.firstRunHelp' : 'form.addHelp')
      )
    );
  }

  // --- instrument type ----------------------------------------------------

  const catalogSelect = el('select', { id: 'instrument-catalog', name: 'catalog' });
  for (const entry of CATALOG) {
    catalogSelect.append(
      el('option', { value: entry.id, selected: entry.id === startingCatalog || null }, catalogName(entry))
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
    const found = entry?.tunings.find((tuning) => tuning.name === presetSelect.value);
    const preset = presetSelect.value === CUSTOM || !found ? t('tuning.custom') : tuningName(found.name);
    return `${entry ? catalogName(entry) : t('form.fallbackName')} · ${preset}`;
  }

  function refreshName() {
    if (!nameIsUsers) nameInput.value = suggestedName();
  }

  function fillPresets({ keepTuning = false } = {}) {
    const entry = catalogEntry(catalogSelect.value);
    clear(presetSelect);
    for (const tuning of entry.tunings) {
      presetSelect.append(el('option', { value: tuning.name }, `${tuningName(tuning.name)} — ${tuning.strings}`));
    }
    presetSelect.append(el('option', { value: CUSTOM }, t('tuning.customOption')));

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
      const tuning = entry.tunings.find((candidate) => candidate.name === presetSelect.value);
      if (tuning) tuningInput.value = tuning.strings;
    }
    refreshName();
  });

  // Typing a tuning by hand means it is no longer one of the presets.
  tuningInput.addEventListener('input', () => {
    const entry = catalogEntry(catalogSelect.value);
    const match = entry?.tunings.find((candidate) => candidate.strings === tuningInput.value.trim());
    presetSelect.value = match ? match.name : CUSTOM;
    refreshName();
  });

  fillPresets();

  // When editing, the stored values win over the catalog defaults.
  if (instrument) {
    const entry = catalogEntry(instrument.catalogId);
    const match = entry?.tunings.find((candidate) => candidate.strings === startingTuning);
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
      el('label', { for: 'instrument-catalog' }, t('form.instrument')),
      catalogSelect
    ),
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-tuning-preset' }, t('form.tuning')),
      presetSelect
    ),
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-tuning' }, t('form.strings')),
      tuningInput,
      el(
        'p',
        { class: 'ec-help', id: 'instrument-tuning-help' },
        t('form.stringsHelp')
      )
    ),
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'instrument-name' }, t('form.name')),
      nameInput,
      el(
        'p',
        { class: 'ec-help' },
        t('form.nameHelp')
      )
    ),
    el(
      'div',
      { class: 'ec-field ec-field-inline' },
      el('label', { for: 'instrument-frets' }, t('form.frets')),
      fretsInput
    ),
    error
  );

  const actions = el('div', { class: 'ec-actions' });
  actions.append(
    el(
      'button',
      { type: 'submit', class: 'ec-button ec-button-primary', id: 'instrument-save' },
      t(editing ? 'form.save' : firstRun ? 'form.start' : 'form.addButton')
    )
  );
  if (onCancel) {
    actions.append(
      el(
        'button',
        { type: 'button', class: 'ec-button', id: 'instrument-cancel', onClick: onCancel },
        t('form.cancel')
      )
    );
  }
  form.append(actions);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;

    const name = nameInput.value.trim();
    if (!name) {
      error.textContent = t('form.needName');
      error.hidden = false;
      nameInput.focus();
      return;
    }

    let strings;
    try {
      strings = parseTuning(tuningInput.value);
    } catch (e) {
      error.textContent = t('form.badTuning', { reason: errorText(e) });
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
