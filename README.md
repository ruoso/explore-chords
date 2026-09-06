# Explore Chords

A fully client-side progressive web app for exploring chord fingerings on
fretted string instruments with arbitrary tunings.

Set up your instrument once — guitar, bass, ukulele, cavaquinho, mandolin, or
any tuning you can write down — and then explore how any chord can actually be
played on it. Every fingering is ranked by difficulty, grouped by neck position,
and drawn with real finger numbers and barres rather than bare dots.

Everything runs in the browser. No backend, no accounts, and no network access
at runtime — once loaded, it works entirely offline.

> **Status: design phase.** There is no implementation yet. The design is
> settled and written up in **[docs/DESIGN.md](docs/DESIGN.md)**.

## What it will do

- **Instrument-first.** You pick your instrument and tuning up front; it becomes
  the app's identity. A header switcher flips between the instruments you've set
  up, and everything on screen follows.
- **Chords the way you write them.** Type `C7M`, `Cmaj7` or `C∆7` — Brazilian
  *cifra*, American jazz and Real Book notation are all accepted, and you choose
  which one to read results in.
- **Fingerings you can judge.** Ranked easiest-first, grouped by position,
  labelled with finger numbers and barres.
- **Voicing rules you control.** Per instrument, because a bass and a ukulele
  want permanently different rules. Presets plus an expert panel over every
  individual rule and weight.
- **Song sheets for teaching.** An ordered, sectioned set of chords, each pinned
  to one specific chosen fingering — printable, and shareable as a link.
- **Offline and installable.** Mobile-first, add it to a phone home screen and
  use it in a lesson with no signal.

## Design decisions worth knowing

A few choices in [docs/DESIGN.md](docs/DESIGN.md) are non-obvious enough to
flag here:

- **Arbitrary tunings are the model, not an escape hatch.** Every instrument is
  just a list of open-string pitches, so re-entrant tunings (standard ukulele)
  and a capo (every string raised equally) are both expressible without special
  cases.
- **Chords are stored dialect-free.** Notation is purely an input and display
  concern, so a shared link written in one notation reads correctly in another.
- **The music core is pure and synchronous**, which lets it run in a Web Worker
  and be tested exhaustively without a browser.
- **Deliberately deferred from v1**, each with reasoning recorded: transposition,
  capo, audio playback, and auto-relaxing the voicing rules when no fingering is
  found. In every case the theory is cheap and the *interface* is the hard part.

## Planned stack

Vanilla JavaScript ES modules, no framework. Vite for the build,
`vite-plugin-pwa` for the manifest and service worker, Vitest for the pure core,
Playwright for end-to-end journeys, offline behaviour and accessibility. Static
output, deployed to GitHub Pages.

## Roadmap

Eleven phases, each with acceptance criteria in
[§10 of the design doc](docs/DESIGN.md). Phases 1–4 carry the risk; everything
after is additive.

| | Phase |
|---|---|
| 1–2 | Pitch, chord model, notation parser and formatters |
| 3 | Fingering search, finger assignment, difficulty scoring |
| 4 | SVG diagram rendering (and accessibility, from here onward) |
| 5–7 | Store, instrument setup and switching, chord input, result view |
| 8–9 | Per-instrument heuristics, favourites and saved tunings |
| 10–11 | Song sheets and printing, then PWA delivery |

## Prior art

The chord-generation approach grows out of
[scale-explorer](../scale-explorer), an earlier scale-first tool. This project
reuses its ideas — depth-first search over string assignments, playability
filtering, SVG chord boxes — while replacing the algorithm with a scored search
and a real finger assigner, and fixing its handling of re-entrant tunings.
