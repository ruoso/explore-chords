/**
 * Song sheet editor (docs/DESIGN.md §2.5).
 *
 * An ordered list of sections, each a progression of chord slots, every slot
 * pinned to one specific fingering. Built for a teacher: the printed sheet is
 * a diagram legend plus the progressions, not a lead sheet.
 */

import { el, clear } from './dom.js';
import { newSection, moveSection, sheetLegend } from '../state/sheets.js';

export function renderSheetEditor(container, { store, onChange, onShare, onPrint }) {
  clear(container);
  const instrument = store.effectiveInstrument;
  if (!instrument) return;

  const sheets = store.sheetsFor(instrument.id);
  const sheet = store.activeSheet;

  const panel = el('details', { class: 'ec-sheets', id: 'sheets' });
  panel.append(
    el(
      'summary',
      { class: 'ec-sheets-summary', id: 'sheets-toggle' },
      'Song sheet',
      el('span', { class: 'ec-sheets-count' }, sheet ? sheet.title : String(sheets.length))
    )
  );

  const body = el('div', { class: 'ec-sheets-body' });

  // --- choose or create ---------------------------------------------------

  const chooser = el('div', { class: 'ec-sheet-chooser' });
  const select = el('select', {
    id: 'sheet-select',
    'aria-label': 'Song sheet',
    onChange: () => {
      store.setActiveSheet(select.value || null);
      onChange();
    },
  });
  select.append(el('option', { value: '', selected: !sheet || null }, 'No sheet open'));
  for (const s of sheets) {
    select.append(el('option', { value: s.id, selected: s.id === sheet?.id || null }, s.title));
  }

  chooser.append(
    select,
    el(
      'button',
      {
        type: 'button',
        class: 'ec-button ec-button-small',
        id: 'sheet-new',
        onClick: () => {
          store.createSheet('Untitled song');
          onChange();
        },
      },
      'New sheet'
    )
  );
  body.append(chooser);

  if (!sheet) {
    body.append(
      el(
        'p',
        { class: 'ec-help' },
        `Make a sheet to collect chords for a song on ${instrument.label}, each pinned to the fingering you want taught.`
      )
    );
    panel.append(body);
    container.append(panel);
    return panel;
  }

  // --- title --------------------------------------------------------------

  const title = el('input', {
    type: 'text',
    id: 'sheet-title',
    class: 'ec-sheet-title',
    value: sheet.title,
    'aria-label': 'Song title',
    onChange: (event) => {
      store.updateSheet(sheet.id, (s) => ({ ...s, title: event.target.value }));
      onChange();
    },
  });
  body.append(el('div', { class: 'ec-field' }, el('label', { for: 'sheet-title' }, 'Title'), title));

  // --- sections -----------------------------------------------------------

  const sectionList = el('ol', { class: 'ec-sections' });

  for (const [index, section] of sheet.sections.entries()) {
    const isTarget = section.id === store.state.activeSectionId;

    const header = el(
      'div',
      { class: 'ec-section-header' },
      el('input', {
        type: 'text',
        class: 'ec-section-name',
        value: section.name,
        'aria-label': `Section ${index + 1} name`,
        onChange: (event) => {
          store.updateSheet(sheet.id, (s) => ({
            ...s,
            sections: s.sections.map((x) =>
              x.id === section.id ? { ...x, name: event.target.value } : x
            ),
          }));
          onChange();
        },
      }),
      el(
        'div',
        { class: 'ec-section-actions' },
        el(
          'button',
          {
            type: 'button',
            class: `ec-button ec-button-small${isTarget ? ' is-on' : ''}`,
            'aria-pressed': isTarget ? 'true' : 'false',
            onClick: () => {
              store.setActiveSection(section.id);
              onChange();
            },
          },
          isTarget ? 'Adding here' : 'Add here'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            'aria-label': `Move ${section.name} up`,
            disabled: index === 0 || null,
            onClick: () => {
              store.updateSheet(sheet.id, (s) => moveSection(s, section.id, -1));
              onChange();
            },
          },
          '↑'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            'aria-label': `Move ${section.name} down`,
            disabled: index === sheet.sections.length - 1 || null,
            onClick: () => {
              store.updateSheet(sheet.id, (s) => moveSection(s, section.id, 1));
              onChange();
            },
          },
          '↓'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small',
            'aria-label': `Remove section ${section.name}`,
            onClick: () => {
              store.updateSheet(sheet.id, (s) => ({
                ...s,
                sections: s.sections.filter((x) => x.id !== section.id),
              }));
              onChange();
            },
          },
          'Remove'
        )
      )
    );

    const slots = el('ul', { class: 'ec-slots' });
    if (section.slots.length === 0) {
      slots.append(el('li', { class: 'ec-help' }, 'No chords yet.'));
    }
    for (const slot of section.slots) {
      slots.append(
        el(
          'li',
          { class: 'ec-slot' },
          el('span', { class: 'ec-slot-chord' }, slot.chordText),
          el('span', { class: 'ec-slot-frets' }, slot.frets.join('').replace(/,/g, '')),
          el(
            'button',
            {
              type: 'button',
              class: 'ec-slot-remove',
              'aria-label': `Remove ${slot.chordText} from ${section.name}`,
              onClick: () => {
                store.removeSlot(section.id, slot.id);
                onChange();
              },
            },
            '×'
          )
        )
      );
    }

    sectionList.append(el('li', { class: 'ec-section' }, header, slots));
  }

  body.append(sectionList);

  body.append(
    el(
      'div',
      { class: 'ec-actions' },
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small',
          id: 'sheet-add-section',
          onClick: () => {
            const section = newSection({ name: `Section ${sheet.sections.length + 1}` });
            store.updateSheet(sheet.id, (s) => ({ ...s, sections: [...s.sections, section] }));
            store.setActiveSection(section.id);
            onChange();
          },
        },
        'Add section'
      ),
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'sheet-share', onClick: onShare },
        'Share link'
      ),
      el(
        'button',
        { type: 'button', class: 'ec-button ec-button-small', id: 'sheet-print', onClick: onPrint },
        'Print'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'ec-button ec-button-small',
          onClick: () => {
            store.deleteSheet(sheet.id);
            onChange();
          },
        },
        'Delete sheet'
      )
    )
  );

  body.append(
    el(
      'p',
      { class: 'ec-help', id: 'sheet-legend-count' },
      `${sheetLegend(sheet).length} distinct shapes in this sheet.`
    )
  );

  panel.append(body);
  container.append(panel);
  return panel;
}
