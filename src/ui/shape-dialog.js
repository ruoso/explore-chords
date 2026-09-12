/**
 * Enter a shape by clicking it (docs/DESIGN.md §2.11).
 *
 * The picker offers the shapes the search found, which is the right answer
 * almost always and no answer at all when you already know what you want to
 * play and it is not on the list — a voicing off a chart, something a teacher
 * showed you, a shape the rules were never going to allow. So: a big diagram,
 * click a fret to put a finger on it, click it again to take it off.
 *
 * The diagram is the one the app draws everywhere else, with click targets
 * added by the same code that draws the grid (render/chord-box.js), so the
 * places you can click cannot drift from the lines you can see.
 *
 * Nothing is validated away while you type. A half-finished shape is not a
 * chord and the dialog says so without preventing it, because the way to reach
 * a shape is usually through several that are not one yet.
 */

import { el, clear } from './dom.js';
import { renderChordBox, describeFingering, voicedAsLabel } from '../render/index.js';
import { fingeringFromFrets } from '../core/search.js';
import { shorthandOf } from '../core/fretstring.js';
import { stringCount, midiAt } from '../core/instrument.js';
import { chordPitchClasses } from '../core/chord.js';
import { formatPitch } from '../core/pitch.js';
import { t } from '../i18n/index.js';

/** Fret rows the window shows. Six is two more than any hand spans. */
const ROWS = 6;
/** Big enough to hit with a thumb, which is the whole point of this screen. */
const SIZE = 2.2;

const pcOf = (midi) => ((midi % 12) + 12) % 12;

/**
 * @param {{instrument: object, chord: object|null, label?: string, dialect: string,
 *          frets: (number|'x')[]|null, onSave: (frets: (number|'x')[]) => void}} options
 */
export function openShapeDialog({ instrument, chord, label, dialect, frets, onSave }) {
  const existing = document.querySelector('#shape-dialog');
  if (existing) existing.remove();

  const count = stringCount(instrument);
  const fretCount = instrument.fretCount ?? 22;
  // What is being edited, or a blank neck to start from.
  let current = frets ? [...frets] : new Array(count).fill('x');

  // The window onto the neck. It starts where the shape is, and moves only when
  // asked: a window that followed the shape would slide out from under you as
  // you entered notes.
  const fretted = current.filter((f) => typeof f === 'number' && f > 0);
  let start = fretted.length > 0 ? Math.max(1, Math.min(...fretted)) : 1;

  const dialog = el('dialog', {
    class: 'ec-dialog ec-dialog-shape',
    id: 'shape-dialog',
    'aria-labelledby': 'shape-dialog-title',
  });
  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const heading = el(
    'h2',
    { class: 'ec-dialog-title', id: 'shape-dialog-title' },
    label ? t('shape.titleFor', { chord: label }) : t('shape.title')
  );
  const board = el('div', { class: 'ec-shape-board', id: 'shape-board' });
  const readout = el('p', { class: 'ec-shape-readout', id: 'shape-readout' });
  const notes = el('p', { class: 'ec-shape-notes', id: 'shape-notes' });
  const position = el('div', { class: 'ec-shape-position' });
  const fretLabel = el('span', { class: 'ec-shape-fret', id: 'shape-fret' });
  const save = el('button', {
    type: 'button',
    class: 'ec-button ec-button-small ec-button-primary',
    id: 'shape-save',
  });

  /** Cycle the marker above the nut: open, then muted, then open again. */
  const toggleMarker = (string) => {
    current[string] = current[string] === 0 ? 'x' : 0;
  };

  /** A fret: on if it was off, off again if it was already there. */
  const toggleFret = (string, fret) => {
    current[string] = current[string] === fret ? 'x' : fret;
  };

  const move = (by) => {
    start = Math.max(1, Math.min(fretCount - ROWS + 1, start + by));
    draw();
  };

  function draw() {
    // A shape being entered need not be playable, so it is drawn from the frets
    // rather than from a fingering: the search would refuse to describe a
    // five-finger stretch, and refusing to draw it would leave you unable to
    // see what you had just clicked.
    const midis = current.map((f, i) => (f === 'x' ? null : midiAt(instrument, i, f)));
    const sketch = {
      frets: current,
      fingers: new Array(count).fill(null),
      barre: null,
      midis,
      shorthand: shorthandOf(current),
    };
    const playable = chord ? fingeringFromFrets(current, chord, instrument) : null;

    clear(board);
    board.innerHTML = renderChordBox(playable ?? sketch, {
      handed: 'right',
      size: SIZE,
      fretsShown: ROWS,
      startFret: start,
      hits: true,
      label: playable
        ? describeFingering(playable, { chord, dialect, instrument })
        : t('shape.sketch', { shorthand: sketch.shorthand }),
    });

    clear(readout);
    readout.append(el('span', { class: 'ec-shorthand' }, sketch.shorthand));
    if (playable) {
      readout.append(
        el(
          'span',
          { class: `ec-badge ec-badge-${playable.difficulty}` },
          t(`difficulty.${playable.difficulty}`)
        )
      );
      const sounded = voicedAsLabel(playable, { chord, dialect, full: true });
      if (sounded) readout.append(el('span', { class: 'ec-voiced-as' }, sounded));
    } else if (current.some((f) => f !== 'x')) {
      // Held by no hand the app can work out, which is worth saying and not
      // worth preventing: a shape can be right and awkward.
      readout.append(el('span', { class: 'ec-shape-warn' }, t('shape.unplayable')));
    }

    // Which notes it makes, and whether they belong to the chord. More use than
    // a verdict: it says *what is wrong*, one string at a time.
    const wanted = chord ? chordPitchClasses(chord) : null;
    clear(notes);
    const sounding = midis.filter((m) => m !== null);
    if (sounding.length === 0) {
      notes.append(el('span', {}, t('shape.empty')));
    } else {
      current.forEach((fret, i) => {
        if (fret === 'x') return;
        const midi = midis[i];
        const foreign = wanted ? !wanted.has(pcOf(midi)) : false;
        const name = formatPitch({ note: pitchName(midi), octave: Math.floor(midi / 12) - 1 });
        notes.append(
          el(
            'span',
            {
              class: `ec-shape-note${foreign ? ' is-foreign' : ''}`,
              // Never colour alone (§6.1): a note from outside the chord says
              // so in its own label, and carries a mark a reader can see.
              title: foreign ? t('shape.foreign', { note: name }) : null,
              'aria-label': foreign ? t('shape.foreign', { note: name }) : null,
            },
            foreign ? `${name}*` : name
          )
        );
      });
    }

    save.textContent = t('shape.save');
    save.disabled = sounding.length === 0;
    fretLabel.textContent = t('shape.frets', { from: start, to: start + ROWS - 1 });
  }

  board.addEventListener('click', (event) => {
    const hit = event.target.closest?.('.ec-hit');
    if (!hit) return;
    const string = Number(hit.dataset.string);
    const fret = hit.dataset.fret;
    if (fret === 'marker') toggleMarker(string);
    else toggleFret(string, Number(fret));
    draw();
  });

  position.append(
    el(
      'button',
      {
        type: 'button',
        class: 'ec-button ec-button-small',
        id: 'shape-down',
        'aria-label': t('shape.towardsNut'),
        onClick: () => move(-1),
      },
      '←'
    ),
    fretLabel,
    el(
      'button',
      {
        type: 'button',
        class: 'ec-button ec-button-small',
        id: 'shape-up',
        'aria-label': t('shape.upTheNeck'),
        onClick: () => move(1),
      },
      '→'
    )
  );

  const actions = el(
    'div',
    { class: 'ec-dialog-actions' },
    el(
      'button',
      {
        type: 'button',
        class: 'ec-button ec-button-small',
        id: 'shape-clear',
        onClick: () => {
          current = new Array(count).fill('x');
          draw();
        },
      },
      t('shape.clear')
    ),
    el(
      'button',
      { type: 'button', class: 'ec-button ec-button-small', id: 'shape-cancel', onClick: close },
      t('shape.cancel')
    ),
    save
  );

  save.addEventListener('click', () => {
    onSave([...current]);
    close();
  });

  dialog.append(heading, el('p', { class: 'ec-help' }, t('shape.help')), board, position, readout, notes, actions);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', () => dialog.remove());

  draw();
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** The note a midi number is, spelled with flats — a readout, not a chord. */
function pitchName(midi) {
  const FLATS = [
    { letter: 'C', accidental: 0 },
    { letter: 'D', accidental: -1 },
    { letter: 'D', accidental: 0 },
    { letter: 'E', accidental: -1 },
    { letter: 'E', accidental: 0 },
    { letter: 'F', accidental: 0 },
    { letter: 'G', accidental: -1 },
    { letter: 'G', accidental: 0 },
    { letter: 'A', accidental: -1 },
    { letter: 'A', accidental: 0 },
    { letter: 'B', accidental: -1 },
    { letter: 'B', accidental: 0 },
  ];
  return FLATS[pcOf(midi)];
}
