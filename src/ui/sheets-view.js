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
import { layoutSection } from '../core/chart-layout.js';
import { resolveSongVoicings, unvoiceableKeys } from '../core/voicings.js';
import { parseChord } from '../core/notation/parse.js';
import { renderDiagram } from '../render/index.js';
import { EXAMPLE_BODY } from '../state/sheets.js';
import { openVoicingDialog } from './voicing-dialog.js';
import { t } from '../i18n/index.js';

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
    el('h2', { class: 'ec-page-title' }, t('sheets.title')),
    el(
      'p',
      { class: 'ec-help' },
      t('sheets.help', { label: instrument.label })
    )
  );

  const form = el('form', { class: 'ec-newsheet', novalidate: true });
  const input = el('input', {
    type: 'text',
    id: 'new-sheet-title',
    class: 'ec-chord-input',
    placeholder: t('sheets.titlePlaceholder'),
    'aria-label': t('sheets.newTitleLabel'),
    autocomplete: 'off',
  });
  form.append(
    input,
    el('button', { type: 'submit', class: 'ec-button ec-button-primary' }, t('sheets.create'))
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // The starter body goes through createSheet so it gets the tuning written
    // into it; setting the body afterwards would overwrite that.
    const sheet = store.createSheet(input.value.trim() || t('sheets.untitled'), EXAMPLE_BODY);
    onOpen(sheet.id);
  });
  page.append(form);

  if (sheets.length === 0) {
    page.append(el('p', { class: 'ec-empty' }, t('sheets.empty')));
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
              `${t('sheets.measures', { count: bars })} · ${t('sheets.chords', {
                count: song.symbols.length,
              })}`,
              chosen > 0 ? t('sheets.chosenHere', { count: chosen }) : ''
            ),
            voicedFor.length > 0
              ? el('p', { class: 'ec-sheet-meta ec-sheet-voiced' }, t('sheets.voicedFor', { list: voicedFor.join(', ') }))
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
                'aria-label': t('sheets.openLabel', { title: sheet.title }),
                onClick: () => onOpen(sheet.id),
              },
              t('sheets.open')
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                'aria-label': t('sheets.duplicateLabel', { title: sheet.title }),
                onClick: () => {
                  store.duplicateSheet(sheet.id);
                  onChange();
                },
              },
              t('sheets.duplicate')
            ),
            el(
              'button',
              {
                type: 'button',
                class: 'ec-button ec-button-small',
                'aria-label': t('sheets.deleteLabel', { title: sheet.title }),
                onClick: () => {
                  store.deleteSheet(sheet.id);
                  onChange();
                },
              },
              t('sheets.delete')
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
      t('editor.back')
    )
  );

  const title = el('input', {
    type: 'text',
    id: 'sheet-title',
    class: 'ec-sheet-title',
    value: sheet.title,
    'aria-label': t('editor.titleLabel'),
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

  left.append(el('div', { class: 'ec-field' }, el('label', { for: 'sheet-title' }, t('editor.title')), title));

  // --- the song, as text --------------------------------------------------

  const body = el('textarea', {
    id: 'sheet-body',
    class: 'ec-song-input',
    rows: '12',
    spellcheck: 'false',
    autocapitalize: 'off',
    'aria-label': t('editor.song'),
    'aria-describedby': 'song-help',
  });
  body.value = sheet.body;
  body.placeholder = t('editor.placeholder');
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
      el('label', { for: 'sheet-body' }, t('editor.song')),
      body,
      el(
        'p',
        { class: 'ec-help', id: 'song-help' },
        t('editor.help')
      )
    )
  );

  if (song.unknown.length > 0) {
    left.append(
      el('p', { class: 'ec-error', role: 'alert' }, t('editor.notAChord', { list: song.unknown.join(', ') }))
    );
  }
  if (song.problems.length > 0) {
    left.append(
      el(
        'p',
        { class: 'ec-error', role: 'alert' },
        t('editor.badVoicingLines', { list: song.problems.join('; ') })
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
    el('h3', { class: 'ec-panel-title', id: 'sheet-chart' }, t('editor.chart')),
    el('p', { class: 'ec-help' }, t('editor.chartHelp'))
  );

  if (song.sections.length === 0) {
    chart.append(el('p', { class: 'ec-help' }, t('editor.nothingYet')));
  } else {
    for (const section of song.sections) {
      const block = el('div', { class: 'ec-song-section' });
      if (section.name) block.append(el('h4', { class: 'ec-song-section-name' }, section.name));
      // One table per section, a row per line and a column per measure, so the
      // measures line up the way they do on a hand-written chart. A measure
      // with several chords splits its column between them.
      const chordButton = (chord) => {
        const resolution = resolved.get(chord.key);
        const source = resolution?.source ?? null;
        const state =
          source === 'chosen' ? ' is-voiced' : source === 'default' ? ' is-default' : '';
        return el(
          'button',
          {
            type: 'button',
            class: `ec-measure-chord${chord.valid ? '' : ' is-invalid'}${state}`,
            disabled: chord.valid ? null : true,
            'aria-label': `${chord.symbol}${
              chord.index > 1 ? t('editor.chordVoicing', { index: chord.index }) : ''
            }${
              source === 'chosen'
                ? ''
                : t(source === 'default' ? 'editor.chordDefault' : 'editor.chordUnvoiced')
            }${t('editor.chordChoose')}`,
            onClick: () => chooseFor(chord),
          },
          chord.symbol,
          chord.index > 1 ? el('sup', { class: 'ec-footnote' }, String(chord.index)) : null
        );
      };

      // A chart line is a table row, so its measures line up with the lines
      // around it. A sung line flows and wraps instead, because a phone is
      // narrower than a verse and two verses have no columns in common. Both
      // are made of the same segments, which is why choosing a voicing, the
      // footnote marker and the print sheet all work the same in either.
      let table = null;
      const closeTable = () => {
        if (table) block.append(table.el);
        table = null;
      };

      for (const row of layoutSection(section)) {
        if (row.lyrics) {
          closeTable();
          if (row.blank) {
            block.append(el('div', { class: 'ec-song-break' }));
            continue;
          }
          const line = el('div', { class: 'ec-song-sung' });
          for (const cells of row.measures) {
            cells.forEach(({ segment }, j) => {
              const part = el('span', {
                class: `ec-sung-segment${j === 0 ? ' is-measure-start' : ''}`,
              });
              if (segment.chord) part.append(chordButton(segment.chord));
              part.append(el('span', { class: 'ec-sung-words' }, segment.lyric));
              line.append(part);
            });
          }
          block.append(line);
          continue;
        }

        if (!table) {
          const node = el('table', { class: 'ec-song-chart', role: 'presentation' });
          const body = el('tbody');
          node.append(body);
          table = { el: node, body };
        }
        const line = el('tr', { class: 'ec-song-line' });
        for (const cells of row.measures) {
          cells.forEach(({ segment, span }, j) => {
            const cell = el('td', {
              class: `ec-chord-cell${j === 0 ? ' is-measure-start' : ''}`,
              colspan: span > 1 ? String(span) : null,
            });
            line.append(cell);
            if (segment.chord) cell.append(chordButton(segment.chord));
          });
        }
        table.body.append(line);
      }
      closeTable();
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
    el('h3', { class: 'ec-panel-title', id: 'sheet-chords' }, t('editor.voicings')),
    entries.length > 0
      ? el(
          'p',
          { class: 'ec-help' },
          t('editor.voicingsHelp') + (defaults > 0 ? t('editor.voicingsDefaults') : '')
        )
      : null
  );

  if (entries.length === 0) {
    chordsPanel.append(
      el('p', { class: 'ec-help' }, t('editor.voicingsEmpty'))
    );
  } else {
    const grid = el('ul', {
      class: 'ec-grid ec-voicings',
      tabindex: '0',
      'aria-label': t('editor.voicingsList'),
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
              'aria-label':
                t('editor.everywhere', {
                  verb: t(isDefault ? 'editor.choose' : 'editor.change'),
                  key: entry.key,
                }) +
                (isDefault ? t('editor.usingDefault') : '') +
                t('editor.usedIn', { count: usedIn }),
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
              isDefault ? el('span', { class: 'ec-badge ec-badge-default' }, t('editor.default')) : null
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
        t('editor.missing', { label: instrument.label, list: missing.join(', ') })
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
        t('editor.share')
      ),
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'sheet-print', onClick: onPrint },
        t('editor.print')
      )
    ),
    el('div', { class: 'ec-share-slot', id: 'sheet-share-out' })
  );

  container.append(page);
  return page;
}
