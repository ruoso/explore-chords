/**
 * Vertical chord-box diagram (docs/DESIGN.md §6).
 *
 * SVG rather than canvas, so printing and export are the same string that is
 * already on screen. Colours come from CSS custom properties so light, dark and
 * print run off one set of tokens, and no information is carried by colour
 * alone — the X and O are distinct glyphs, not a red dot and a green one.
 */

import { diagramModel, esc } from './diagram.js';

const UNIT = 16; // spacing between strings and frets, before scaling

/**
 * @param {import('../core/search.js').Fingering} fingering
 * @param {object} [options]  DiagramOptions plus { label } for the aria-label
 * @returns {string} SVG markup
 */
export function renderChordBox(fingering, options = {}) {
  const model = diagramModel(fingering, options);
  const { stringCount, fretsShown, startFret, showNut, size } = model;

  const marginTop = UNIT * 1.4; // room for the X and O row
  const marginLeft = startFret > 1 ? UNIT * 1.2 : UNIT * 0.6;
  const gridWidth = (stringCount - 1) * UNIT;
  const gridHeight = fretsShown * UNIT;
  const width = marginLeft + gridWidth + UNIT * 0.6;
  const height = marginTop + gridHeight + UNIT * 0.4;

  const x = (stringIndex) => marginLeft + stringIndex * UNIT;
  const y = (row) => marginTop + row * UNIT;

  const out = [];

  // Frets
  for (let f = 0; f <= fretsShown; f += 1) {
    const thick = f === 0 && showNut;
    out.push(
      `<line x1="${x(0)}" y1="${y(f)}" x2="${x(stringCount - 1)}" y2="${y(f)}" ` +
        `class="ec-fret${thick ? ' ec-nut' : ''}" />`
    );
  }

  // Strings
  for (let s = 0; s < stringCount; s += 1) {
    out.push(
      `<line x1="${x(s)}" y1="${y(0)}" x2="${x(s)}" y2="${y(fretsShown)}" class="ec-string" />`
    );
  }

  // Starting fret label, when the shape does not sit at the nut
  if (startFret > 1) {
    out.push(
      `<text x="${marginLeft - UNIT * 0.55}" y="${y(0.5) + 4}" class="ec-fretnum" ` +
        `text-anchor="middle">${startFret}</text>`
    );
  }

  // Open and muted markers above the nut
  for (const marker of model.markers) {
    const cx = x(marker.stringIndex);
    const cy = marginTop - UNIT * 0.45;
    if (marker.kind === 'open') {
      out.push(`<circle cx="${cx}" cy="${cy}" r="${UNIT * 0.22}" class="ec-open" />`);
    } else {
      const r = UNIT * 0.2;
      out.push(
        `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" class="ec-muted" />`
      );
    }
  }

  // The barre, drawn as one bar rather than a row of separate dots
  if (model.barre) {
    const bx = x(model.barre.fromString);
    const bw = x(model.barre.toString) - bx;
    const by = y(model.barre.row + 0.5);
    const r = UNIT * 0.3;
    out.push(
      `<rect x="${bx - r}" y="${by - r}" width="${bw + r * 2}" height="${r * 2}" ` +
        `rx="${r}" class="ec-barre" />`
    );
    if (model.barre.finger) {
      out.push(
        `<text x="${bx + bw / 2}" y="${by + 4}" class="ec-finger" text-anchor="middle">` +
          `${model.barre.finger}</text>`
      );
    }
  }

  // Fingered notes
  for (const dot of model.dots) {
    const cx = x(dot.stringIndex);
    const cy = y(dot.row + 0.5);
    out.push(`<circle cx="${cx}" cy="${cy}" r="${UNIT * 0.3}" class="ec-dot" />`);
    if (dot.finger) {
      out.push(
        `<text x="${cx}" y="${cy + 4}" class="ec-finger" text-anchor="middle">${dot.finger}</text>`
      );
    }
  }

  const label = options.label ?? fingering.shorthand;
  const w = width * size;
  const h = height * size;

  return (
    `<svg class="ec-diagram ec-diagram-vertical" role="img" aria-label="${esc(label)}" ` +
    `viewBox="0 0 ${width} ${height}" width="${w}" height="${h}" ` +
    `xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`
  );
}
