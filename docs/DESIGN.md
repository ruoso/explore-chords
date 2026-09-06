# Explore Chords — Design Document

**Status:** Draft v2
**Date:** 2026-09-06

A fully client-side progressive web app for exploring chord fingerings on
fretted string instruments with arbitrary tunings. Everything — chord parsing,
fingering search, ranking, rendering — runs in the browser. There is no
backend and no network access at runtime.

Reference implementation for the underlying music/fingering logic:
`../scale-explorer` (`fingering.js`, `chord-render.js`, `music-data.json`).
This app reuses the *ideas* (DFS over string assignments, playability filters,
SVG chord boxes) but replaces the algorithm with a scored search and a real
finger assigner.

---

## 1. Goals and non-goals

### Goals

- **The instrument comes first.** You set up your instrument and tuning once;
  that becomes the app's identity. Every chord, every result, every saved item
  is seen through it. Switching is quick but deliberate.
- Given a chord (picked or typed) show **all reasonable ways to play it** on the
  active instrument, ranked by difficulty and grouped by neck position.
- Support **any fretted instrument** via an arbitrary tuning list — guitar 6/7/8,
  bass 4/5/6, ukulele (including re-entrant), cavaquinho, mandolin, banjo.
- **Accept the chord notation the user actually writes** — Brazilian *cifra*,
  American jazz, or Real Book symbols — and display in whichever they prefer.
- Let the user **control the voicing heuristics** (what may be omitted, doubled,
  barred, stretched) per instrument, through presets and an expert panel.
- Let a teacher **build a song sheet**: an ordered, sectioned set of chords each
  pinned to one specific chosen fingering, printable and shareable as a link.
- Work **fully offline**, installable, mobile-first.

### Non-goals for v1

- Piano/keyboard diagrams. Different voicing model and renderer; separate phase.
- Bowed instruments (violin/viola/cello). Different playability rules, no frets.
  The data model leaves room (`fretted: false`) but v1 ships fretted only.
- Side-by-side multi-instrument comparison. One active instrument at a time.
- Lyrics-with-chords lead sheets. Song sheets are diagram + progression only.
- Scale/key browsing and harmonic-sequence suggestion (that is what
  scale-explorer already does). Chord-first only.
- Solfège note names, German `H`/`B` note naming, and Nashville/Roman-numeral
  entry. See §4.4 — the architecture accommodates all three, v1 ships none.
- **Audio playback.** Cut from v1 (§11). The app's value is the diagrams, and
  doing playback well needs real synthesis work — six simultaneous sine
  oscillators, as in the reference's `scale-audio.js`, sound harsh.
- **Auto-relaxing heuristics when nothing is found.** v1 reports the empty
  result plainly (§2.3); it does not silently retry with looser rules and label
  the output as approximate. See §11.
- **Capo.** The search side is trivial, but capo changes what a chord *name*
  means (§11), and that is the app's core contract. A custom tuning covers the
  practical need in v1 (§4.3).
- **Transposition / changing a song's key.** Not because the theory is hard —
  §4.5 shows it is nearly free — but because re-selecting fingerings for the new
  key is an unresolved UX problem. Transposing a sheet invalidates every pinned
  fingering at once, and what the teacher should see at that moment deserves its
  own design pass. v1 keeps the model open for it (§4.5) and ships none of it.
- Any server, account, or sync.

---

## 2. User-facing scope

### 2.1 The instrument is the app's identity

**First run** is instrument setup, before anything else is shown: pick an
instrument from the catalog, pick or edit a tuning, done. The user lands in the
explorer already configured. There is no "choose an instrument" field sitting in
the middle of the chord form — the instrument is ambient context, not a query
parameter.

**The header** always shows the active instrument as a chip:

```
┌────────────────────────┐
│ ♫ Guitar · Standard  ▾ │
├────────────────────────┤
│  Guitar · Standard   ✓ │
│  Guitar · Drop D       │
│  Ukulele · Standard    │
│  Bass 5 · Standard     │
│  + Add instrument      │
└────────────────────────┘
```

Tapping it switches instruments; everything on screen re-derives immediately.
The active instrument persists across sessions.

A user's instrument list is a set of **instrument instances** they have set up —
"Guitar · Drop D" and "Guitar · Standard" are two separate entries, because in
practice they are two different things to play. Adding one is a first-class flow
(catalog → tuning preset or custom → optional rename), not buried in settings.

**Contextual override.** Some views carry their own instrument: a shared link,
or a song sheet written for another instrument. Rather than silently retuning
the content or silently changing the user's default, the app enters a temporary
"viewing as" state, shown as a persistent bar:

```
⚠ Viewing as Guitar · Standard (from link)
  [ Back to my Ukulele ]  [ Keep as my default ]
──────────────────────────────────────────────
```

The override is transient — it never writes to the user's default unless they
press *Keep as my default* — and it applies to exactly one navigation context.
**One mechanism serves both cases**: opening a shared link for a different
instrument, and opening a song sheet written for a different instrument.

### 2.2 Chord entry

Two entry points, always in sync — typing updates the pickers, picking updates
the text:

1. **Structured picker** — root, quality, extension chips, optional bass note.
2. **Text input** — parsed by the notation engine described in §4.4. It accepts
   Brazilian, American and Real Book spellings simultaneously; genuinely
   ambiguous input surfaces an inline disambiguation chip rather than a silent
   guess. Parse errors are non-blocking; the last valid chord stays on screen.

The chord is always interpreted for the active instrument — a chord entry field
never asks which instrument it means.

### 2.3 Result view

Fingerings arrive **ranked by difficulty** and **grouped by neck position**,
where position is defined as the **lowest fretted fret** — group `Open`, then
`Fret 1`, `Fret 3`, `Fret 5`, and so on, skipping empty groups. (Deliberately
*not* CAGED-style roman numeral positions: those assume a guitar in standard
tuning and mean nothing on a re-entrant ukulele or an 8-string.) Each group is a
horizontally scrollable row of diagrams on phone, a wrapped grid on desktop.

Each diagram shows:
- dots with **finger numbers** (1–4, `T` for thumb), **barres drawn as a bar**
- `X` / `O` above the nut, starting-fret label when not in open position
- a **difficulty badge** and the voicing's shorthand (`x32010`)
- actions: play, star, add to song sheet, toggle to horizontal neck view

**When there are no results.** Strict heuristics on a small instrument will
routinely find nothing — `C13#11` has more notes than a ukulele has strings. The
app says so plainly and points at the heuristics panel; it does **not** quietly
retry with looser rules and present approximations as if they were the chord
asked for. This keeps `search()` a function that returns a list rather than one
that must explain its own failure. Auto-relaxation is a v2 question (§11).

Global display toggles: **vertical chord box ↔ horizontal neck**, and a
**left-handed mirror**.

### 2.4 Heuristics belong to the instrument

Because the instrument is the app's identity, the voicing heuristics attach to
the **instrument instance**, not to the app. A bass and a ukulele want
permanently different rules — a global "Bass-friendly" mode you have to remember
to switch is the wrong model. Setting up a bass gives you bass-appropriate
defaults forever.

Each instrument instance carries a preset (`Beginner`, `Standard`, `Jazz`,
`Bass-friendly`) plus any per-rule overrides, edited in an expert panel that
exposes every rule as a toggle and every cost as a number. Changing anything
switches the preset label to `Custom` for that instrument.

### 2.5 Song sheets

An ordered list of **sections** (Intro, Verse, Chorus, …), each holding a
progression of chord slots. Each slot references a chord *and one specific
pinned fingering*. A sheet **belongs to an instrument instance** — the pinned
fingerings are meaningless without it. The sheet renders as:

- a diagram legend at the top — each distinct chord+fingering once
- per-section progressions written as chord symbols

Stored in localStorage; shared by encoding the whole sheet, compressed, into a
URL fragment. Printable via a dedicated print stylesheet. Opening a sheet whose
instrument is not the active one triggers the §2.1 "viewing as" bar.

### 2.6 Other v1 features

- **Shareable URLs** — chord, instrument, tuning, filters, heuristics.
- **Favorites** — star a fingering; saved custom tunings; a library page,
  filtered to the active instrument by default.
- **Print / export** — printable diagram sheet, PNG/SVG export of a diagram or
  a grid.

---

## 3. Architecture

### 3.1 Stack

- **Vanilla JS, ES modules.** No framework.
- **Vite** for dev server and production build.
- **vite-plugin-pwa** for the manifest and a precaching service worker.
- Vitest for unit tests of the theory/search core (pure, no DOM).
- Playwright for end-to-end journeys, offline behaviour and accessibility, with
  `@axe-core/playwright`. Dev dependencies only — nothing ships to the client.

**Hosting: GitHub Pages on a project subpath**, `ruoso.github.io/explore-chords/`,
published by GitHub Actions from `main` (§9.7).
This has to be settled in phase 1 rather than at the end, because it fixes two
things that are painful to change later:

```js
// vite.config.js
base: '/explore-chords/'        // every asset URL, and the SW scope
```

The service worker's scope is bounded by that path, so a wrong base means the
PWA silently fails to control the page. All in-app navigation stays in the query
string and fragment (§8), so there are no history-API paths needing a SPA
fallback — which a project subpath would otherwise complicate.

### 3.2 Module layout

```
src/
  core/                    pure, no DOM, no I/O — fully unit tested
    pitch.js               note names, enharmonics, pitch <-> midi value
    chord.js               Chord model, formulas, extension application
    instrument.js          Instrument catalog + user instance model
    search.js              candidate generation (DFS over strings)
    fingers.js             assign fingers 1-4/T, detect barres, feasibility
    score.js               difficulty scoring, ranking, position grouping
    heuristics.js          HeuristicConfig, presets, validation
    notation/
      dialects.js          dialect definitions and token tables
      parse.js             permissive parser -> Chord + ambiguities
      format.js            Chord -> symbol, per dialect
  render/
    chord-box.js           vertical SVG diagram
    neck.js                horizontal SVG diagram
    diagram.js             shared geometry: dots, fingers, barres, mirroring
  state/
    store.js               app state + subscribe/notify
    url.js                 state <-> query string
    persist.js             localStorage: instruments, favorites, sheets
    codec.js               compress/expand for share links
  ui/
    instrument-setup.js    first run + add instrument
    instrument-chip.js     header switcher
    view-as-bar.js         transient instrument override banner
    chord-input.js         picker + text input, kept in sync
    heuristics-dialog.js   presets + expert panel (per instrument)
    results.js             grouped, ranked diagram grid
    sheet-editor.js        song sheet build/edit
    sheet-print.js         print view
    library.js             favorites + saved tunings + sheets
  data/
    instruments.json       instrument catalog and tuning presets
    chords.json            qualities, formulas, extension intervals
  main.js
  styles/
```

The `core/` boundary is the important one: everything there is synchronous and
pure. The reference made its theory functions `async` only because the data
lived behind a `fetch`; here the data is imported as JSON at build time, so the
core stays synchronous — which simplifies the search enormously and lets it run
in a Web Worker without ceremony.

### 3.3 State model

```js
AppState = {
  instruments:   [ InstrumentInstance, ... ],   // the user's set-up instruments
  activeId:      'inst_3',                       // persisted
  viewAs:        null | { instance, source },    // transient override (§2.1)
  chord:         Chord | null,
  dialect:       'brazilian' | 'american' | 'realbook',   // default: brazilian
  display:       { orientation, handed, labels },
  results:       { groups, truncated, requestId },
}
```

`effectiveInstrument = viewAs?.instance ?? instruments.find(i => i.id === activeId)`

Every consumer reads `effectiveInstrument`, never `activeId` directly. This is
what makes the override a single-line concern rather than a flag threaded
through the UI.

### 3.4 Data flow

```
   URL query ─┐
localStorage ─┼─> store (single app state object)
   user input ┘         │
                        ├─> core.search  (in a Web Worker)
                        │        │  keyed by effectiveInstrument + heuristics
                        │        └─> ranked, grouped fingerings
                        │
                        └─> ui modules re-render on change
                                 │
                                 └─> store back to URL + localStorage
```

State changes are the only way the UI updates. The store notifies subscribers;
each UI module re-renders its own subtree. No virtual DOM — the subtrees are
small and diagram SVGs are cached by content key.

### 3.5 Worker offloading

Candidate generation is exponential in string count. For an 8-string guitar with
a wide span this can take hundreds of milliseconds. The search runs in a **Web
Worker**, with a request-id so stale results are discarded as the user types, a
hard node budget surfaced as "results truncated", and an LRU result cache keyed
by chord + instrument instance + heuristics (same idea as the reference's
`LRUCache`).

---

## 4. The music core

### 4.1 Pitch representation

A pitch is an integer `pitchClass + 12 * octave`, matching the reference's
`pitchToValue`. Note *names* are kept separate from pitch classes so enharmonic
spelling is correct — a `Db` chord displays `Db F Ab`, not `C# F G#`. This is a
real improvement over the reference, which normalized everything to sharps.

- `PitchClass`: 0–11
- `SpelledNote`: `{ letter: 'A'..'G', accidental: -2..+2 }`
- Spelling derives from the chord root and interval structure, so `#11` on C
  spells `F#` and `b5` on C spells `Gb`.

### 4.2 Chord model

```js
Chord = {
  root:        SpelledNote,
  quality:     'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4' | ...,
  extensions:  [ { degree: 7, alter: 0 }, { degree: 11, alter: +1 }, ... ],
  bass:        SpelledNote | null,   // slash chords
}
```

This is the **canonical form**: notation-dialect-free. Dialect is purely a
display and input concern (§4.4), so a shared link carries the canonical chord
and a Brazilian user's `C7M` renders automatically as `Cmaj7` for a recipient
set to American notation.

Resolved to `ChordTones`: an ordered list of
`{ pitchClass, spelled, degree, role }` where `role ∈ {root, third, fifth,
seventh, extension}`. `role` is what the omission heuristics operate on —
"the 5th may be omitted" is a statement about role, not a semitone count.

`data/chords.json` holds base formulas (major `[0,4,7]`, minor `[0,3,7]`, …) and
extension intervals, seeded from the reference's `extensionNames` table.

### 4.3 Instrument model

The catalog is a set of templates; what the user holds is **instances**.

```js
// data/instruments.json — catalog
CatalogEntry = {
  id: '6guitar',
  name: 'Guitar (6-string)',
  fretted: true,
  fretCount: 22,
  tunings: [ { name: 'Standard', strings: ['E2','A2','D3','G3','B3','E4'] }, ... ],
}

// user's own, persisted
InstrumentInstance = {
  id:         'inst_3',
  catalogId:  '6guitar',
  label:      'Guitar · Drop D',       // user-renameable
  strings:    ['D2','A2','D3','G3','B3','E4'],
  fretCount:  22,
  heuristics: HeuristicConfig,          // §2.4 — per instrument
}
```

Any comma-separated pitch list defines a valid instance, so arbitrary tunings
are first-class rather than an escape hatch.

There is deliberately **no `capo` field** (§1, §11). A capo raises every open
string by the same amount, which an arbitrary tuning already expresses exactly:
"Guitar · Capo 2" is the instance `F#2, B2, E3, A3, C#4, F#4`. Because fret 0 of
that instance *is* the capo, the fret numbers in every diagram come out
capo-relative automatically, which is the convention capo users want. A field
that nothing reads would be worse than its absence — it invites a
half-implementation.

**Re-entrant tunings matter.** The reference rejects any candidate whose
sounding pitches are not strictly ascending (`fingering.js:filterCandidate`) —
correct for guitar, but that rule makes standard ukulele (`G4 C4 E4 A4`) produce
almost nothing. The new search derives the pitch-order constraint from the
tuning's own open-string order, so re-entrant instruments work naturally.

### 4.4 Chord notation: one parser, many dialects

There are several living systems for writing chord symbols, and this project's
own reference data uses the Brazilian one (`gen-scale.js:44` emits `°` and `+`;
the extension table is `7M`, `7m`, `9M`, `4+`, `5°`, `°7`). So the app must at
minimum read and write Brazilian *cifra* and American jazz notation.

**The design is one permissive parser, not one parser per dialect.** Most
dialect differences are non-conflicting aliases: `Cmaj7`, `C∆7`, `CM7` and
`C7M` can all be accepted at once with no ambiguity whatsoever. Writing four
parsers would multiply the test surface to solve a problem that does not exist,
and players genuinely mix dialects — a Brazilian chart has `C7M` and `Cm7` side
by side.

#### The two axes

Note-name system and quality vocabulary are **independent**. Brazilian players
use ordinary letter names with `7M` qualities, so "Brazilian" is not one bundle.
v1 ships letters-only on the note axis and three vocabularies on the quality
axis:

| Dialect | Major 7 | Minor 7 | Half-dim | Dim 7 | Aug | sus4 |
|---|---|---|---|---|---|---|
| Brazilian (cifra) | `C7M` | `Cm7` | `Cm7(5-)` | `C°7` | `C+` | `C4` |
| American / jazz | `Cmaj7` | `Cm7` | `Cm7b5` | `Cdim7` | `C+` / `Caug` | `Csus4` |
| Real Book | `C∆7` | `C−7` | `Cø7` | `C°7` | `C+` | `Csus4` |

#### Genuine ambiguities

Three inputs cannot be resolved by tokens alone. Only these consult the dialect
setting:

| Input | Brazilian reading | American reading |
|---|---|---|
| `C7+` | **Cmaj7** — `7+` is the major 7th (11 semitones) in the reference's own table | **C7♯5** — dominant 7 with raised 5th |
| `C9` | C add9, often no ♭7 | C dominant 9 — always includes ♭7 |
| `C+` | augmented triad | augmented triad *(not actually a conflict)* |

`C7+` is the dangerous one: three identical characters, two chords differing by
a semitone in two places.

Everything else — `°`, `dim`, `o`, `∆`, `maj`, `M`, `−`, `m`, `min`, `ø`,
`b5`/`5-`/`♭5` — is accepted unconditionally in every dialect.

Two further parsing rules that are not dialect-dependent but are easy to get
wrong:

- **Case is significant and must never be normalized.** `CM7` is major 7,
  `Cm7` is minor 7.
- **`/` is overloaded.** Followed by a note letter it is a slash bass (`C/E`);
  followed by a digit it is part of a compound quality (`C6/9`). Resolved by
  one-token lookahead, not by dialect.

#### Ambiguity is surfaced, not guessed

```js
ParseResult = {
  chord:       Chord | null,
  ambiguities: [ { span: [0,3], text: 'C9',
                   chosen: 'dominant9',
                   alternatives: ['add9'] } ],
  errors:      [ { span, message } ],
}
```

The dialect setting picks a default reading, and the UI shows it as a chip the
user can flip in one tap:

```
C9  →  C E G B♭ D   [dominant 9 ▾]
                     └ add9 (C E G D)
```

This is better than either silent guessing or a hard error: the user sees which
reading was taken and corrects it without retyping.

**Default: Brazilian**, matching the reference data this project grows out of
(`gen-scale.js` emits `°`/`+`, and the tuning presets include a Brazilian
7-string and a cavaquinho). It is one setting in prefs, changed once.

#### Formatting

`formatChord(chord, dialect)` is a separate, fully dialect-specific function —
this is where the per-dialect code genuinely belongs. The property test is a
round trip across the matrix: for every dialect `d` and every chord in the
corpus, `parse(format(c, d), d) ≡ c`, plus cross-dialect
`parse(format(c, d1), d2) ≡ c` for every unambiguous chord.

#### Deferred, but the shape accommodates them

- **Solfège note names** (`Dó7M`) — a note-axis alternative; the axis exists.
- **German `H`/`B`** — the one dialect that conflicts on *note names* rather than
  qualities. Needs the note axis to be dialect-aware, which it is; v1 just ships
  one option.
- **Nashville / Roman numerals** — not a dialect but a different *input mode*,
  since it requires a key context. It is the natural way to make song sheets
  transposable, so it is the most likely v2 addition (§11).

---

### 4.5 Intervals, and keeping transposition cheap for later

Transposition is deferred out of v1 (§1). This section exists so the v1 model
does not foreclose it, and to record why the deferral is a UX decision rather
than a theory one.

**The `Interval` type ships in v1 regardless** — not for transposition, but
because §4.1 commits to correct enharmonic spelling. `#11` on C must spell
`F#`, not `Gb`, and that computation is: 11th degree → 3 letter steps →
`C`→`F`; 18 semitones mod 12 = 6; `F` natural is 5 semitones above `C`, so
raise it once → `F#`. That is an interval expressed as
`{ letterSteps, semitones }` rather than as a semitone count.

```js
Interval = { letterSteps: 0..6, semitones: int }
```

It should not be "simplified" to a semitone count during v1 work. Everything
below stays cheap only because this type exists.

**What transposition would then cost.** Chord transposition touches only `root`
and `bass` — extensions are already stored as intervals from the root and
`quality` is symbolic, so both carry over untouched. Spelling the destination
needs one small addition, `Key = { tonic, mode }`, used purely to bias
accidentals toward the target key signature. Neither is a scale model.

Numeral-based entry is the only related feature that reaches for scale data,
and the two systems differ:

| System | Example | Needs |
|---|---|---|
| Nashville | `1`, `2m`, `5 7` | quality written explicitly → a degree→pitch pattern (7 numbers) |
| Roman numeral | `I`, `ii`, `V7`, `vii°` | quality *implied* by diatonic context → also chord quality per degree |

Both are satisfied by copying two arrays out of the reference's
`music-data.json` (`scales.major.chordQualities` and `.romanMapping`, plus the
natural-minor equivalents). That is not the scale *model* — no genre mapping, no
28-scale catalog, no harmonic sequences, and no notion that a scale *generates*
a chord set. Chord-first stays chord-first.

**Why it is deferred anyway.** A song sheet pins one specific fingering per slot
(§2.5). Transposing invalidates all of them simultaneously, and shifting a shape
up the neck may run it off the fretboard or strip its open strings — making it a
different thing to play, not the same thing moved. The options are re-run the
search and re-pin each slot, shift shapes where they still fit, or suggest a
**capo** and keep the shapes byte-identical. The last is what a guitarist
actually does — but capo is itself deferred (§11), it works only on fretted
instruments, and only upward. Choosing between these is a teacher-workflow
question, and it is the whole of the work.

**Forward compatibility, concretely.** Three things keep the door open, and all
three are free in v1:

1. Keep `Interval` as `{ letterSteps, semitones }` (above).
2. Sheet slots store **absolute chords** (`Cmaj7`), not degrees. A sheet-level
   `key` can be added later and degrees derived from it; the reverse would
   require a key to exist from the start. Absolute-only is the choice that
   does not need to be made now.
3. The sheet schema is versioned (§8.3), so adding `key` later is an additive
   migration, not a breaking one.

---

## 5. Fingering search

Three stages: **generate → assign fingers → score**.

### 5.1 Generation

For each fret window `[lo, lo+span]` across the neck (span from the instrument's
heuristics, default 4), depth-first over strings. For each string the options
are: open (if the open pitch class is in the chord), any fret in the window
whose pitch class is in the chord, or muted.

This is the reference's `dfsCandidatesForSpan` with three changes:

1. **Synchronous.** The reference `await`s a data lookup inside the innermost DFS
   loop, which dominates its runtime.
2. **Pruned during descent**, not only at the leaf. Once the remaining strings
   cannot supply a still-missing required tone, the branch is abandoned.
3. **Windows skipped** when they cannot contain the root at all.

### 5.2 Required-tone check

Which tones *must* sound is a function of the instrument's heuristics:

| Rule | Default | Effect |
|---|---|---|
| Root required | on | some string sounds the root pitch class |
| Root in bass | on (Standard) | lowest sounding pitch is the root, or the slash bass |
| 3rd required | on | (off for sus/power chords, which have none) |
| 5th omittable | on | perfect 5th may be dropped; altered 5ths never are |
| Rootless allowed | off (Standard), on (Jazz) | root may be dropped entirely |
| Extensions required | on | a named extension must sound, else it is not that chord |
| Doubling allowed | on | same pitch class on multiple strings |
| Duplicate pitch allowed | off | the exact same pitch twice (reference forbids this) |
| Inner mutes allowed | off (Standard), on (Jazz) | muted string between two sounding ones |
| Thumb-over allowed | off | `T` on the lowest string |

For a slash chord the bass note is added as a required tone *and* constrained to
be the lowest sounding pitch.

### 5.3 Finger assignment

New work — the reference only counts fingers roughly. We assign actual ones:

1. Group fretted strings by fret.
2. Treat the lowest fretted fret as a **barre candidate**: if the index finger
   can cover the outermost strings needing it and nothing below is fretted, place
   a barre (partial barres allowed, spanning only the strings that need it).
3. Assign fingers 2,3,4 in ascending fret order, respecting that a
   higher-numbered finger must not sit on a lower fret than a lower-numbered one.
4. **Thumb-over** (`T`) optional, off by default — it unlocks common folk/rock
   voicings.
5. Reject if a finger reaching over a string would mute one that must sound.
   (A barre finger covering a string that should ring is fine; a fingertip
   crossing is not.)

```js
Fingering = {
  frets:    ['x','3','2','0','1','0'],
  fingers:  [null, 3, 2, null, 1, null],
  barre:    null | { fret, fromString, toString, finger },
  pitches:  [null, 'C3', 'E3', 'G3', 'C4', 'E4'],
  omitted:  ['fifth'],
  position: 3,          // lowest fretted fret, 0 = open
  score:    { total, parts: {...} },
}
```

### 5.4 Scoring

A weighted sum; every weight is exposed in the expert panel:

| Cost | Default weight | Notes |
|---|---|---|
| fret span | 1.0 × (span − 1) | a 4-fret stretch is much harder than 2 |
| barre | 1.5 | full barre costs more than partial |
| finger count | 0.4 each | |
| inner muted string | 3.0 | requires deliberate damping |
| high position | 0.1 × position | above the 12th fret gets awkward |
| omitted 5th | 0.3 | penalizes *musical* completeness, not difficulty |
| rootless | 0.6 | |
| non-root bass (unrequested) | 0.8 | inversions when none was asked for |
| open strings | −0.5 each | a bonus — open strings make a shape easier |
| non-adjacent stretch | 0.5 | 1–4 stretches on low frets |

`total` sorts within each position group; groups are ordered by position (open
first). The badge shows a bucketed label (Easy / Medium / Hard), not the raw
number.

### 5.5 Truncation

The reference cuts to the first 10 candidates found, which is effectively
random. Here: generate within the node budget, score all of it, then keep the
top N per position group (default 6). "Show more" expands a group.

**A fingering's identity is its fret pattern.** One pattern can admit several
legal finger assignments (§5.3); only the best-scoring assignment is kept.
Otherwise the grid fills with entries that look pixel-identical and differ only
in a number on a dot.

**The node budget must not fight the ranking.** A single global budget can be
exhausted before the search reaches the low positions — and since open strings
score best (§5.4), that would truncate away exactly the fingerings we most want
to show. So the budget is **per fret window**, and windows are searched from the
nut outward. Truncation then costs the high, hard voicings, which is the right
thing to lose.

---

## 6. Rendering

`diagram.js` computes geometry from a `Fingering` plus `DiagramOptions`
(`orientation`, `handed`, `labels`, `size`); `chord-box.js` and `neck.js` turn
that geometry into SVG. Left-handed mode is a coordinate transform, not a second
code path.

SVGs are cached in an LRU keyed by `fingering + options`, as the reference's
`svgCache` does. SVG (not canvas) keeps print and export trivial — the export
path is the same string already on screen. Everything is themed with CSS custom
properties so light, dark and print styles run off one set of tokens.

### 6.1 Accessibility

Full screen-reader and keyboard support is a v1 requirement. SVG is what makes
this affordable: the geometry we already compute is exactly what a description
needs, so a diagram can describe itself.

- Each diagram is `role="img"` with an `aria-label` generated from the
  `Fingering` — chord name in the user's dialect, the shorthand, the position,
  the barre if any, and which string carries the root:

  > *"C major, x32010, open position, fingers 3-2-1, root on the 5th string."*

- The shorthand is **also** visible text, not only in the label.
- **No meaning carried by colour alone.** The reference draws a red `X` and a
  green `O` — the glyphs already differ, so colour is decoration there. The
  difficulty badge (§5.4) must follow the same rule: a word, not just a hue.
- WCAG AA contrast in light, dark and print. The theme tokens above are the
  single place this is enforced.
- Full keyboard operation with visible focus. The horizontally scrolling result
  rows (§2.3) are the main risk — a scroll container must be traversable by
  keyboard, not mouse and touch only.
- Results announce through a polite live region ("12 fingerings in 4
  positions"), since the grid updates without a navigation.
- `prefers-reduced-motion` honoured for any transition.

This is cheap done from the first diagram and expensive to retrofit, so it is a
constraint on phase 4 rather than a phase of its own.

---

## 7. PWA and offline

- **Mobile-first.** Single column on phone: instrument chip pinned to the header,
  chord input, then result groups as horizontal scroll rows. On desktop it
  becomes a filter sidebar plus a diagram grid, instrument chip still in the
  header.
- **Precache everything.** No runtime data fetches; the service worker precaches
  the full build. No network is ever required after first load.
- **Update flow.** New service worker installs in the background; an "update
  available — reload" toast appears rather than reloading under the user.
- Manifest with maskable icons, standalone display, portrait-primary.
- A teacher should be able to add it to a phone home screen and use it in a
  lesson with no signal.

---

## 8. Persistence and sharing

### 8.1 URL state

```
?c=Cmaj7%2311&i=6guitar&t=D2,A2,D3,G3,B3,E4&h=jazz&span=4
```

The chord travels in **canonical form**, so the recipient sees it in their own
dialect. The instrument travels as catalog id + tuning, and if it differs from
the recipient's active instrument it triggers the §2.1 "viewing as" bar rather
than retuning the content or hijacking their default. A non-default heuristics
config serializes only its diffs from the named preset.

### 8.2 Song sheet sharing

Sheets can be large, so they go in the **fragment** (never sent to a server,
even if one were later introduced) as compressed JSON:

```
#s=<base64url(deflate(json))>
```

Compression uses the platform's `CompressionStream('deflate')` rather than a
bundled library, which keeps the no-dependency claim honest. It is available in
every browser that can run the rest of this app; there is no fallback path
because a sheet that fails to compress can simply be shared as a file instead.

Opening such a URL shows an import preview before writing to localStorage.

### 8.3 localStorage schema

```
ec:v1:instruments   [ InstrumentInstance, ... ]   // includes per-instrument heuristics
ec:v1:active        'inst_3'
ec:v1:prefs         dialect + display prefs
ec:v1:favorites     [{ instrumentId, chord, frets }]
ec:v1:sheets        [{ id, title, instrumentId, sections: [...], updated }]
```

All keys versioned; a migration step runs on load when the version advances.
Favorites and sheets are tagged by `instrumentId` and filtered to the active
instrument by default.

---

## 9. Testing

### 9.1 The layering rule

The core is pure and synchronous (§3.2), which means **almost all correctness
can be tested without a browser**. The discipline that follows from that:

> Music theory is tested in unit tests. The browser is tested for journeys,
> wiring, persistence and accessibility — never for whether `Cmaj7` has a
> major 7th.

Concretely: no Playwright test enumerates chord voicings. If a fingering is
wrong, that is a Vitest failure. If a correct fingering fails to appear on
screen, that is a Playwright failure. Keeping this line sharp is what stops the
e2e suite from becoming slow and duplicative.

| Layer | Tool | Covers | Speed |
|---|---|---|---|
| Unit | Vitest | `core/` — pitch, chords, notation, search, fingers, score | ms |
| Golden | Vitest snapshots | full search output per (chord, instrument, preset) | ms |
| Render | Vitest + jsdom | SVG string snapshots, aria labels | ms |
| E2E | Playwright | user journeys, persistence, URL/share, offline | seconds |
| A11y | Playwright + axe | violations per view, keyboard traversal | seconds |
| Perf | Vitest | node-budget assertions on the search | ms |

### 9.2 Unit tests (Vitest)

Table-driven, over the pure core:

- **Spelling** — `Db` major spells `Db F Ab`, never `C# F G#`; `#11` on C spells
  `F#`; `b5` on C spells `Gb`; `transposeNote('Bb', majorThird)` is `D`, not
  `C##`.
- **Notation round-trip matrix** (§4.4) — `parse(format(c, d), d) ≡ c` for every
  dialect and every chord in the corpus, plus cross-dialect round trips for
  unambiguous chords, plus explicit cases pinning `C7+` and `C9` per dialect.
- **Known-good shapes** — the acceptance fixtures in §10 phase 3, which are real
  chord shapes a player would recognise.
- **Finger-assignment properties** — for every generated fingering, assert the
  hand is physically possible: no finger on two frets, no lower-numbered finger
  above a higher-numbered one, barre only at the lowest fretted fret, no finger
  muting a string that must sound.

### 9.3 Golden tests

Full search output for a fixed set of (chord, instrument, preset) triples,
committed as snapshots. Heuristic and scoring changes then show up as a
reviewable diff — "this tweak dropped 4 voicings and reordered 2" — rather than
as a silent behaviour change. This is the main defence for §5.4, whose weights
are admittedly guesses until calibrated (§11).

### 9.4 End-to-end (Playwright)

Two projects, because mobile-first is a stated goal and the layouts genuinely
differ (§7):

```js
projects: [
  { name: 'desktop', use: devices['Desktop Chrome'] },   // 1280x800
  { name: 'mobile',  use: devices['Pixel 5'] },
]
```

A small, named set of specs — kept small on purpose:

| Spec | Journey |
|---|---|
| `first-run` | fresh profile → setup → lands in explorer configured |
| `explore` | enter a chord both ways, results appear, grouped and ranked |
| `instruments` | switch instrument, persistence, `viewAs` from a shared link |
| `heuristics` | preset changes results; configs stay separate per instrument |
| `library` | favourites and custom tunings survive reload |
| `sheets` | build a sheet, print layout, share-link round trip |
| `offline` | service worker, offline reload, update toast |
| `a11y` | axe on each main view, keyboard traversal of the result grid |

Three capabilities Playwright gives us that matter specifically here:

- **`context.setOffline(true)`** — the offline guarantee (§7) is otherwise
  untestable and would rot. The test reloads *and then computes a chord it has
  never seen*, which proves the search has no network dependency rather than
  just that the shell was cached.
- **`page.emulateMedia({ media: 'print' })`** — the song sheet print layout
  (§2.5) is a deliverable, and print CSS is famously easy to break unnoticed.
- **Real service worker and Web Worker execution** — jsdom has neither, so the
  worker wiring (§3.5) and SW scope (§3.1) are only genuinely exercised here.

### 9.5 Accessibility

`@axe-core/playwright` runs against each main view, with zero violations as the
gate. Beyond automated scanning, which catches perhaps half of what matters:

- Every diagram exposes a non-empty `aria-label` containing the chord name and
  the shorthand (§6.1).
- The difficulty badge exposes a text label, not only a colour.
- The horizontally scrolling result rows are traversable by keyboard — asserted
  by tabbing to the last diagram in a group without a mouse.
- The results live region announces after a search completes.

### 9.6 Performance

6-string search under ~150 ms, 8-string under ~500 ms. Asserted as a
**node-budget** count rather than wall-clock, so CI stays stable on noisy
runners; a wall-clock check runs locally only, as a warning.

### 9.7 CI and deployment

A single `ci.yml`, pinned to the Node version in `.node-version` so local and
CI runtimes cannot drift. It runs on every push and pull request:

```
check (lint + unit + golden + render)
  → build (+ assert the base path)
  → e2e (Playwright)
  → deploy   [main only]
```

Staged deliberately. Lint and unit tests are milliseconds, so a broken core
fails in seconds rather than after a multi-minute browser run. Playwright is the
slowest job and runs late, with its browser downloads cached.

Deployment is a conditional job in the same workflow rather than a separate
`deploy.yml` triggered by `workflow_run`. That coupling reports status poorly on
the commit and makes ordering implicit; a `needs:` edge guarantees the same
thing and gives one status check to read.

The build job asserts the base path appears in the built HTML. A wrong `base`
fails silently in the browser rather than at build time, so it is worth one
`grep` in CI.

Deployment is wired up in **phase 1**, before there is anything worth looking
at. That is deliberate: §3.1 notes the `base` path is painful to correct later
because it fixes asset URLs and service worker scope together, and the only way
to know it is right is to serve the app from the real subpath. A one-line page
deployed on day one verifies what a comment cannot.

*One-time manual step:* the repository's **Settings → Pages → Source** must be
set to **GitHub Actions**. Nothing in the workflow can do this for you, and the
deploy job fails with a permissions error until it is done.

---

## 10. Build order and acceptance criteria

Each phase is done when its criteria hold and its tests pass. Criteria are
written to be falsifiable — a real chord shape, a real reload, a real
assertion — rather than "works correctly".

### Phase 1 — Pitch and chord model
**Ships:** `core/pitch.js`, `core/chord.js`, Vite scaffold with `base` set,
ESLint config, and both CI workflows.
**Done when:**
- `Db` major spells `Db F Ab`; `#11` on C spells `F#`; `b5` on C spells `Gb`.
- `Interval` is `{ letterSteps, semitones }`; `transposeNote('Bb', M3)` = `D`.
- `ChordTones` assigns a `role` (root/third/fifth/seventh/extension) to each tone.
- **No `async` anywhere in `core/`** — the reference's mistake, guarded by a lint
  rule rather than a convention.
- `vite.config.js` has `base: '/explore-chords/'` (§3.1).
- `npm run lint`, `npm test` and `npm run build` all pass locally.
- **`ci.yml` is green on GitHub**, and **`deploy.yml` has published a page that
  actually loads at `ruoso.github.io/explore-chords/`** — proving the base path
  rather than assuming it (§9.7).
**Tests:** Vitest unit, table-driven.

### Phase 2 — Notation
**Ships:** `core/notation/`.
**Done when:**
- `C7M`, `Cmaj7` and `C∆7` all parse to the same canonical `Chord`.
- `C7+` parses as `Cmaj7` in Brazilian and `C7♯5` in American.
- `C9` returns an ambiguity with both readings, not a silent choice.
- `CM7` and `Cm7` parse differently — case is never normalised.
- `C/E` is a slash bass; `C6/9` is a compound quality.
- Invalid input returns errors without throwing.
**Tests:** round-trip matrix (§9.2), explicit ambiguity cases.

### Phase 3 — Search, fingers, scoring
**Ships:** `core/instrument.js`, `search.js`, `fingers.js`, `score.js`.
**Done when** — using real shapes as fixtures:
- Guitar `E2 A2 D3 G3 B3 E4`, C major → `x32010` present, in the `Open` group,
  ranked in the top 2.
- Same, F major → `133211` present and flagged as a barre.
- Same, A minor → `x02210`; D major → `xx0232`.
- **Ukulele `G4 C4 E4 A4`** (re-entrant), C major → `0003`; F major → `2010`;
  G major → `0232`. This is the direct regression test for the reference's
  strictly-ascending rule (§4.3), which returns almost nothing here.
- `C/E` produces only fingerings whose lowest sounding pitch is `E`.
- Property test: no physically impossible hand, ever (§9.2).
- Node budget respected; per-window budget means the `Open` group is never the
  part that gets truncated (§5.5).
**Tests:** Vitest unit + golden snapshots + perf budget.

### Phase 4 — Rendering
**Ships:** `render/`, a minimal page with a hardcoded chord.
**Done when:**
- SVG snapshot for `x32010` is stable, showing finger numbers and `X`/`O`.
- A barre chord renders the barre as a bar, not five separate dots.
- Left-handed mode is an exact mirror; horizontal neck orientation renders.
- Every diagram has a non-empty `aria-label` with chord name and shorthand.
- axe reports zero violations on the page.
- Print stylesheet renders diagrams legibly with no colour-only information.
**Tests:** Vitest SVG snapshots, axe. **Accessibility starts here and is a
constraint on every later phase** — it is not a phase of its own.

### Phase 5 — Store, instruments, `viewAs`
**Ships:** `state/`, `ui/instrument-setup.js`, `instrument-chip.js`, `view-as-bar.js`.
**Done when:**
- A fresh profile lands on setup, not the explorer.
- After setup, reload returns to the explorer with the same instrument — no
  second setup prompt.
- The switcher changes the active instrument and results re-derive without a
  reload.
- A link carrying a different instrument shows the "viewing as" bar; *Back to
  mine* restores; **reload does not persist the override**; *Keep as default*
  does.
**Tests:** Playwright `first-run`, `instruments`.

### Phase 6 — Chord input and URL state
**Ships:** `ui/chord-input.js`, `state/url.js`.
**Done when:**
- Typing `Cmaj7` updates the pickers; changing a picker updates the text.
- The URL updates as state changes, and pasting it into a fresh session
  reproduces chord, instrument and tuning.
- Invalid text leaves the last valid results on screen (non-blocking, §2.2).
- The ambiguity chip appears for `C9` and flips the reading in one tap.
**Tests:** Playwright `explore`.

### Phase 7 — Result view
**Ships:** `ui/results.js`.
**Done when:**
- Groups appear as `Open`, `Fret 1`, `Fret 3`… skipping empties, in that order.
- Within a group, fingerings sort by ascending difficulty score.
- *Show more* expands a truncated group.
- The difficulty badge carries a word, not only a colour.
- The result grid is fully keyboard traversable, including the scroll rows.
- `C13#11` on a ukulele shows the plain empty state naming the heuristics panel
  (§2.3) — not an approximation.
**Tests:** Playwright `explore`, `a11y`.

### Phase 8 — Heuristics
**Ships:** `ui/heuristics-dialog.js`.
**Done when:**
- Switching preset re-runs the search and visibly changes the results.
- Editing any single rule flips the preset label to `Custom`.
- A guitar and a ukulele hold **separate** configs — switch away and back, and
  each retains its own (§2.4).
- Config survives reload.
**Tests:** Playwright `heuristics`.

### Phase 9 — Favourites and tunings
**Ships:** `ui/library.js`.
**Done when:**
- A starred fingering survives reload.
- The library filters to the active instrument by default.
- A saved custom tuning appears in the switcher as its own instance.
**Tests:** Playwright `library`.

### Phase 10 — Song sheets
**Ships:** `ui/sheet-editor.js`, `sheet-print.js`, `state/codec.js`.
**Done when:**
- A fingering can be added to a sheet from the result grid.
- Sections can be added, named and reordered.
- The legend lists each distinct chord+fingering exactly once.
- Under `emulateMedia({ media: 'print' })` the sheet shows legend and
  progressions and fits the page.
- A share link round-trips through `CompressionStream` and imports with a
  preview step.
- Opening a sheet whose instrument is not active raises the `viewAs` bar (§2.1).
**Tests:** Playwright `sheets`.

### Phase 11 — PWA
**Ships:** manifest, service worker, update toast.
**Done when:**
- The service worker registers with scope `/explore-chords/`.
- **Offline: reload with the network off, then compute a chord never searched
  before.** Caching the shell is not enough — this proves the search has no
  network dependency.
- The manifest validates and icons are maskable; the app is installable.
- A new service worker surfaces the update toast rather than reloading under the
  user (§7).
**Tests:** Playwright `offline`.

---

Phases 1–4 are the risk; everything after is additive. Two things are
deliberately not phases: **accessibility** (§6.1), a constraint from phase 4
onward, and **the Vite `base` path** (§3.1), set in phase 1 because changing it
later invalidates asset URLs and service worker scope together.

---

## 11. Open questions

- **Fret count per instrument** — a ukulele search should not offer fret 20.
  `fretCount` is in the model; the catalog needs real values per instrument.
- **Difficulty buckets** need calibration against real shapes once the scorer
  runs. The §5.4 thresholds are a starting guess.
- **Capo — deferred, and less cheap than it looks.** The search side is trivial
  (raise the open strings, offset the displayed frets). The hard part is that a
  capo changes *what a chord name means*: with a capo on 3, the shape a player
  calls "C" sounds E♭. So a capo feature has to decide whether the user asking
  for "C" wants the shape that sounds C or the shape named C, whether diagrams
  number frets from the nut or the capo, and whether the nut line moves. Those
  are the app's core naming contract, not a display detail — which is why the
  field was removed rather than left unused. **v1's answer is a custom tuning**
  (§4.3): a capo is exactly a tuning with every string raised equally, it always
  means sounding pitch, and it needs no new code. What a real capo feature adds
  on top is the shape-name layer — "play your C shape" — and that is the part
  that needs design.
- **Transposition — deferred to v2, with one question already known** (§4.5).
  When it lands, the deciding question is not theory but what a teacher sees
  when a key change invalidates every pinned fingering at once: re-pin each slot
  by hand, auto-shift shapes where they still fit, or offer a capo and keep the
  shapes identical. Worth a dedicated design pass with a real teacher workflow
  in hand. v1 owes it only the three forward-compatibility items in §4.5.
- **Auto-relaxing heuristics — deferred, and worth revisiting once real usage
  exists.** v1 reports "no fingerings found" plainly (§2.3). The appeal of
  auto-relaxing is that a beginner asking for `C13#11` on a ukulele gets
  *something*; the risk is showing a chord that is not the one asked for. If it
  lands, the design needs a defined, ordered relaxation ladder, and it must
  distinguish relaxations that preserve chord identity (drop the 5th, allow an
  inner mute) from ones that change it (drop the 11th) — the latter needs much
  louder labelling. It should also not silently override a rule the user
  explicitly set in the expert panel. Worth deciding only after we can see how
  often the empty state actually fires.
- **Audio playback — cut from v1** (§1). If it returns, Karplus-Strong pluck
  synthesis (~30 lines of Web Audio, no samples, no dependency) is the option
  that fits an offline-first PWA; sampled instruments would add megabytes to a
  bundle that must precache entirely.
- **Do instrument instances need groups?** A teacher with eight set-up
  instruments may want the switcher grouped or searchable. Defer until the list
  is actually long.
