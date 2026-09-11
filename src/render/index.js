/**
 * Diagram rendering entry point (docs/DESIGN.md §6).
 *
 * Caches by content key, as the reference's `svgCache` did: the same fingering
 * drawn with the same options always produces the same string.
 */

import { renderChordBox } from './chord-box.js';
import { renderNeck } from './neck.js';
import { describeFingering, DEFAULT_OPTIONS } from './diagram.js';

/** A small last-recently-used cache, kept from the reference's approach. */
export class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
  }

  get size() {
    return this.map.size;
  }
}

const cache = new LRUCache(500);

/**
 * Render a fingering as SVG, with an accessible description.
 *
 * @param {import('../core/search.js').Fingering} fingering
 * @param {object} context  { chord, dialect, instrument }
 * @param {import('./diagram.js').DiagramOptions} [options]
 * @returns {string} SVG markup
 */
export function renderDiagram(fingering, context = {}, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const label = describeFingering(fingering, context);
  const key = [
    fingering.shorthand,
    fingering.fingers.join(','),
    fingering.barre ? `${fingering.barre.fret}:${fingering.barre.fromString}-${fingering.barre.toString}` : '-',
    opts.orientation,
    opts.handed,
    opts.size,
    label,
  ].join('|');

  const hit = cache.get(key);
  if (hit) return hit;

  const svg =
    opts.orientation === 'horizontal'
      ? renderNeck(fingering, { ...opts, label })
      : renderChordBox(fingering, { ...opts, label });

  cache.set(key, svg);
  return svg;
}

export { renderChordBox, renderNeck, describeFingering };
export { neckInset, boxWidth } from './chord-box.js';
export { diagramModel, FRETS_SHOWN, stringNumber, voicedAsLabel } from './diagram.js';
