/**
 * Chord entry (docs/DESIGN.md §2.2).
 *
 * Two entry points, always in sync: typing updates the pickers, picking updates
 * the text. Neither asks which instrument it means — the instrument is ambient
 * context, not a query parameter.
 *
 * Genuinely ambiguous input surfaces a chip showing which reading was taken and
 * offering the other, rather than guessing silently or refusing outright.
 */

import { el, clear } from './dom.js';
import { chord as makeChord } from '../core/chord.js';
import { parseNote, formatNote } from '../core/pitch.js';
import { formatChord } from '../core/notation/format.js';
import { READING_LABELS } from '../core/notation/dialects.js';
import { t, hasMessage, errorText } from '../i18n/index.js';

const ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

/** Picker options, named by their translation keys. */
const QUALITIES = ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', 'power'];
const SEVENTHS = ['none', 'dominant', 'major', 'diminished'];

/** How a reading of an ambiguous symbol is described, in the user's language. */
function readingLabel(kind, reading) {
  const key = `readings.${kind}.${reading}`;
  if (hasMessage(key)) return t(key);
  return READING_LABELS[kind]?.[reading] ?? reading;
}

/** Extension chips, as degree/alteration pairs. */
const EXTENSIONS = [
  { key: '6', degree: 6, alter: 0, label: '6' },
  { key: '9', degree: 9, alter: 0, label: '9' },
  { key: '11', degree: 11, alter: 0, label: '11' },
  { key: '13', degree: 13, alter: 0, label: '13' },
  { key: 'b5', degree: 5, alter: -1, label: '♭5' },
  { key: '#5', degree: 5, alter: 1, label: '♯5' },
  { key: 'b9', degree: 9, alter: -1, label: '♭9' },
  { key: '#9', degree: 9, alter: 1, label: '♯9' },
  { key: '#11', degree: 11, alter: 1, label: '♯11' },
  { key: 'b13', degree: 13, alter: -1, label: '♭13' },
];

/** Read a chord back into picker positions, so the two stay in sync. */
export function chordToPickers(chord) {
  if (!chord) {
    return { root: 'C', quality: 'major', seventh: 'none', extensions: [], bass: '' };
  }
  const byDegree = new Map(chord.extensions.map((e) => [e.degree, e.alter]));

  let seventh = 'none';
  if (byDegree.has(7)) {
    const alter = byDegree.get(7);
    seventh = alter === 0 ? 'major' : alter === -2 ? 'diminished' : 'dominant';
  }

  const extensions = EXTENSIONS.filter(
    (ext) => byDegree.get(ext.degree) === ext.alter && !(ext.degree === 7)
  ).map((ext) => ext.key);

  return {
    root: formatNote(chord.root),
    quality: chord.quality,
    seventh,
    extensions,
    bass: chord.bass ? formatNote(chord.bass) : '',
  };
}

/** Build a chord from picker positions. */
export function pickersToChord(pickers) {
  const extensions = [];
  if (pickers.seventh !== 'none') {
    const alter = pickers.seventh === 'major' ? 0 : pickers.seventh === 'diminished' ? -2 : -1;
    extensions.push({ degree: 7, alter });
  }
  for (const key of pickers.extensions) {
    const ext = EXTENSIONS.find((e) => e.key === key);
    if (ext) extensions.push({ degree: ext.degree, alter: ext.alter });
  }
  return makeChord(
    parseNote(pickers.root),
    pickers.quality,
    extensions,
    pickers.bass ? parseNote(pickers.bass) : null
  );
}

/**
 * @param {HTMLElement} container
 * @param {object} options
 * @param {object} options.store
 * @param {(text: string) => void} options.onChange   live, as the user types
 * @param {(kind: string, reading: string) => void} options.onReading
 */
export function renderChordInput(container, { store, onChange, onReading }) {
  clear(container);
  const state = store.state;
  const pickers = chordToPickers(state.chord);

  const form = el('form', { class: 'ec-chordform', novalidate: true });

  const input = el('input', {
    id: 'chord-input',
    name: 'chord',
    type: 'text',
    class: 'ec-chord-input',
    value: state.chordText,
    placeholder: t('input.placeholder'),
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-describedby': 'chord-status',
  });

  form.append(
    el('label', { for: 'chord-input', class: 'ec-visually-hidden' }, t('input.label')),
    input,
    el('button', { type: 'submit', class: 'ec-button ec-button-primary' }, t('input.show'))
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onChange(input.value.trim(), 'text');
  });

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    // Debounced so every keystroke does not launch a search, but short enough
    // that the results feel live.
    timer = setTimeout(() => onChange(input.value.trim(), 'text'), 250);
  });

  container.append(form);

  // --- status line: errors and ambiguity ---------------------------------

  const status = el('div', { class: 'ec-chord-status', id: 'chord-status' });

  if (state.errors.length > 0) {
    status.append(
      el('p', { class: 'ec-error', role: 'alert' }, errorText(state.errors[0]))
    );
  }

  for (const ambiguity of state.ambiguities) {
        const alternative = ambiguity.alternatives[0];
    status.append(
      el(
        'p',
        { class: 'ec-ambiguity' },
        el('span', { class: 'ec-ambiguity-icon', 'aria-hidden': 'true' }, 'ⓘ'),
        t('input.readAs', { text: ambiguity.text, reading: readingLabel(ambiguity.kind, ambiguity.chosen) }),
        alternative
          ? el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small ec-ambiguity-flip',
                onClick: () => onReading(ambiguity.kind, alternative),
              },
              t('input.use', { reading: readingLabel(ambiguity.kind, alternative) })
            )
          : null
      )
    );
  }

  container.append(status);

  /**
   * Redraw only the status line.
   *
   * The input area is built once and then updated in place. Rebuilding it on
   * every change would destroy whichever control the user is currently using —
   * losing focus mid-interaction, which is a real accessibility problem (§6.1)
   * and not merely untidy.
   */
  function renderStatus() {
    clear(status);
    const s = store.state;
    if (s.errors.length > 0) {
      status.append(el('p', { class: 'ec-error', role: 'alert' }, errorText(s.errors[0])));
    }
    for (const ambiguity of s.ambiguities) {
            const alternative = ambiguity.alternatives[0];
      status.append(
        el(
          'p',
          { class: 'ec-ambiguity' },
          el('span', { class: 'ec-ambiguity-icon', 'aria-hidden': 'true' }, 'ⓘ'),
          t('input.readAs', { text: ambiguity.text, reading: readingLabel(ambiguity.kind, ambiguity.chosen) }),
          alternative
            ? el(
                'button',
                {
                  type: 'button',
                  class: 'ec-button ec-button-small ec-ambiguity-flip',
                  onClick: () => onReading(ambiguity.kind, alternative),
                },
                t('input.use', { reading: readingLabel(ambiguity.kind, alternative) })
              )
            : null
        )
      );
    }
  }

  // --- structured pickers -------------------------------------------------

  const details = el('details', { class: 'ec-pickers', open: state.pickersOpen || null });
  details.append(el('summary', { class: 'ec-pickers-summary' }, t('input.build')));

  const grid = el('div', { class: 'ec-pickers-grid' });

  const emit = () => {
    const next = readPickers();
    try {
      const chord = pickersToChord(next);
      onChange(formatChord(chord, store.state.prefs.dialect), 'picker');
    } catch {
      // A picker combination that cannot make a chord is simply ignored.
    }
  };

  const rootSelect = el('select', { id: 'picker-root', onChange: emit });
  for (const note of ROOTS) {
    rootSelect.append(el('option', { value: note, selected: note === pickers.root || null }, note));
  }

  const qualitySelect = el('select', { id: 'picker-quality', onChange: emit });
  for (const value of QUALITIES) {
    qualitySelect.append(
      el('option', { value, selected: value === pickers.quality || null }, t(`quality.${value}`))
    );
  }

  const seventhSelect = el('select', { id: 'picker-seventh', onChange: emit });
  for (const value of SEVENTHS) {
    seventhSelect.append(
      el('option', { value, selected: value === pickers.seventh || null }, t(`seventh.${value}`))
    );
  }

  const bassSelect = el('select', { id: 'picker-bass', onChange: emit });
  bassSelect.append(el('option', { value: '', selected: pickers.bass === '' || null }, t('input.bassRoot')));
  for (const note of ROOTS) {
    bassSelect.append(el('option', { value: note, selected: note === pickers.bass || null }, note));
  }

  grid.append(
    el('div', { class: 'ec-field' }, el('label', { for: 'picker-root' }, t('input.root')), rootSelect),
    el('div', { class: 'ec-field' }, el('label', { for: 'picker-quality' }, t('input.quality')), qualitySelect),
    el('div', { class: 'ec-field' }, el('label', { for: 'picker-seventh' }, t('input.seventh')), seventhSelect),
    el('div', { class: 'ec-field' }, el('label', { for: 'picker-bass' }, t('input.bass')), bassSelect)
  );

  const chipGroup = el('fieldset', { class: 'ec-chips' });
  chipGroup.append(el('legend', {}, t('input.extensions')));
  const chipBoxes = [];
  for (const ext of EXTENSIONS) {
    const id = `ext-${ext.key.replace(/[^a-z0-9]/gi, '')}`;
    const box = el('input', {
      type: 'checkbox',
      id,
      value: ext.key,
      checked: pickers.extensions.includes(ext.key) || null,
      onChange: emit,
    });
    chipBoxes.push(box);
    chipGroup.append(el('label', { class: 'ec-chip-toggle', for: id }, box, ext.label));
  }

  function readPickers() {
    return {
      root: rootSelect.value,
      quality: qualitySelect.value,
      seventh: seventhSelect.value,
      extensions: chipBoxes.filter((b) => b.checked).map((b) => b.value),
      bass: bassSelect.value,
    };
  }

  details.append(grid, chipGroup);
  details.addEventListener('toggle', () => {
    store.state.pickersOpen = details.open;
  });
  container.append(details);

  /** Move the pickers to match a chord that arrived from the text field. */
  function syncFromChord(chord) {
    const next = chordToPickers(chord);
    if (document.activeElement === rootSelect) return; // do not fight the user
    rootSelect.value = next.root;
    qualitySelect.value = next.quality;
    seventhSelect.value = next.seventh;
    bassSelect.value = next.bass;
    for (const box of chipBoxes) box.checked = next.extensions.includes(box.value);
  }

  /** Set the text field without firing the debounced input handler. */
  function setText(text) {
    if (input.value !== text) input.value = text;
  }

  return { input, focus: () => input.focus(), renderStatus, syncFromChord, setText };
}
