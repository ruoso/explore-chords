/**
 * Phase 1 entry point.
 *
 * There is no app yet. This page exists to prove the deployment is wired
 * correctly end to end: that the Vite `base` path resolves assets under
 * /explore-chords/, and that a real module from src/core/ loads and runs in a
 * browser. See docs/DESIGN.md §9.7 for why that is verified from day one
 * rather than at the end.
 */
import { parseNote } from './core/pitch.js';
import { chord, describeChordTones } from './core/chord.js';

const examples = [
  ['Db major', chord(parseNote('Db'), 'major')],
  ['C minor 7 flat 5', chord(parseNote('C'), 'minor', [
    { degree: 5, alter: -1 },
    { degree: 7, alter: -1 },
  ])],
  ['C major 7 sharp 11', chord(parseNote('C'), 'major', [
    { degree: 7 },
    { degree: 11, alter: 1 },
  ])],
];

const rows = examples
  .map(
    ([label, c]) =>
      `<dt>${label}</dt><dd>${describeChordTones(c)}</dd>`
  )
  .join('');

document.querySelector('#status').innerHTML = `
  <p><strong>Phase 1.</strong> Pitch and chord model, spelled correctly:</p>
  <dl>${rows}</dl>
`;
