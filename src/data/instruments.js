/**
 * Instrument catalog (docs/DESIGN.md §4.3).
 *
 * A plain module rather than a JSON file: `core/` must stay portable enough to
 * run in a Web Worker or a bare Node process, and JSON imports need a bundler
 * or an import attribute. The data is static either way.
 *
 * `fretCount` values are real per instrument — a ukulele search should not be
 * offering fret 20 (§11).
 */

export const CATALOG = [
  {
    id: "6guitar",
    name: "Guitar (6-string)",
    fretted: true,
    fretCount: 22,
    tunings: [
      { name: "Standard", strings: "E2, A2, D3, G3, B3, E4" },
      { name: "Drop D", strings: "D2, A2, D3, G3, B3, E4" },
      { name: "Open G", strings: "D2, G2, D3, G3, B3, D4" },
      { name: "Open D", strings: "D2, A2, D3, F#3, A3, D4" },
      { name: "DADGAD", strings: "D2, A2, D3, G3, A3, D4" },
      { name: "Open C", strings: "C2, G2, C3, G3, C4, E4" },
    ],
  },
  {
    id: "7guitar",
    name: "Guitar (7-string)",
    fretted: true,
    fretCount: 22,
    tunings: [
      { name: "Standard", strings: "B1, E2, A2, D3, G3, B3, E4" },
      { name: "Brazilian", strings: "C2, E2, A2, D3, G3, B3, E4" },
    ],
  },
  {
    id: "4bass",
    name: "Bass (4-string)",
    fretted: true,
    fretCount: 20,
    tunings: [
      { name: "Standard", strings: "E1, A1, D2, G2" },
    ],
  },
  {
    id: "5bass",
    name: "Bass (5-string)",
    fretted: true,
    fretCount: 20,
    tunings: [
      { name: "Standard", strings: "B0, E1, A1, D2, G2" },
    ],
  },
  {
    id: "ukulele",
    name: "Ukulele",
    fretted: true,
    fretCount: 15,
    tunings: [
      { name: "Standard (re-entrant)", strings: "G4, C4, E4, A4" },
      { name: "Low G", strings: "G3, C4, E4, A4" },
      { name: "Baritone", strings: "D3, G3, B3, E4" },
    ],
  },
  {
    id: "cavaquinho",
    name: "Cavaquinho",
    fretted: true,
    fretCount: 17,
    tunings: [
      { name: "Standard (Brazil)", strings: "D4, G4, B4, D5" },
    ],
  },
  {
    id: "mandolin",
    name: "Mandolin",
    fretted: true,
    fretCount: 20,
    tunings: [
      { name: "Standard", strings: "G3, D4, A4, E5" },
    ],
  },
  {
    id: "tenorbanjo",
    name: "Tenor banjo",
    fretted: true,
    fretCount: 19,
    tunings: [
      { name: "Standard", strings: "C3, G3, D4, A4" },
      { name: "Irish", strings: "G2, D3, A3, E4" },
    ],
  },
];
