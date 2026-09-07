/**
 * Things the app tells the user unprompted: the tutorial, and what changed.
 *
 * One list, in order. The tutorial is shown the first time the app proper is
 * opened; a release note is shown once, on the first open after it appears
 * here. Adding an entry is the whole release process — give it the version
 * from package.json as its id.
 *
 * Content is structured rather than HTML, so it renders through the same
 * element helper as everything else and cannot smuggle in markup.
 */

export const ANNOUNCEMENTS = [
  {
    id: 'welcome',
    kind: 'tutorial',
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
  {
    id: '0.2.0',
    kind: 'release',
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
];
