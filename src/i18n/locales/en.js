/**
 * English — the source language. Every other language is checked against the
 * keys here; a key missing elsewhere falls back to this text.
 *
 * Plurals are written as `{ one, other }` and chosen by `count`.
 */
export default {
  app: { name: 'Explore Chords' },

  ordinal: { one: '{n}st', two: '{n}nd', few: '{n}rd', other: '{n}th' },

  locale: { label: 'Language' },

  header: {
    help: 'Help',
    helpLabel: 'Help and what changed',
  },

  nav: {
    label: 'Sections',
    explore: 'Chords',
    instrument: 'Instrument',
    library: 'Saved',
    sheets: 'Songs',
    backup: 'Backup',
  },

  chip: {
    summary: 'Instrument: {label}. Change instrument.',
    add: '+ Add instrument',
  },

  viewAs: {
    fromSheet: 'from this sheet',
    fromLink: 'from the link',
    viewing: ' Viewing as {label} ({source})',
    back: 'Back to my {label}',
    keep: 'Keep as my default',
  },

  input: {
    label: 'Chord',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Show',
    readAs: ' Read “{text}” as {reading}. ',
    use: 'Use {reading}',
    build: 'Build the chord',
    root: 'Root',
    quality: 'Quality',
    seventh: 'Seventh',
    bass: 'Bass',
    bassRoot: 'Root',
    extensions: 'Extensions',
  },

  quality: {
    major: 'Major',
    minor: 'Minor',
    dim: 'Diminished',
    aug: 'Augmented',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'No 7th',
    dominant: 'Dominant 7th',
    major: 'Major 7th',
    diminished: 'Diminished 7th',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'major 7th',
      dominantSharpFive: 'dominant 7th, raised 5th',
    },
    bareNine: {
      add: 'added 9th, no 7th',
      dominant: 'dominant 9th, includes the flat 7th',
    },
    degreeSign: {
      diminishedSeventh: 'diminished 7th',
      diminishedTriad: 'diminished triad, no 7th',
    },
  },

  errors: {
    empty: 'Enter a chord.',
    unexpected: 'Unexpected "{text}".',
    needsNumber: '"{text}" must be followed by a number.',
    bassNeeded: 'A "/" must be followed by a bass note or a number.',
    badNote: 'Cannot parse note: {text}',
    badPitch: 'Cannot parse pitch: {text}',
    emptyTuning: 'A tuning needs at least one string.',
    unknownQuality: 'Unknown chord quality: {quality}',
    badDegree: 'Bad extension degree: {degree}',
    badAlteration: 'Bad extension alteration: {alter}',
    unknownDialect: 'Unknown notation dialect: {dialect}',
    noRoot: '"{text}" does not start with a note name.',
    badRoot: 'Cannot read the root note "{text}".',
    badBass: 'Cannot read the bass note "{text}".',
    unreadable: 'Cannot read "{text}" in "{whole}".',
    noSheetInLink: 'That link carries no sheet.',
    cannotDecompress: 'This browser cannot read compressed sheet links.',
    unknownLinkFormat: 'That link is not in a format this app understands.',
    notASheet: 'That link does not contain a song sheet.',
  },

  toggles: {
    label: 'Diagram display',
    neck: 'Neck view',
    left: 'Left-handed',
  },

  results: {
    announceNone: 'No fingerings found.',
    announceCount: '{count} fingerings in {positions} positions.',
    empty: 'Enter a chord to see how it can be played.',
    none: 'No fingerings for this chord on {label}.',
    noneHelp:
      'It may need more strings than this instrument has, or your voicing rules may be too strict.',
    adjustRules: 'Adjust voicing rules',
    save: ' Save',
    saved: ' Saved',
    saveLabel: 'Save {shorthand} to your library',
    removeLabel: 'Remove {shorthand} from your library',
  },

  groups: {
    open: 'Open position',
    fret: 'Fret {position}',
    list: '{position} fingerings',
    showFewer: 'Show fewer',
    showAll: 'Show all {count}',
  },

  difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },

  diagram: {
    open: 'open position',
    startingAt: 'starting at fret {position}',
    barre: 'barre across {count} strings at fret {fret}',
    fingers: 'fingers {fingers}',
    muted: { one: '{count} string not played', other: '{count} strings not played' },
    rootOn: 'root on the {ordinal} string',
    toPlay: '{difficulty} to play',
  },

  library: {
    title: 'Saved shapes',
    empty: 'Nothing saved for {label} yet. Star a shape on the chords screen to keep it here.',
    count: '{count} saved for {label}.',
    list: 'Saved shapes for {label}',
    open: 'Open',
    openLabel: 'Show {chord} on the chords screen',
    remove: 'Remove',
    removeLabel: 'Remove {chord} {shorthand} from your saved shapes',
  },

  catalog: {
    '6guitar': 'Guitar (6-string)',
    '7guitar': 'Guitar (7-string)',
    '4bass': 'Bass (4-string)',
    '5bass': 'Bass (5-string)',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolin',
    tenorbanjo: 'Tenor banjo',
  },

  tuning: {
    Standard: 'Standard',
    'Drop D': 'Drop D',
    'Open G': 'Open G',
    'Open D': 'Open D',
    DADGAD: 'DADGAD',
    'Open C': 'Open C',
    Brazilian: 'Brazilian',
    'Standard (re-entrant)': 'Standard (re-entrant)',
    'Low G': 'Low G',
    Baritone: 'Baritone',
    'Standard (Brazil)': 'Standard (Brazil)',
    Irish: 'Irish',
    custom: 'Custom',
    customOption: 'Custom tuning',
  },

  form: {
    edit: 'Edit instrument',
    choose: 'Choose your instrument',
    add: 'Add an instrument',
    firstRunHelp: 'Everything is shown for this instrument. You can add others and switch at any time.',
    addHelp: 'It joins your list; the header switcher moves between them.',
    instrument: 'Instrument',
    fallbackName: 'Instrument',
    tuning: 'Tuning',
    strings: 'Strings',
    stringsHelp: 'Lowest string first. Any comma-separated pitch list works, including re-entrant tunings.',
    style: 'How you play',
    styleHelp:
      'It sets which shapes you are offered: fingerstyle allows a muted string in the middle of a chord, strumming does not. The instrument screen can change it later.',
    name: 'Name',
    nameHelp: 'Shown in the switcher. Give custom tunings names you will recognise.',
    frets: 'Frets',
    save: 'Save changes',
    start: 'Start playing',
    addButton: 'Add instrument',
    cancel: 'Cancel',
    needName: 'Give the instrument a name.',
    badTuning: 'That tuning does not read: {reason}',
  },

  backup: {
    title: 'Backup',
    help:
      'Everything you have is kept in this browser, which is fine until the device is not. ' +
      'A backup is one zip holding your instruments and settings, your saved shapes, and ' +
      'every song as a plain text file you can read and edit anywhere.',
    save: 'Save a backup',
    insideTitle: 'What is in it',
    inside:
      'One zip, with your instruments and their rules and your settings in one file, your ' +
      'saved shapes in another, and every song as a text file named after it. Drop another ' +
      'song into the songs folder with any zip tool and it comes back with the rest.',
    restore: 'Restore a backup',
    confirmTitle: 'Restore from “{name}”?',
    confirmBody:
      'Everything on this device is replaced by what the file holds: {instruments} and {songs}.',
    instruments: { one: '{count} instrument', other: '{count} instruments' },
    songs: { one: '{count} song', other: '{count} songs' },
    confirmButton: 'Replace everything',
    failed: 'That backup could not be read: {reason}',
  },
  instruments: {
    title: 'Instruments',
    help:
      'Everything on screen is for the instrument in use. Each keeps its own tuning, voicing rules, saved shapes and songs.',
    inUse: 'In use',
    reentrant: 'Re-entrant',
    meta: '{tuning} · {count} frets',
    use: 'Use',
    useLabel: 'Use {label}',
    edit: 'Edit',
    editLabel: 'Edit {label}',
    delete: 'Delete',
    deleteLabel: 'Delete {label}',
    add: 'Add instrument',
    back: '← All instruments',
    deleteThis: 'Delete this instrument',
    confirmTitle: 'Delete {label}?',
    confirmShapes: {
      one: 'Its {count} saved shape will go with it. ',
      other: 'Its {count} saved shapes will go with it. ',
    },
    confirmSongs: 'Songs are kept, since they carry their own tuning. This cannot be undone.',
    confirmButton: 'Delete instrument',
  },

  rules: {
    title: 'Voicing rules',
    help: 'How chords are voiced on {label}.',
    preset: 'Preset',
    custom: 'Custom',
    presets: {
      beginner: 'Beginner',
      strumming: 'Strumming',
      fingerstyle: 'Fingerstyle',
      jazz: 'Jazz',
      bassFriendly: 'Bass-friendly',
    },
    rules: 'Rules',
    rootInBass: 'Root must be the lowest note',
    requireThird: 'Require the 3rd',
    omitFifth: 'The 5th may be omitted',
    allowRootless: 'Allow rootless voicings',
    requireExtensions: 'Require every named extension',
    allowBarre: 'Allow barre chords',
    allowInnerMutes: 'Allow a muted string between sounding ones',
    allowDoubling: 'Allow a note on more than one string',
    allowDuplicatePitch: 'Allow the identical pitch twice',
    limits: 'Limits',
    maxSpan: 'Maximum stretch (frets)',
    minSoundingStrings: 'Fewest strings sounding',
    maxResultsPerGroup: 'Shapes shown per position',
    weights: 'Difficulty weights',
    weightsHelp:
      'How much each thing counts towards a shape being hard. Negative values make a shape easier.',
    weight: {
      spanPerFret: 'Stretch, per fret',
      barre: 'Barre',
      fullBarre: 'Full barre, extra',
      perFinger: 'Each finger',
      innerMute: 'Inner muted string',
      mutedString: 'Each muted string',
      positionPerFret: 'Position, per fret',
      omittedFifth: 'Omitting the 5th',
      rootless: 'Omitting the root',
      nonRootBass: 'Unrequested inversion',
      openString: 'Each open string (a bonus)',
      nonAdjacentStretch: 'Wide stretch',
    },
  },

  sheets: {
    title: 'Song sheets',
    help: 'Chords for a song on {label}, each pinned to the fingering you want taught.',
    titlePlaceholder: 'Song title',
    newTitleLabel: 'New song title',
    create: 'New song',
    untitled: 'Untitled song',
    shared: 'Shared song',
    sharedInstrument: 'Shared instrument',
    empty: 'No songs yet.',
    measures: { one: '{count} measure', other: '{count} measures' },
    chords: { one: '{count} chord', other: '{count} chords' },
    chosenHere: { one: ' · {count} voicing chosen here', other: ' · {count} voicings chosen here' },
    voicedFor: 'Voiced for {list}',
    view: 'View',
    viewLabel: 'View {title}',
    edit: 'Edit',
    editLabel: 'Edit {title}',
    duplicate: 'Duplicate',
    duplicateLabel: 'Duplicate {title}',
    delete: 'Delete',
    deleteLabel: 'Delete {title}',
    imported: 'Imported the song "{title}".',
  },

  editor: {
    back: '← All songs',
    titleLabel: 'Song title',
    title: 'Title',
    song: 'The song',
    placeholder: '# Verse\nA | Cm | A | Cm',
    help: {
      sections: {
        term: 'Sections',
        text: 'Three ways to name one: a line beginning with #, a name in brackets, or a ' +
          'name and a colon. The last two may carry that section’s chords on the same ' +
          'line. A colon only names a section when chords follow it, so a sung line ' +
          'with a colon in it stays a line of words.',
        example: '# Verse\n[Intro] G  D  Em  C\nSolo: Am  F  C  G',
      },
      chart: {
        term: 'A chart',
        text: 'A vertical bar starts a new measure; spaces separate the chords inside one.',
        example: 'C  Am | F  G | C\nF     | G    | C',
      },
      words: {
        term: 'Or the words underneath',
        text: 'A line of chords over the line it is sung to, each chord above the syllable it falls on.',
        example: 'G            D\nWhen I first saw you',
      },
      either: {
        term: 'When a line could be either',
        text: 'A vertical bar makes it a chart. A leading > makes it words, and is the only way to settle a line that reads as a chord.',
        example: 'G\n> A',
      },
      voicings: {
        term: 'Voicings',
        text: 'They sit after a --- rule, one block per tuning under a heading that names it, so the same song serves every instrument. A chord played more than one way is footnoted. A chord you have saved a shape for gets that shape when it first appears.',
        example: '---\n\n# Voicings: E2, A2, D3, G3, B3, E4\nCm = x35543\nCm[2] = 8-10-10-8-8-8',
      },
    },
    notAChord: 'Not a chord: {list}',
    badVoicingLines: 'Could not read these voicing lines: {list}',
    chart: 'The chart',
    chartHelp: 'Click any chord to choose how that one is played.',
    nothingYet: 'Nothing written yet.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', using the default shape',
    chordUnvoiced: ', cannot be voiced',
    chordChoose: '. Choose a voicing.',
    voicings: 'Voicings',
    voicingsHelp: 'Click a shape to change it everywhere it is used.',
    voicingsDefaults:
      ' Shapes marked default are what the explorer would show first; choose only the ones that need it.',
    voicingsEmpty: 'Write the song above and its chords appear here.',
    voicingsList: 'Voicings used in this song',
    choose: 'Choose',
    change: 'Change',
    everywhere: '{verb} {key} everywhere. ',
    usingDefault: 'Using the default shape. ',
    usedIn: { one: 'Used in {count} place.', other: 'Used in {count} places.' },
    default: 'default',
    missing: 'No playable shape on {label} for: {list}. Its voicing rules may be too strict.',
    share: 'Share link',
    snapPage: 'Line this page up',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    pageOf: 'Page {current} of {total}',
    print: 'Print',
    shareLabel: 'Share link for this song',
    shareHelp: 'Anyone opening this link sees the song as written.',
  },

  picker: {
    changeEverywhere: 'Change {label} everywhere',
    howPlayed: 'How is {chord} played here?',
    noParse: 'That chord does not parse.',
    none: 'No fingerings for {chord} on {label}. Its voicing rules may be too strict.',
    replaces: { one: 'Replaces this shape in {count} place. ', other: 'Replaces this shape in {count} places. ' },
    ways: '{count} ways to play it, grouped by position and easiest first.',
    changesOne: 'Changes this one chord. ',
    chosen: ', currently chosen',
    clearEverywhere: 'Clear everywhere',
    clearChoice: 'Clear choice',
    cancel: 'Cancel',
  },

  print: { legend: 'Chord shapes used' },

  confirm: { cancel: 'Cancel', confirm: 'Delete' },

  install: {
    title: 'Add Explore Chords to your home screen',
    label: 'Install this app',
    promptHelp: 'It opens like an app and keeps working with no network — handy in a lesson.',
    iosHelp:
      'Tap Share, then "Add to Home Screen". It then opens like an app and keeps working with no network.',
    install: 'Install',
    notNow: 'Not now',
    gotIt: 'Got it',
    never: "Don't ask again",
  },

  update: {
    ready: 'A new version is ready.',
    reload: 'Reload',
    later: 'Later',
  },

  announce: {
    whatsNew: "What's new",
    showTutorial: 'Show the tutorial',
    letsGo: "Let's go",
    close: 'Close',
    sinceLast: 'What changed since your last visit',
  },

  announcements: {
    welcome: {
      title: 'Welcome to Explore Chords',
      sections: [
        {
          heading: 'Find a chord',
          text:
            'Type it the way you write it — C7M, Cmaj7 or C∆7 all work — and every way to play ' +
            'it on your instrument appears, grouped by where the hand sits and easiest first. ' +
            'When a symbol could mean two things, a chip says which reading was taken and ' +
            'lets you flip it.',
        },
        {
          heading: 'Your instrument comes first',
          text:
            'The switcher in the header moves between the instruments you have set up. Each ' +
            'keeps its own tuning and its own voicing rules; the Instrument screen is where ' +
            'you edit them, and where a bass and a ukulele are allowed to want different things.',
        },
        {
          heading: 'Save the shapes you like',
          text:
            'Star any shape and it goes to Saved. Later, a chord you have a saved shape for ' +
            'takes that shape automatically when it first appears in a song.',
        },
        {
          heading: 'Write songs as text',
          text:
            'Under Songs, a chart is plain text: a line starting with # names a section, a ' +
            'vertical bar starts a new measure, spaces separate chords in one. Click any chord ' +
            'to choose how it is played; the choice is written back into the text after a --- ' +
            'rule, one block per tuning, so the same song serves every instrument.',
        },
        {
          heading: 'It works without a signal',
          text:
            'Once loaded, everything runs on your device. Add it to your home screen and take ' +
            'it into a lesson with no network at all.',
        },
      ],
    },
    '0.2.0': {
      title: 'What changed in 0.2',
      sections: [
        {
          heading: 'One song, every instrument',
          text:
            'A song no longer belongs to one instrument. Its voicings are kept per tuning, ' +
            'after a --- rule in the text, so the same chart plays on your guitar and your ' +
            'ukulele with each keeping its own shapes. Songs saved in the earlier form convert ' +
            'on their own, and separate per-instrument copies of one song fold into one.',
        },
        {
          heading: 'Chords you have not chosen a shape for still have one',
          text:
            'They take the shape the chord screen would show first, marked as a default. ' +
            'Choose only the ones that need it.',
        },
        {
          heading: 'Saved shapes flow into songs',
          text:
            'A shape you have starred is used the moment its chord first enters a song, if it ' +
            'differs from the default.',
        },
        {
          heading: 'B° means the seventh',
          text:
            'A bare ° now reads as the diminished seventh, which is what the symbol means in ' +
            'practice; the word dim is the triad, and a chip offers the other reading.',
        },
      ],
    },
    '0.3.0': {
      title: 'What changed in 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'The app now speaks Brazilian Portuguese, Latin American Spanish and Italian as ' +
            'well as English. It follows your browser’s language; the selector in the header changes ' +
            'it, and the choice is remembered on this device.',
        },
        {
          heading: 'Charts line up',
          text:
            'On screen and in print, the measures of a section sit in columns, the way a ' +
            'hand-written chart does, and the printed sheet leads with the chart and keeps ' +
            'the shapes small below it.',
        },
      ],
    },
    '0.4.0': {
      title: 'What changed in 0.4',
      sections: [
        {
          heading: 'Strumming or fingerstyle',
          text:
            'The rules that used to be called Standard are now Strumming, and Fingerstyle sits ' +
            'beside them. A picking hand can simply not pick the string in the middle of a ' +
            'chord, so fingerstyle allows shapes strumming cannot reach. Setting up an ' +
            'instrument now asks which you play, and the instrument screen changes it later.',
        },
        {
          heading: 'No more shapes muted for nothing',
          text:
            'A shape is no longer offered when the same shape with one of its muted strings ' +
            'ringing is on offer too and the fingers that fill it go down easily. G minor gives ' +
            'you 3x0333, where the D string rings, instead of 3xx333, where it is damped for ' +
            'no reason, and open C is offered whole rather than as fragments of itself. A ' +
            'reach or a barre still counts as work, so the shapes that need one are all still ' +
            'there. A muted string in the middle also stopped counting against how hard a shape ' +
            'is: played fingerstyle, a string you do not pick costs you nothing.',
        },
      ],
    },
    '0.5.0': {
      title: 'What changed in 0.5',
      sections: [
        {
          heading: 'Songs with their words',
          text:
            'A song can now be written the way a cifra is: a line of chords over the line it ' +
            'is sung to, each chord above the syllable it falls on. Paste one in and it reads ' +
            'as one, with [Intro] and Intro: naming sections the way # already does. The words ' +
            'come with it onto the printed sheet, which now takes two columns where the song ' +
            'is narrow enough — usually halving the pages. On a phone a verse wraps instead ' +
            'of running off the side.',
        },
        {
          heading: 'Charts are untouched',
          text:
            'A song with no words under its chords reads exactly as it did before. Where a ' +
            'line could be either, a vertical bar makes it a chart and a leading > makes it ' +
            'words — which is the only way to settle a verse that really does read "A", ' +
            'against the chord of the same name.',
        },
      ],
    },
    '0.6.0': {
      title: 'What changed in 0.6',
      sections: [
        {
          heading: 'A song opens to be read',
          text:
            'A song now has a page of its own that shows it as it will come out on paper — ' +
            'the words under the chords, and the shapes you play from — rather than opening ' +
            'the editor. The text is still a button away, and the song list offers both.',
        },
        {
          heading: 'One page at a time',
          text:
            'That page is broken into pages the size of your screen, so you can see where the ' +
            'song runs past the end of one. The arrows in the corner turn them, and land a ' +
            'whole page in the clear, which makes playing from a screen a page turn rather ' +
            'than a scroll. Their middle straightens the page up again after a scroll by ' +
            'hand, and the bar at the top no longer takes a strip of the window with it.',
        },
        {
          heading: 'Cifras read better',
          text:
            'Brackets around a run of chords mark a repeat and are no longer read as chords. ' +
            'Chords that carry on past the end of a line keep the spacing they were written ' +
            'with. And a verse that wraps onto a line of one word is read as words, not as a ' +
            'chord nobody recognises.',
        },
      ],
    },
    '0.7.0': {
      title: 'What changed in 0.7',
      sections: [
        {
          heading: 'Save everything to a file',
          text:
            'Everything you have is kept in this browser, which is fine until the device is ' +
            'not. The instrument screen now saves the lot as one zip — your instruments and ' +
            'their rules, your settings, your saved shapes and every song — and restores it ' +
            'here or on another device.',
        },
        {
          heading: 'Your songs are text files',
          text:
            'Inside the zip each song is a plain text file you can read or edit with anything. ' +
            'Drop another one into the songs folder with any zip tool and it comes back as a ' +
            'song, named after its file. A backup is yours to keep, not a format only this app ' +
            'can make sense of.',
        },
      ],
    },
  },
};
