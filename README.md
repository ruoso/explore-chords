# Explore Chords

A fully client-side progressive web app for exploring chord fingerings on
fretted string instruments with arbitrary tunings.

Set up your instrument once — guitar, bass, ukulele, cavaquinho, mandolin, or
any tuning you can write down — and then explore how any chord can actually be
played on it. Every fingering is ranked by difficulty, grouped by neck position,
and drawn with real finger numbers and barres rather than bare dots.

Everything runs in the browser. No backend, no accounts, and no network access
at runtime — once loaded, it works entirely offline.

> **Live at <https://ruoso.github.io/explore-chords/>** — installable, and it
> keeps working with no network at all.
>
> All eleven phases of [docs/DESIGN.md](docs/DESIGN.md) are built, each against
> the acceptance criteria written before it. 309 unit tests and 114 end-to-end
> tests across desktop and mobile viewports.

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

## Testing

```sh
npm test          # 309 unit tests over the pure core
npm run test:e2e  # 114 Playwright tests, desktop and mobile
```

The dividing line: music theory is tested in unit tests, and the browser is
tested for journeys, wiring, persistence and accessibility — never for whether
`Cmaj7` has a major 7th. A wrong fingering is a unit-test failure; a correct one
that fails to reach the screen is an end-to-end failure.

Accessibility is checked, not merely intended: axe runs at WCAG 2.1 AA over
four screens, and there are explicit assertions that every diagram carries a
descriptive label, that the difficulty badge reads as a word rather than a
colour, and that the horizontally scrolling result rows can be reached by
keyboard.

The offline test reloads with the network off and then computes a chord the
session has never seen. Asserting the shell was cached would pass while a
hidden network dependency lurked in the search.

## Development

Requires the Node version in `.node-version` (24.20.0).

```sh
npm install
npm run dev      # dev server
npm test         # unit tests
npm run lint     # eslint
npm run build    # production build to dist/
```

Every push runs lint, tests and a build in CI; pushes to `main` that pass also
deploy to GitHub Pages.

## Prior art

The chord-generation approach grows out of
[scale-explorer](../scale-explorer), an earlier scale-first tool. This project
reuses its ideas — depth-first search over string assignments, playability
filtering, SVG chord boxes — while replacing the algorithm with a scored search
and a real finger assigner, and fixing its handling of re-entrant tunings.

## License

[MIT](LICENSE) © Daniel Ruoso
