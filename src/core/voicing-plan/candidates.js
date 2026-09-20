/**
 * The shapes a planner may choose between (§2.10).
 *
 * Two ways of producing them: ask the ordinary search, or enumerate. The second
 * exists because the search discards a muted shape when a fuller one is no
 * harder (§5.2) — the right rule for a solo player and the wrong one for a
 * guitar whose low strings are quiet because another instrument has them.
 */

import { chordTones } from '../chord.js';
import { midiAt, stringCount, configFor } from '../instrument.js';
import { searchFingerings, allFingerings, fingeringFromFrets } from '../search.js';
import { sounding, lowest } from './shape.js';

const pcOf = (midi) => ((midi % 12) + 12) % 12;

/** The neck a choro accompaniment works in: the guitar's "primeiro quádruplo". */
const CENTRO_LOW = 0;
const CENTRO_HIGH = 7;

/**
 * Where another instrument might put a bass note: the low string of a
 * seven-string up to the walking range above it. The thirds in the sources are
 * between two moving lines, so the octave is not fixed (§2.10).
 */
const BASS_LOW = 35;
const BASS_HIGH = 52;

/**
 * How the centro's own bass note can sit against the other guitar's, by the
 * gap in semitones. A shape is tagged with every relation it can make, since
 * we do not know which octave the other guitar chose.
 *
 * A third is the idiom and the rest are its documented alternatives: a sixth or
 * an octave where a third is not a chord tone, and a third *below* — landing on
 * the fifth — which the sources also record (§2.10).
 */
const INTERVALS = [
  ['third', [3, 4]],
  ['sixth', [8, 9]],
  ['octave', [12]],
  ['thirdBelow', [-3, -4]],
];

/** Everything the ordinary search offers for this chord, on this instrument. */
export function searched(chord, instrument, config) {
  return allFingerings(searchFingerings(chord, instrument, config));
}

/**
 * Contiguous runs of strings a thumb-and-fingers grip can use.
 *
 * Four voices is the norm in this idiom and five the occasional departure, the
 * thumb takes the lowest or second-lowest string, and the top string is left
 * spare (§2.10). On six strings that is E-A-D-G and A-D-G-B, plus the two
 * five-string runs.
 *
 * `upperTetrad` adds the idiom's other texture: the thumb up on the fourth
 * string with the low string dropped, giving a three-voice grip. The sources
 * give it for dominants in chromatic conduction, where the notes lost are
 * roots and fifths and the tritone still sounds, so it is offered only for a
 * chord that has a seventh to make that tritone with.
 */
function centroStringSets(count, { upperTetrad } = {}) {
  const sets = [];
  for (const size of [4, 5]) {
    for (const start of [0, 1]) {
      const end = start + size - 1;
      if (end > count - 1) continue;
      // The top string stays out of a four-voice grip; a five-voice one may
      // reach it, since it is the wider texture that occasionally appears.
      if (size === 4 && end === count - 1) continue;
      sets.push(Array.from({ length: size }, (_, i) => start + i));
    }
  }
  // Counted from the top, so it is the fourth string of a six-string and the
  // fourth of a seven-string too, rather than whatever index that happens to be.
  const start = count - 4;
  if (upperTetrad && start > 1) sets.push([start, start + 1, start + 2]);
  return sets;
}

/**
 * Shapes for the choro *centro*, each tagged with how its bass sits against the
 * other guitar's.
 *
 * Enumerated rather than searched, for the reason above. Only notes belonging
 * to the chord are considered, every tone but a perfect fifth has to be
 * present, and the strings sounded are contiguous: a grip with a hole in it is
 * a decision the player can still make, and one that needs a hole cannot be
 * undone.
 *
 * Tagged rather than filtered. An earlier version tried thirds, then sixths,
 * then octaves, returning at the first that yielded anything — which decided
 * the question before anything knew what the passage was doing. Handing back
 * every playable shape with its relation lets the planner decide, which is
 * where that decision belongs.
 *
 * @returns {{fingering: object, intervals: string[]}[]}
 */
export function centroCandidates(chord, instrument, { bassPc }) {
  const count = stringCount(instrument);
  const config = {
    ...configFor(instrument, 'fingerstyle'),
    rootInBass: false,
    requireRoot: false,
    allowRootless: true,
  };

  const tones = chordTones(chord);
  const byPc = new Map(tones.map((tone) => [tone.pitchClass, tone]));
  // The fifth is the note this idiom drops, but only a perfect one: a ♭5 or a
  // ♯5 is what makes the chord the chord it is, and dropping the ♭5 of a
  // diminished seventh leaves a shape with a spare string and no tritone in it.
  // The ordinary search already refuses that (§5.2); so does this.
  const needed = tones
    .filter((tone) => !(tone.role === 'fifth' && tone.alter === 0))
    .map((tone) => tone.pitchClass);

  // Per string, the frets in the window that belong to the chord at all.
  const usable = [];
  for (let s = 0; s < count; s += 1) {
    usable[s] = [];
    for (let f = CENTRO_LOW; f <= Math.min(CENTRO_HIGH, instrument.fretCount ?? CENTRO_HIGH); f += 1) {
      if (byPc.has(pcOf(midiAt(instrument, s, f)))) usable[s].push(f);
    }
  }

  const wanted = [];
  for (let m = BASS_LOW; m <= BASS_HIGH; m += 1) if (pcOf(m) === bassPc) wanted.push(m);

  const out = [];
  const upperTetrad = tones.some((tone) => tone.role === 'seventh');
  for (const set of centroStringSets(count, { upperTetrad })) {
    const frets = new Array(count).fill('x');
    const walk = (i) => {
      if (i === set.length) {
        const pcs = new Set(set.map((s) => pcOf(midiAt(instrument, s, frets[s]))));
        if (needed.some((pc) => !pcs.has(pc))) return;
        const fingering = fingeringFromFrets([...frets], chord, instrument, config);
        if (!fingering) return;
        // A note sounded three times over is a wasted string, not a fuller
        // chord. Doubling once is ordinary on a guitar; twice is a four-voice
        // grip giving the chord two notes.
        const counts = new Map();
        for (const note of sounding(fingering)) {
          counts.set(pcOf(note), (counts.get(pcOf(note)) ?? 0) + 1);
        }
        if ([...counts.values()].some((n) => n > 2)) return;

        const low = lowest(fingering);
        const gaps = wanted.map((bass) => low - bass);
        const intervals = INTERVALS.filter(([, sizes]) =>
          gaps.some((gap) => sizes.includes(gap))
        ).map(([name]) => name);
        if (intervals.length > 0) out.push({ fingering, intervals });
        return;
      }
      for (const fret of usable[set[i]]) {
        frets[set[i]] = fret;
        walk(i + 1);
      }
      frets[set[i]] = 'x';
    };
    walk(0);
  }
  return out;
}
