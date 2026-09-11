/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import axe from 'axe-core';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance } from '../core/instrument.js';
import { searchFingerings, allFingerings, fingeringFromFrets } from '../core/search.js';
import {
  renderDiagram,
  renderChordBox,
  renderNeck,
  describeFingering,
  voicedAsLabel,
} from './index.js';
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

/**
 * A shape read as written, rather than found by the search. The search drops a
 * muted shape when a fuller one is no harder (§5.2), which is exactly what an
 * arrangement for two guitars wants ignored.
 */
function shape(symbol, frets) {
  const chord = parseChord(symbol, 'brazilian').chord;
  const fingering = fingeringFromFrets(frets, chord, guitar);
  if (!fingering) throw new Error(`${symbol} ${frets.join('-')} is unplayable`);
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


/**
 * The label beside a chord name, saying what the shape actually sounds
 * (docs/DESIGN.md §6.2).
 */
describe('the voiced-as label', () => {
  it('says nothing about a shape that sounds what it is called', () => {
    const { chord, fingering } = shape('G', [3, 2, 0, 0, 0, 3]);
    expect(voicedAsLabel(fingering, { chord })).toBe(null);
  });

  it('names the whole chord in full form, for a legend', () => {
    // Bb D G D: the six-string's third under a seven-string's G.
    const { chord, fingering } = shape('Gm', ['x', 1, 0, 0, 3, 'x']);
    expect(voicedAsLabel(fingering, { chord, dialect: 'brazilian' })).toBe('Gm/Bb');
  });

  it('names only the bass in short form, for a list of one chord', () => {
    const { chord, fingering } = shape('Gm', ['x', 1, 0, 0, 3, 'x']);
    expect(voicedAsLabel(fingering, { chord, dialect: 'brazilian', full: false })).toBe('/Bb');
  });

  it('says nothing when a slash chord is played as written', () => {
    // The chart asked for the F# underneath and this shape gives it.
    const { chord, fingering } = shape('D7/F#', [2, 'x', 0, 2, 1, 2]);
    expect(voicedAsLabel(fingering, { chord, dialect: 'brazilian' })).toBe(null);
  });

  it('drops the chart\'s own slash before adding the sounded one', () => {
    // The chart says D7/F# because the other instrument plays the F#. This
    // shape sounds A underneath, and D7/F#/A is not a chord.
    const { chord, fingering } = shape('D7/F#', ['x', 0, 4, 5, 3, 'x']);
    expect(voicedAsLabel(fingering, { chord, dialect: 'brazilian' })).toBe('D7/A');
  });

  it('mentions a missing root', () => {
    // Bb D F Bb — a Gm7 with no G in it.
    const { chord, fingering } = shape('Gm7', ['x', 'x', 8, 7, 6, 6]);
    expect(voicedAsLabel(fingering, { chord, dialect: 'brazilian' })).toBe('Gm7/Bb, no root');
  });

  it('reaches the accessible description too', () => {
    const { chord, fingering } = shape('Gm', ['x', 1, 0, 0, 3, 'x']);
    const text = describeFingering(fingering, {
      chord,
      dialect: 'brazilian',
      instrument: guitar,
    });
    expect(text).toContain('voiced as Gm/Bb');
  });
});
