/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance } from '../core/instrument.js';
import { searchFingerings, allFingerings } from '../core/search.js';
import { renderDiagram, renderChordBox, renderNeck, describeFingering } from './index.js';
import { diagramModel } from './diagram.js';

const guitar = instrumentInstance({
  catalogId: '6guitar',
  label: 'Guitar · Standard',
  strings: 'E2, A2, D3, G3, B3, E4',
  fretCount: 22,
});

function find(symbol, shorthand, instrument = guitar) {
  const chord = parseChord(symbol).chord;
  const result = searchFingerings(chord, instrument);
  const fingering = allFingerings(result).find((f) => f.shorthand === shorthand);
  if (!fingering) throw new Error(`${symbol} ${shorthand} not found`);
  return { chord, fingering };
}

describe('chord box', () => {
  it('renders open C stably', () => {
    const { chord, fingering } = find('C', 'x32010');
    expect(renderDiagram(fingering, { chord, instrument: guitar })).toMatchSnapshot();
  });

  it('renders the F barre stably', () => {
    const { chord, fingering } = find('F', '133211');
    expect(renderDiagram(fingering, { chord, instrument: guitar })).toMatchSnapshot();
  });

  it('shows an X for muted and an O for open strings', () => {
    const { fingering } = find('C', 'x32010');
    const svg = renderChordBox(fingering);
    // Distinct glyphs, so the distinction survives without colour (§6.1).
    expect(svg).toContain('class="ec-muted"');
    expect(svg).toContain('class="ec-open"');
  });

  it('prints finger numbers on the dots', () => {
    const { fingering } = find('C', 'x32010');
    const svg = renderChordBox(fingering);
    for (const finger of [1, 2, 3]) {
      expect(svg).toContain(`>${finger}</text>`);
    }
  });

  it('draws a barre as one bar, not a row of separate dots', () => {
    const { fingering } = find('F', '133211');
    const svg = renderChordBox(fingering);
    expect(svg).toContain('class="ec-barre"');
    // Three strings sit at fret 1; a barre covers them with one shape, so the
    // only circles left are the notes above it.
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(3);
  });

  it('labels the starting fret only when the shape leaves the nut', () => {
    const { fingering: open } = find('C', 'x32010');
    expect(renderChordBox(open)).not.toContain('ec-fretnum');

    const chord = parseChord('C').chord;
    const high = allFingerings(searchFingerings(chord, guitar)).find((f) => f.position >= 5);
    expect(renderChordBox(high)).toContain('ec-fretnum');
  });
});

describe('left-handed rendering is an exact mirror', () => {
  it('reverses the string order and nothing else', () => {
    const { fingering } = find('C', 'x32010');
    const right = diagramModel(fingering, { handed: 'right' });
    const left = diagramModel(fingering, { handed: 'left' });

    const n = fingering.frets.length - 1;
    for (const dot of right.dots) {
      const mirrored = left.dots.find((d) => d.stringIndex === n - dot.stringIndex);
      expect(mirrored).toBeDefined();
      expect(mirrored.fret).toBe(dot.fret);
      expect(mirrored.finger).toBe(dot.finger);
    }
    expect(left.markers.length).toBe(right.markers.length);
    expect(left.startFret).toBe(right.startFret);
  });

  it('mirrors a barre span', () => {
    const { fingering } = find('F', '133211');
    const left = diagramModel(fingering, { handed: 'left' });
    expect(left.barre.fromString).toBeLessThanOrEqual(left.barre.toString);
    expect(left.barre.fret).toBe(fingering.barre.fret);
  });
});

describe('horizontal neck', () => {
  it('renders and differs from the vertical box', () => {
    const { chord, fingering } = find('C', 'x32010');
    const horizontal = renderDiagram(
      fingering,
      { chord, instrument: guitar },
      { orientation: 'horizontal' }
    );
    expect(horizontal).toContain('ec-diagram-horizontal');
    expect(horizontal).toMatchSnapshot();
  });

  it('keeps the same dots as the vertical view', () => {
    const { fingering } = find('F', '133211');
    const v = renderChordBox(fingering).match(/<circle/g) ?? [];
    const h = renderNeck(fingering).match(/<circle/g) ?? [];
    expect(h.length).toBe(v.length);
  });
});

describe('accessible description', () => {
  it('describes open C the way a sighted reader would see it', () => {
    const { chord, fingering } = find('C', 'x32010');
    const text = describeFingering(fingering, {
      chord,
      dialect: 'american',
      instrument: guitar,
    });
    expect(text).toContain('C');
    expect(text).toContain('x32010');
    expect(text).toContain('open position');
    expect(text).toContain('fingers 3-2-1');
    expect(text).toContain('root on the 5th string');
  });

  it('describes a barre', () => {
    const { chord, fingering } = find('F', '133211');
    const text = describeFingering(fingering, { chord, instrument: guitar });
    expect(text).toMatch(/barre across 6 strings at fret 1/);
  });

  it('gives every diagram a non-empty label', () => {
    const chord = parseChord('Cmaj7').chord;
    for (const f of allFingerings(searchFingerings(chord, guitar))) {
      const svg = renderDiagram(f, { chord, instrument: guitar });
      const label = /aria-label="([^"]*)"/.exec(svg)?.[1];
      expect(label, f.shorthand).toBeTruthy();
      expect(label.length).toBeGreaterThan(10);
      expect(svg).toContain('role="img"');
    }
  });

  it('escapes markup in labels', () => {
    const { fingering } = find('C', 'x32010');
    const svg = renderChordBox(fingering, { label: 'a <script> & "quote"' });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
  });
});

describe('axe finds no violations on a page of diagrams', () => {
  it('passes an accessibility scan', async () => {
    const chord = parseChord('C').chord;
    const fingerings = allFingerings(searchFingerings(chord, guitar)).slice(0, 6);

    document.body.innerHTML = `
      <main>
        <h1>Explore Chords</h1>
        <section aria-labelledby="g1">
          <h2 id="g1">Open position</h2>
          <ul class="ec-grid">
            ${fingerings
              .map(
                (f) => `<li>
                  <figure>
                    ${renderDiagram(f, { chord, instrument: guitar })}
                    <figcaption>${f.shorthand} &middot; ${f.difficulty}</figcaption>
                  </figure>
                </li>`
              )
              .join('')}
          </ul>
        </section>
      </main>`;

    const results = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } }, // jsdom cannot compute colour
    });
    const violations = results.violations.map((v) => `${v.id}: ${v.description}`);
    expect(violations).toEqual([]);
  }, 20000);
});
