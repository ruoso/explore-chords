/**
 * Song sheets: the list, and the editor for one sheet (docs/DESIGN.md §2.5).
 *
 * The editor is one text box holding the whole song, chart and voicings alike.
 * That is how a musician writes a chart out, and it is far quicker than a form
 * for adding and removing sections one at a time.
 *
 * Below it the chart is shown back with every chord as a button: click one to
 * choose how *that* occurrence is played. The choice is written into the text
 * as a footnote — `A | Cm | A | Cm[2]` with a `# Voicings` block — so nothing is
 * hidden from the person typing.
 *
 * The voicings panel is the complement: clicking a shape there changes it
 * everywhere it is used, because re-voicing a chord across a whole song is
 * otherwise a click per bar.
 *
 * A chord nobody has chosen a voicing for still gets one: the shape the
 * explorer would show first. So only the non-obvious chords need choosing, and
 * the text carries only those choices.
 *
 * The chart is the same on every instrument; voicings are kept per tuning in
 * the text. So every song is listed for every instrument, and one with no
 * block for this tuning yet simply shows defaults until something is chosen.
 */

import { el, clear } from './dom.js';
import {
  parseSong,
  setVoicing,
  setVoicingForKey,
  countForKey,
  unvoicedKeys,
  measureCount,
  compareVoicings,
  voicingsFor,
  songTunings,
  normaliseTuning,
} from '../core/song.js';
import { formatTuning } from '../core/instrument.js';
import { resolveSongVoicings, unvoiceableKeys } from '../core/voicings.js';
import { parseChord } from '../core/notation/parse.js';
import { renderDiagram } from '../render/index.js';
import { EXAMPLE_BODY } from '../state/sheets.js';
import { openVoicingDialog } from './voicing-dialog.js';

/** The list of sheets for the active instrument, with create and delete. */
/** The name of whichever of the user's instruments has this tuning, else the tuning. */
function labelForTuning(store, tuning) {
  const id = normaliseTuning(tuning);
  const match = store.state.instruments.find((i) => normaliseTuning(formatTuning(i.strings)) === id);
  return match ? match.label : tuning;
}

export function renderSheetList(container, { store, onOpen, onChange }) {
  clear(container);
  const instrument = store.effectiveInstrument;
  if (!instrument) return;

  const sheets = store.sheetsFor(instrument);
  const tuning = formatTuning(instrument.strings);
  const dialect = store.state.prefs.dialect;

  const page = el('div', { class: 'ec-page' });
  page.append(
    el('h2', { class: 'ec-page-title' }, 'Song sheets'),
    el(
      'p',
      { class: 'ec-help' },
      `Chords for a song on ${instrument.label}, each pinned to the fingering you want taught.`
    )
  );

  const form = el('form', { class: 'ec-newsheet', novalidate: true });
  const input = el('input', {
    type: 'text',
    id: 'new-sheet-title',
    class: 'ec-chord-input',
    placeholder: 'Song title',
    'aria-label': 'New song title',
    autocomplete: 'off',
  });
  form.append(
    input,
    el('button', { type: 'submit', class: 'ec-button ec-button-primary' }, 'New song')
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // The starter body goes through createSheet so it gets the tuning written
    // into it; setting the body afterwards would overwrite that.
    const sheet = store.createSheet(input.value.trim() || 'Untitled song', EXAMPLE_BODY);
    onOpen(sheet.id);
  });
  page.append(form);

  if (sheets.length === 0) {
    page.append(el('p', { class: 'ec-empty' }, 'No songs yet.'));
  } else {
    const list = el('ul', { class: 'ec-sheet-list' });
    for (const sheet of sheets) {
      const song = parseSong(sheet.body, dialect);
      const chosen = song.symbols.length - unvoicedKeys(song, tuning).length;
      const bars = measureCount(song);
      const voicedFor = songTunings(song).map((t) => labelForTuning(store, t));

      list.append(
        el(
          'li',
          { class: 'ec-sheet-row' },
          el(
            'div',
            { class: 'ec-sheet-info' },
            el('p', { class: 'ec-sheet-name' }, sheet.title),
            el(
              'p',
              { class: 'ec-sheet-meta' },
              `${bars} measure${bars === 1 ? '' : 's'} · ${song.symbols.length} chord${
                song.symbols.length === 1 ? '' : 's'
              }`,
              chosen > 0 ? ` · ${chosen} voicing${chosen === 1 ? '' : 's'} chosen here` : ''
            ),
            voicedFor.length > 0
              ? el('p', { class: 'ec-sheet-meta ec-sheet-voiced' }, `Voiced for ${voicedFor.join(', ')}`)
              : null
          ),
          el(
            'div',
            { class: 'ec-sheet-actions' },
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                'aria-label': `Open ${sheet.title}`,
                onClick: () => onOpen(sheet.id),
              },
              'Open'
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                'aria-label': `Duplicate ${sheet.title}`,
                onClick: () => {
                  store.duplicateSheet(sheet.id);
                  onChange();
                },
              },
              'Duplicate'
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                'aria-label': `Delete ${sheet.title}`,
                onClick: () => {
                  store.deleteSheet(sheet.id);
                  onChange();
                },
              },
              'Delete'
            )
          )
        )
      );
    }
    page.append(list);
  }

  container.append(page);
  return page;
}

/** The editor for one sheet. */
export function renderSheetEditor(container, { store, sheet, onChange, onBack, onShare, onPrint }) {
  clear(container);
  const instrument = store.effectiveInstrument;
  if (!sheet || !instrument) return;

  const dialect = store.state.prefs.dialect;
  const tuning = formatTuning(instrument.strings);
  const song = parseSong(sheet.body, dialect);
  const chosenHere = voicingsFor(song, tuning);
  const resolved = resolveSongVoicings(song, instrument, dialect);
  const page = el('div', { class: 'ec-page' });

  page.append(
    el(
      'button',
      {
        type: 'button',
        class: 'ec-button ec-button-small ec-back',
        id: 'sheet-back',
        onClick: onBack,
      },
      '← All songs'
    )
  );

  const title = el('input', {
    type: 'text',
    id: 'sheet-title',
    class: 'ec-sheet-title',
    value: sheet.title,
    'aria-label': 'Song title',
    onChange: (event) => {
      store.updateSheet(sheet.id, (s) => ({ ...s, title: event.target.value }));
      onChange({ keepFocus: true });
    },
  });
  const layout = el('div', { class: 'ec-song-editor' });
  const left = el('div', { class: 'ec-song-editor-main' });
  const right = el('div', { class: 'ec-song-editor-side' });
  layout.append(left, right);
  page.append(layout);

  left.append(el('div', { class: 'ec-field' }, el('label', { for: 'sheet-title' }, 'Title'), title));

  // --- the song, as text --------------------------------------------------

  const body = el('textarea', {
    id: 'sheet-body',
    class: 'ec-song-input',
    rows: '12',
    spellcheck: 'false',
    autocapitalize: 'off',
    'aria-label': 'The song',
    'aria-describedby': 'song-help',
  });
  body.value = sheet.body;
  body.placeholder = '# Verse\nA | Cm | A | Cm';
  body.addEventListener('change', (event) => {
    // Normalised on the way in, so a song pasted in the earlier form converts
    // the moment it is saved rather than lingering half-understood.
    const next = store.normaliseBody(event.target.value, sheet.body);
    store.updateSheet(sheet.id, (s) => ({ ...s, body: next }));
    onChange({ keepFocus: true });
  });

  left.append(
    el(
      'div',
      { class: 'ec-field' },
      el('label', { for: 'sheet-body' }, 'The song'),
      body,
      el(
        'p',
        { class: 'ec-help', id: 'song-help' },
        'A line beginning with # names a section. A vertical bar starts a new measure; ' +
          'spaces separate chords inside one. Voicings sit after a --- rule, one block per ' +
          'tuning, so the same chart serves every instrument. Where a chord is played more ' +
          'than one way, the extra voicings are footnoted — Cm[2]. A chord you have saved a ' +
          'shape for gets that shape when it first appears in the song.'
      )
    )
  );

  if (song.unknown.length > 0) {
    left.append(
      el('p', { class: 'ec-error', role: 'alert' }, `Not a chord: ${song.unknown.join(', ')}`)
    );
  }
  if (song.problems.length > 0) {
    left.append(
      el(
        'p',
        { class: 'ec-error', role: 'alert' },
        `Could not read these voicing lines: ${song.problems.join('; ')}`
      )
    );
  }

  // --- the chart, with every chord clickable ------------------------------

  const chooseFor = (chord) =>
    openVoicingDialog({
      store,
      chordText: chord.symbol,
      instrument,
      chosen: chosenHere.get(chord.key) ?? null,
      current: resolved.get(chord.key)?.fingering.frets ?? null,
      onChoose: (frets) => {
        const next = setVoicing(sheet.body, chord.start, frets, { tuning, dialect });
        store.updateSheet(sheet.id, (s) => ({ ...s, body: next }));
        onChange();
      },
    });

  const chart = el('section', { class: 'ec-panel', 'aria-labelledby': 'sheet-chart' });
  chart.append(
    el('h3', { class: 'ec-panel-title', id: 'sheet-chart' }, 'The chart'),
    el('p', { class: 'ec-help' }, 'Click any chord to choose how that one is played.')
  );

  if (song.sections.length === 0) {
    chart.append(el('p', { class: 'ec-help' }, 'Nothing written yet.'));
  } else {
    for (const section of song.sections) {
      const block = el('div', { class: 'ec-song-section' });
      if (section.name) block.append(el('h4', { class: 'ec-song-section-name' }, section.name));
      for (const line of section.lines) {
        const row = el('p', { class: 'ec-song-line' });
        line.measures.forEach((measure, i) => {
          if (i > 0) row.append(el('span', { class: 'ec-bar', 'aria-hidden': 'true' }, '|'));
          const bar = el('span', { class: 'ec-measure' });
          for (const chord of measure.chords) {
            const resolution = resolved.get(chord.key);
            const source = resolution?.source ?? null;
            const state =
              source === 'chosen' ? ' is-voiced' : source === 'default' ? ' is-default' : '';
            bar.append(
              el(
                'button',
                {
                  type: 'button',
                  class: `ec-measure-chord${chord.valid ? '' : ' is-invalid'}${state}`,
                  disabled: chord.valid ? null : true,
                  'aria-label': `${chord.symbol}${
                    chord.index > 1 ? `, voicing ${chord.index}` : ''
                  }${
                    source === 'chosen'
                      ? ''
                      : source === 'default'
                        ? ', using the default shape'
                        : ', cannot be voiced'
                  }. Choose a voicing.`,
                  onClick: () => chooseFor(chord),
                },
                chord.symbol,
                chord.index > 1
                  ? el('sup', { class: 'ec-footnote' }, String(chord.index))
                  : null
              )
            );
          }
          row.append(bar);
        });
        block.append(row);
      }
      chart.append(block);
    }
  }
  right.append(chart);

  // --- the voicings this song uses ----------------------------------------

  const entries = [...resolved.entries()]
    .map(([key, r]) => {
      const occurrence = song.occurrences.find((c) => c.key === key);
      return { key, symbol: occurrence.symbol, index: occurrence.index, ...r };
    })
    .sort(compareVoicings);
  const missing = unvoiceableKeys(song, resolved);
  const defaults = entries.filter((e) => e.source === 'default').length;

  const chordsPanel = el('section', { class: 'ec-panel', 'aria-labelledby': 'sheet-chords' });
  chordsPanel.append(
    el('h3', { class: 'ec-panel-title', id: 'sheet-chords' }, 'Voicings'),
    entries.length > 0
      ? el(
          'p',
          { class: 'ec-help' },
          'Click a shape to change it everywhere it is used.' +
            (defaults > 0
              ? ' Shapes marked default are what the explorer would show first; choose only the ones that need it.'
              : '')
        )
      : null
  );

  if (entries.length === 0) {
    chordsPanel.append(
      el('p', { class: 'ec-help' }, 'Write the song above and its chords appear here.')
    );
  } else {
    const grid = el('ul', {
      class: 'ec-grid ec-voicings',
      tabindex: '0',
      'aria-label': 'Voicings used in this song',
    });

    for (const entry of entries) {
      const chord = parseChord(entry.symbol, dialect).chord;
      const usedIn = countForKey(song, entry.key);
      const isDefault = entry.source === 'default';

      grid.append(
        el(
          'li',
          { class: `ec-card${isDefault ? ' is-default' : ''}`, 'data-key': entry.key },
          el(
            'button',
            {
              type: 'button',
              class: 'ec-voicing-choice',
              'aria-label': `${isDefault ? 'Choose' : 'Change'} ${entry.key} everywhere. ${
                isDefault ? 'Using the default shape. ' : ''
              }Used in ${usedIn} place${usedIn === 1 ? '' : 's'}.`,
              onClick: () =>
                openVoicingDialog({
                  store,
                  chordText: entry.symbol,
                  label: entry.key,
                  instrument,
                  chosen: isDefault ? null : entry.fingering.frets,
                  current: entry.fingering.frets,
                  scope: 'all',
                  usedIn,
                  onChoose: (frets) => {
                    const next = setVoicingForKey(sheet.body, entry.key, frets, { tuning, dialect });
                    store.updateSheet(sheet.id, (s) => ({ ...s, body: next }));
                    onChange();
                  },
                }),
            },
            el(
              'span',
              { class: 'ec-card-chord' },
              entry.key,
              isDefault ? el('span', { class: 'ec-badge ec-badge-default' }, 'default') : null
            ),
            el('span', {
              class: 'ec-card-diagram',
              html: renderDiagram(
                entry.fingering,
                { chord, dialect, instrument },
                { orientation: store.state.prefs.orientation, handed: store.state.prefs.handed }
              ),
            }),
            el(
              'span',
              { class: 'ec-caption' },
              el('span', { class: 'ec-shorthand' }, entry.fingering.shorthand),
              el('span', { class: 'ec-used-in' }, `${usedIn}\u00d7`)
            )
          )
        )
      );
    }
    chordsPanel.append(grid);
  }

  if (missing.length > 0) {
    chordsPanel.append(
      el(
        'p',
        { class: 'ec-error', role: 'alert', id: 'sheet-missing' },
        `No playable shape on ${instrument.label} for: ${missing.join(', ')}. ` +
          'Its voicing rules may be too strict.'
      )
    );
  }
  right.append(chordsPanel);

  right.append(
    el(
      'div',
      { class: 'ec-actions' },
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'sheet-share', onClick: onShare },
        'Share link'
      ),
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'sheet-print', onClick: onPrint },
        'Print'
      )
    ),
    el('div', { class: 'ec-share-slot', id: 'sheet-share-out' })
  );

  container.append(page);
  return page;
}
