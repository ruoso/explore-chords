/**
 * Horizontal neck diagram (docs/DESIGN.md §2.3, §6).
 *
 * The same model as the chord box, transposed: strings run left to right and
 * frets run down the page in the vertical view, and the reverse here. Sharing
 * `diagramModel` is what keeps left-handed mirroring a single decision.
 */

import { diagramModel, esc } from './diagram.js';

const UNIT = 16;

/**
 * @param {import('../core/search.js').Fingering} fingering
 * @param {object} [options]
 * @returns {string} SVG markup
 */
export function renderNeck(fingering, options = {}) {
  const model = diagramModel(fingering, { ...options, orientation: 'horizontal' });
  const { stringCount, fretsShown, startFret, showNut, size } = model;

  const marginLeft = UNIT * 1.4; // room for the X and O column
  // Room for a fret number whether or not there is one, so a row of necks is
  // the same height whatever part of the neck each one sits on.
  const marginTop = UNIT * 1.0;
  const gridWidth = fretsShown * UNIT;
  const gridHeight = (stringCount - 1) * UNIT;
  const width = marginLeft + gridWidth + UNIT * 0.4;
  const height = marginTop + gridHeight + UNIT * 0.6;

  // Strings run horizontally; the first string in display order sits at the top.
  const y = (stringIndex) => marginTop + stringIndex * UNIT;
  const x = (col) => marginLeft + col * UNIT;

  const out = [];

  for (let f = 0; f <= fretsShown; f += 1) {
    const thick = f === 0 && showNut;
    out.push(
      `<line x1="${x(f)}" y1="${y(0)}" x2="${x(f)}" y2="${y(stringCount - 1)}" ` +
        `class="ec-fret${thick ? ' ec-nut' : ''}" />`
    );
  }

  for (let s = 0; s < stringCount; s += 1) {
    out.push(
      `<line x1="${x(0)}" y1="${y(s)}" x2="${x(fretsShown)}" y2="${y(s)}" class="ec-string" />`
    );
  }

  if (startFret > 1) {
    out.push(
      `<text x="${x(0.5)}" y="${marginTop - UNIT * 0.35}" class="ec-fretnum" ` +
        `text-anchor="middle">${startFret}</text>`
    );
  }

  for (const marker of model.markers) {
    const cy = y(marker.stringIndex);
    const cx = marginLeft - UNIT * 0.55;
    if (marker.kind === 'open') {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${UNIT * 0.22}" class="ec-open" />`);
    } else {
      const r = UNIT * 0.2;
      out.push(
        `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" class="ec-muted" />`
      );
    }
  }

  if (model.barre) {
    const by = y(model.barre.fromString);
    const bh = y(model.barre.toString) - by;
    const bx = x(model.barre.row + 0.5);
    const r = UNIT * 0.3;
    out.push(
      `<rect x="${bx - r}" y="${by - r}" width="${r * 2}" height="${bh + r * 2}" ` +
        `rx="${r}" class="ec-barre" />`
    );
    if (model.barre.finger) {
      out.push(
        `<text x="${bx}" y="${by + bh / 2 + 4}" class="ec-finger" text-anchor="middle">` +
          `${model.barre.finger}</text>`
      );
    }
  }

  for (const dot of model.dots) {
    const cy = y(dot.stringIndex);
    const cx = x(dot.row + 0.5);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${UNIT * 0.3}" class="ec-dot" />`);
    if (dot.finger) {
      out.push(
        `<text x="${cx}" y="${cy + 4}" class="ec-finger" text-anchor="middle">${dot.finger}</text>`
      );
    }
  }

  const label = options.label ?? fingering.shorthand;

  return (
    `<svg class="ec-diagram ec-diagram-horizontal" role="img" aria-label="${esc(label)}" ` +
    `viewBox="0 0 ${width} ${height}" width="${width * size}" height="${height * size}" ` +
    `xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`
  );
}
