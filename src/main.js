/**
 * Phase 4 entry point.
 *
 * Still not the app — the store, chord input and instrument switcher arrive in
 * phase 5. This renders real search output with real diagrams so the pipeline
 * is verifiable in a browser, and so the deployment keeps proving itself.
 */
import { parseChord } from './core/notation/parse.js';
import { formatChord } from './core/notation/format.js';
import { instrumentInstance } from './core/instrument.js';
import { searchFingerings } from './core/search.js';
import { renderDiagram } from './render/index.js';
import { DIFFICULTY_LABELS } from './core/score.js';

const guitar = instrumentInstance({
  catalogId: '6guitar',
  label: 'Guitar · Standard',
  strings: 'E2, A2, D3, G3, B3, E4',
  fretCount: 22,
});

const dialect = 'brazilian';
const symbols = ['C', 'Am', 'F', 'G7', 'C7M(9)', 'Dm7(5-)'];

const sections = symbols.map((symbol) => {
  const chord = parseChord(symbol, dialect).chord;
  const result = searchFingerings(chord, guitar);
  const shown = result.groups
    .flatMap((group) => group.fingerings.slice(0, group.displayCount))
    .slice(0, 5);

  const items = shown
    .map(
      (f) => `<li class="ec-card">
        ${renderDiagram(f, { chord, dialect, instrument: guitar })}
        <p class="ec-caption">
          <span class="ec-shorthand">${f.shorthand}</span>
          <span class="ec-badge ec-badge-${f.difficulty}">${DIFFICULTY_LABELS[f.difficulty]}</span>
        </p>
      </li>`
    )
    .join('');

  const heading = formatChord(chord, dialect);
  const id = `chord-${heading.replace(/[^a-zA-Z0-9]/g, '')}`;
  return `<section class="ec-section" aria-labelledby="${id}">
      <h2 id="${id}" class="ec-chord-name">${heading}</h2>
      <ul class="ec-grid">${items}</ul>
    </section>`;
});

document.querySelector('#status').innerHTML = `
  <p class="ec-note">
    <strong>Phase 4.</strong> Search and diagrams, on ${guitar.label}.
    Chord input, instrument switching and filters arrive in the next phases.
  </p>
  ${sections.join('')}
`;
