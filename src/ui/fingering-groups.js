/**
 * Grouped, ranked fingerings (docs/DESIGN.md §2.4).
 *
 * Shared by the chord explorer and the song's voicing picker so the two cannot
 * drift: a shape is in the same place, in the same order, under the same
 * heading, wherever you are looking at it. The picker used to render a flat
 * list, which meant the same search read differently in two screens.
 *
 * Position groups run open first, then up the neck. Deliberately not CAGED-style
 * roman numerals: those assume a guitar in standard tuning.
 */

import { el } from './dom.js';

export function positionLabel(position) {
  return position === 0 ? 'Open position' : `Fret ${position}`;
}

/**
 * @param {HTMLElement} container
 * @param {object} options
 * @param {{position:number, fingerings:object[], displayCount:number, total:number}[]} options.groups
 * @param {Record<number, boolean>} [options.expanded]
 * @param {(position:number) => void} [options.onToggleGroup]
 * @param {(fingering:object) => Node} options.renderItem
 * @param {string} [options.idPrefix]  so two grids on one page keep unique ids
 */
export function renderFingeringGroups(
  container,
  { groups, expanded = {}, onToggleGroup, renderItem, idPrefix = 'group' }
) {
  for (const group of groups) {
    const headingId = `${idPrefix}-${group.position}`;
    const isExpanded = Boolean(expanded[group.position]);
    const shown = isExpanded ? group.fingerings : group.fingerings.slice(0, group.displayCount);

    const section = el('section', { class: 'ec-group', 'aria-labelledby': headingId });
    section.append(
      el(
        'h3',
        { class: 'ec-group-title', id: headingId },
        positionLabel(group.position),
        el('span', { class: 'ec-group-count' }, ` ${group.total}`)
      )
    );

    const list = el('ul', {
      class: 'ec-grid',
      tabindex: '0',
      role: 'list',
      'aria-label': `${positionLabel(group.position)} fingerings`,
    });
    for (const fingering of shown) list.append(renderItem(fingering));
    section.append(list);

    if (onToggleGroup && group.fingerings.length > group.displayCount) {
      section.append(
        el(
          'button',
          {
            type: 'button',
            class: 'ec-button ec-button-small ec-showmore',
            'aria-expanded': isExpanded ? 'true' : 'false',
            onClick: () => onToggleGroup(group.position),
          },
          isExpanded ? 'Show fewer' : `Show all ${group.fingerings.length}`
        )
      );
    }

    container.append(section);
  }
}
