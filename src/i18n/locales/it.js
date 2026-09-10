/**
 * Italiano.
 *
 * Il lessico di chi insegna chitarra: tasto, barré, corda a vuoto,
 * diteggiatura, battuta. "Voicing" resta in inglese, come si usa davvero.
 */
export default {
  app: { name: 'Explore Chords' },

  ordinal: { other: '{n}ª' },

  locale: { label: 'Lingua' },

  header: {
    help: 'Aiuto',
    helpLabel: 'Aiuto e novità',
  },

  nav: {
    label: 'Sezioni',
    explore: 'Accordi',
    instrument: 'Strumento',
    library: 'Salvati',
    sheets: 'Canzoni',
  },

  chip: {
    summary: 'Strumento: {label}. Cambia strumento.',
    add: '+ Aggiungi strumento',
  },

  viewAs: {
    fromSheet: 'da questa canzone',
    fromLink: 'dal link',
    viewing: ' Visualizzato come {label} ({source})',
    back: 'Torna al mio {label}',
    keep: 'Imposta come predefinito',
  },

  input: {
    label: 'Accordo',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Mostra',
    readAs: ' “{text}” letto come {reading}. ',
    use: 'Usa {reading}',
    build: 'Costruisci l’accordo',
    root: 'Fondamentale',
    quality: 'Qualità',
    seventh: 'Settima',
    bass: 'Basso',
    bassRoot: 'Fondamentale',
    extensions: 'Estensioni',
  },

  quality: {
    major: 'Maggiore',
    minor: 'Minore',
    dim: 'Diminuito',
    aug: 'Aumentato',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'Senza settima',
    dominant: 'Settima dominante',
    major: 'Settima maggiore',
    diminished: 'Settima diminuita',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'settima maggiore',
      dominantSharpFive: 'settima dominante con quinta aumentata',
    },
    bareNine: {
      add: 'nona aggiunta, senza settima',
      dominant: 'nona dominante, con la settima minore',
    },
    degreeSign: {
      diminishedSeventh: 'settima diminuita',
      diminishedTriad: 'triade diminuita, senza settima',
    },
  },

  errors: {
    empty: 'Scrivi un accordo.',
    unexpected: 'Non mi aspettavo "{text}".',
    needsNumber: '"{text}" deve essere seguito da un numero.',
    bassNeeded: 'Dopo "/" ci va una nota di basso o un numero.',
    badNote: 'Non capisco la nota: {text}',
    badPitch: 'Non capisco l’altezza: {text}',
    emptyTuning: 'Un’accordatura ha bisogno di almeno una corda.',
    unknownQuality: 'Qualità dell’accordo sconosciuta: {quality}',
    badDegree: 'Grado dell’estensione non valido: {degree}',
    badAlteration: 'Alterazione dell’estensione non valida: {alter}',
    unknownDialect: 'Sistema di notazione sconosciuto: {dialect}',
    noRoot: '"{text}" non comincia con il nome di una nota.',
    badRoot: 'Non capisco la fondamentale "{text}".',
    badBass: 'Non capisco la nota di basso "{text}".',
    unreadable: 'Non capisco "{text}" in "{whole}".',
    noSheetInLink: 'Quel link non contiene nessuna canzone.',
    cannotDecompress: 'Questo browser non riesce a leggere i link compressi delle canzoni.',
    unknownLinkFormat: 'Quel link non è in un formato che l’app capisca.',
    notASheet: 'Quel link non contiene una canzone.',
  },

  toggles: {
    label: 'Vista del diagramma',
    neck: 'Vista manico',
    left: 'Mancino',
  },

  results: {
    announceNone: 'Nessuna diteggiatura trovata.',
    announceCount: '{count} diteggiature in {positions} posizioni.',
    empty: 'Scrivi un accordo per vedere come si suona.',
    none: 'Nessuna diteggiatura per questo accordo su {label}.',
    noneHelp:
      'Forse servono più corde di quante ne abbia lo strumento, o le tue regole di voicing sono troppo rigide.',
    adjustRules: 'Modifica le regole di voicing',
    save: ' Salva',
    saved: ' Salvato',
    saveLabel: 'Salva {shorthand} nella tua libreria',
    removeLabel: 'Togli {shorthand} dalla tua libreria',
  },

  groups: {
    open: 'Posizione aperta',
    fret: 'Tasto {position}',
    list: 'Diteggiature: {position}',
    showFewer: 'Mostra meno',
    showAll: 'Mostra tutte le {count}',
  },

  difficulty: { easy: 'Facile', medium: 'Media', hard: 'Difficile' },

  diagram: {
    open: 'posizione aperta',
    startingAt: 'dal tasto {position}',
    barre: 'barré su {count} corde al tasto {fret}',
    fingers: 'dita {fingers}',
    muted: { one: '{count} corda non suonata', other: '{count} corde non suonate' },
    rootOn: 'fondamentale sulla {ordinal} corda',
    toPlay: 'difficoltà {difficulty}',
  },

  library: {
    title: 'Forme salvate',
    empty:
      'Niente di salvato per {label}, per ora. Metti una stella a una forma nella schermata degli accordi per tenerla qui.',
    count: '{count} salvate per {label}.',
    list: 'Forme salvate per {label}',
    open: 'Apri',
    openLabel: 'Mostra {chord} nella schermata degli accordi',
    remove: 'Togli',
    removeLabel: 'Togli {chord} {shorthand} dalle forme salvate',
  },

  catalog: {
    '6guitar': 'Chitarra (6 corde)',
    '7guitar': 'Chitarra (7 corde)',
    '4bass': 'Basso (4 corde)',
    '5bass': 'Basso (5 corde)',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolino',
    tenorbanjo: 'Banjo tenore',
  },

  tuning: {
    Standard: 'Standard',
    'Drop D': 'Drop D',
    'Open G': 'Sol aperto',
    'Open D': 'Re aperto',
    DADGAD: 'DADGAD',
    'Open C': 'Do aperto',
    Brazilian: 'Brasiliana',
    'Standard (re-entrant)': 'Standard (rientrante)',
    'Low G': 'Sol basso',
    Baritone: 'Baritono',
    'Standard (Brazil)': 'Standard (Brasile)',
    Irish: 'Irlandese',
    custom: 'Personalizzata',
    customOption: 'Accordatura personalizzata',
  },

  form: {
    edit: 'Modifica strumento',
    choose: 'Scegli il tuo strumento',
    add: 'Aggiungi uno strumento',
    firstRunHelp: 'Tutto viene mostrato per questo strumento. Puoi aggiungerne altri e cambiare quando vuoi.',
    addHelp: 'Si aggiunge alla tua lista; il selettore nell’intestazione passa dall’uno all’altro.',
    instrument: 'Strumento',
    fallbackName: 'Strumento',
    tuning: 'Accordatura',
    strings: 'Corde',
    stringsHelp:
      'Dalla corda più grave alla più acuta. Va bene qualsiasi elenco di note separate da virgole, comprese le accordature rientranti.',
    style: 'Come suoni',
    styleHelp:
      'Decide quali forme ti vengono proposte: con il fingerstyle una corda stoppata in mezzo all\'accordo è ammessa, con lo strumming no. La schermata dello strumento lo cambia in seguito.',
    name: 'Nome',
    nameHelp: 'Compare nel selettore. Dai alle accordature personalizzate nomi che riconosci.',
    frets: 'Tasti',
    save: 'Salva le modifiche',
    start: 'Inizia a suonare',
    addButton: 'Aggiungi strumento',
    cancel: 'Annulla',
    needName: 'Dai un nome allo strumento.',
    badTuning: 'Non capisco quell’accordatura: {reason}',
  },

  instruments: {
    title: 'Strumenti',
    help:
      'Tutto ciò che è sullo schermo è per lo strumento in uso. Ognuno conserva la sua accordatura, le sue regole di voicing, le sue forme salvate e le sue canzoni.',
    inUse: 'In uso',
    reentrant: 'Rientrante',
    meta: '{tuning} · {count} tasti',
    use: 'Usa',
    useLabel: 'Usa {label}',
    edit: 'Modifica',
    editLabel: 'Modifica {label}',
    delete: 'Elimina',
    deleteLabel: 'Elimina {label}',
    add: 'Aggiungi strumento',
    back: '← Tutti gli strumenti',
    deleteThis: 'Elimina questo strumento',
    confirmTitle: 'Eliminare {label}?',
    confirmShapes: {
      one: 'La sua {count} forma salvata se ne va con lui. ',
      other: 'Le sue {count} forme salvate se ne vanno con lui. ',
    },
    confirmSongs: 'Le canzoni restano, perché portano con sé la propria accordatura. Non si può annullare.',
    confirmButton: 'Elimina strumento',
  },

  rules: {
    title: 'Regole di voicing',
    help: 'Come vengono costruiti gli accordi su {label}.',
    preset: 'Impostazione',
    custom: 'Personalizzata',
    presets: {
      beginner: 'Principiante',
      strumming: 'Strumming',
      fingerstyle: 'Fingerstyle',
      jazz: 'Jazz',
      bassFriendly: 'Per basso',
    },
    rules: 'Regole',
    rootInBass: 'La fondamentale deve essere la nota più grave',
    requireThird: 'Richiedi la terza',
    omitFifth: 'La quinta può essere omessa',
    allowRootless: 'Consenti voicing senza fondamentale',
    requireExtensions: 'Richiedi tutte le estensioni scritte',
    allowBarre: 'Consenti il barré',
    allowInnerMutes: 'Consenti una corda stoppata tra corde che suonano',
    allowDoubling: 'Consenti la stessa nota su più di una corda',
    allowDuplicatePitch: 'Consenti la stessa altezza due volte',
    limits: 'Limiti',
    maxSpan: 'Apertura massima (tasti)',
    minSoundingStrings: 'Minimo di corde che suonano',
    maxResultsPerGroup: 'Forme mostrate per posizione',
    weights: 'Pesi della difficoltà',
    weightsHelp:
      'Quanto pesa ogni cosa nel rendere difficile una forma. I valori negativi rendono la forma più facile.',
    weight: {
      spanPerFret: 'Apertura, per tasto',
      barre: 'Barré',
      fullBarre: 'Barré completo, extra',
      perFinger: 'Ogni dito',
      innerMute: 'Corda stoppata in mezzo',
      mutedString: 'Ogni corda stoppata',
      positionPerFret: 'Posizione, per tasto',
      omittedFifth: 'Omettere la quinta',
      rootless: 'Omettere la fondamentale',
      nonRootBass: 'Rivolto non richiesto',
      openString: 'Ogni corda a vuoto (un bonus)',
      nonAdjacentStretch: 'Apertura ampia',
    },
  },

  sheets: {
    title: 'Canzoni',
    help: 'Gli accordi di una canzone su {label}, ognuno fissato alla diteggiatura che vuoi insegnare.',
    titlePlaceholder: 'Titolo della canzone',
    newTitleLabel: 'Titolo della nuova canzone',
    create: 'Nuova canzone',
    untitled: 'Canzone senza titolo',
    shared: 'Canzone condivisa',
    sharedInstrument: 'Strumento condiviso',
    empty: 'Ancora nessuna canzone.',
    measures: { one: '{count} battuta', other: '{count} battute' },
    chords: { one: '{count} accordo', other: '{count} accordi' },
    chosenHere: { one: ' · {count} voicing scelto qui', other: ' · {count} voicing scelti qui' },
    voicedFor: 'Con voicing per {list}',
    open: 'Apri',
    openLabel: 'Apri {title}',
    duplicate: 'Duplica',
    duplicateLabel: 'Duplica {title}',
    delete: 'Elimina',
    deleteLabel: 'Elimina {title}',
    imported: 'Canzone "{title}" importata.',
  },

  editor: {
    back: '← Tutte le canzoni',
    titleLabel: 'Titolo della canzone',
    title: 'Titolo',
    song: 'La canzone',
    placeholder: '# Strofa\nA | Cm | A | Cm',
    help:
      'Una riga che comincia con #, [Intro] o Intro: dà il nome a una sezione. La musica si può ' +
      'scrivere in due modi. Come schema: una barra verticale apre una battuta, gli spazi ' +
      'separano gli accordi al suo interno. Oppure con il testo sotto: una riga di accordi sopra ' +
      'la riga su cui si canta, ogni accordo sopra la sillaba su cui cade. Comincia una riga con ' +
      '> perché venga letta come testo dove verrebbe letta come accordi. ' +
      'I voicing stanno dopo una riga ---, un ' +
      'blocco per accordatura sotto un titolo che la nomina (la parola è libera: "# Posizioni: ' +
      'E2, A2, …" va bene), così la stessa canzone serve per tutti gli strumenti. Quando un ' +
      'accordo si suona in più di un modo, i voicing in più hanno una nota — Cm[2]. Un accordo ' +
      'per cui hai salvato una forma riceve quella forma la prima volta che compare.',
    notAChord: 'Non è un accordo: {list}',
    badVoicingLines: 'Non riesco a leggere queste righe di voicing: {list}',
    chart: 'Lo schema',
    chartHelp: 'Clicca un accordo per scegliere come si suona lì.',
    nothingYet: 'Ancora niente di scritto.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', con la forma predefinita',
    chordUnvoiced: ', senza diteggiatura possibile',
    chordChoose: '. Scegli un voicing.',
    voicings: 'Voicing',
    voicingsHelp: 'Clicca una forma per cambiarla ovunque sia usata.',
    voicingsDefaults:
      ' Le forme segnate come predefinite sono ciò che la schermata degli accordi mostrerebbe per prima; scegli solo quelle che ne hanno bisogno.',
    voicingsEmpty: 'Scrivi la canzone qui sopra e i suoi accordi compaiono qui.',
    voicingsList: 'Voicing usati in questa canzone',
    choose: 'Scegli',
    change: 'Cambia',
    everywhere: '{verb} {key} ovunque. ',
    usingDefault: 'Con la forma predefinita. ',
    usedIn: { one: 'Usato in {count} punto.', other: 'Usato in {count} punti.' },
    default: 'predefinita',
    missing: 'Nessuna forma suonabile su {label} per: {list}. Le sue regole di voicing potrebbero essere troppo rigide.',
    share: 'Condividi link',
    print: 'Stampa',
    shareLabel: 'Link per condividere questa canzone',
    shareHelp: 'Chi apre questo link vede la canzone così com’è scritta.',
  },

  picker: {
    changeEverywhere: 'Cambia {label} ovunque',
    howPlayed: 'Come si suona {chord} qui?',
    noParse: 'Quell’accordo non si capisce.',
    none: 'Nessuna diteggiatura per {chord} su {label}. Le sue regole di voicing potrebbero essere troppo rigide.',
    replaces: { one: 'Sostituisce questa forma in {count} punto. ', other: 'Sostituisce questa forma in {count} punti. ' },
    ways: '{count} modi di suonarlo, raggruppati per posizione e dal più facile al più difficile.',
    changesOne: 'Cambia solo questo accordo. ',
    chosen: ', scelta al momento',
    clearEverywhere: 'Rimuovi ovunque',
    clearChoice: 'Rimuovi la scelta',
    cancel: 'Annulla',
  },

  print: { legend: 'Forme degli accordi usate' },

  confirm: { cancel: 'Annulla', confirm: 'Elimina' },

  install: {
    title: 'Aggiungi Explore Chords alla schermata iniziale',
    label: 'Installa questa app',
    promptHelp: 'Si apre come un’app e continua a funzionare senza rete — comodo a lezione.',
    iosHelp:
      'Tocca Condividi, poi "Aggiungi alla schermata Home". Da lì si apre come un’app e funziona senza rete.',
    install: 'Installa',
    notNow: 'Non ora',
    gotIt: 'Capito',
    never: 'Non chiedere più',
  },

  update: {
    ready: 'È pronta una nuova versione.',
    reload: 'Ricarica',
    later: 'Più tardi',
  },

  announce: {
    whatsNew: 'Novità',
    showTutorial: 'Mostra il tutorial',
    letsGo: 'Andiamo',
    close: 'Chiudi',
    sinceLast: 'Cosa è cambiato dalla tua ultima visita',
  },

  announcements: {
    welcome: {
      title: 'Benvenuto in Explore Chords',
      sections: [
        {
          heading: 'Trova un accordo',
          text:
            'Scrivilo come lo scrivi tu — C7M, Cmaj7 o C∆7 vanno tutti bene — e compaiono tutti i ' +
            'modi di suonarlo sul tuo strumento, raggruppati per dove si trova la mano e dal più ' +
            'facile al più difficile. Quando un simbolo può voler dire due cose, un avviso dice ' +
            'quale lettura è stata scelta e ti lascia cambiarla.',
        },
        {
          heading: 'Prima viene il tuo strumento',
          text:
            'Il selettore nell’intestazione passa tra gli strumenti che hai impostato. Ognuno ' +
            'conserva la sua accordatura e le sue regole di voicing; la schermata Strumento è dove ' +
            'le modifichi, e dove a un basso e a un ukulele è permesso volere cose diverse.',
        },
        {
          heading: 'Salva le forme che ti piacciono',
          text:
            'Metti una stella a una forma e va tra i Salvati. Poi, un accordo per cui hai una forma ' +
            'salvata prende quella forma da solo la prima volta che compare in una canzone.',
        },
        {
          heading: 'Scrivi le canzoni come testo',
          text:
            'In Canzoni, uno schema è testo semplice: una riga che comincia con # dà il nome a una ' +
            'sezione, una barra verticale apre una battuta, gli spazi separano gli accordi al suo ' +
            'interno. Clicca un accordo per scegliere come si suona; la scelta viene riscritta nel ' +
            'testo dopo una riga ---, un blocco per accordatura, così la stessa canzone serve per ' +
            'tutti gli strumenti.',
        },
        {
          heading: 'Funziona senza segnale',
          text:
            'Una volta caricata, tutto gira sul tuo dispositivo. Aggiungila alla schermata iniziale ' +
            'e portala a lezione senza nessuna rete.',
        },
      ],
    },
    '0.2.0': {
      title: 'Cosa è cambiato nella 0.2',
      sections: [
        {
          heading: 'Una canzone, tutti gli strumenti',
          text:
            'Una canzone non appartiene più a uno strumento. I suoi voicing sono conservati per ' +
            'accordatura, dopo una riga --- nel testo, così lo stesso schema si suona sulla tua ' +
            'chitarra e sul tuo ukulele, ognuno con le sue forme. Le canzoni salvate nel formato ' +
            'precedente si convertono da sole, e le copie separate per strumento di una stessa ' +
            'canzone si fondono in una.',
        },
        {
          heading: 'Gli accordi senza forma scelta ne hanno comunque una',
          text:
            'Prendono la forma che la schermata degli accordi mostrerebbe per prima, segnata come ' +
            'predefinita. Scegli solo quelli che ne hanno bisogno.',
        },
        {
          heading: 'Le forme salvate entrano nelle canzoni',
          text:
            'Una forma a cui hai messo la stella viene usata appena il suo accordo entra in una ' +
            'canzone, se è diversa da quella predefinita.',
        },
        {
          heading: 'B° è la settima',
          text:
            'Un ° da solo ora si legge come settima diminuita, che è ciò che il simbolo significa ' +
            'in pratica; la parola dim è la triade, e un avviso offre l’altra lettura.',
        },
      ],
    },
    '0.3.0': {
      title: 'Cosa è cambiato nella 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'L’app ora parla portoghese brasiliano, spagnolo latinoamericano e italiano, oltre ' +
            'all’inglese. Segue la lingua del browser; il selettore nell’intestazione la cambia, ' +
            'e la scelta viene ricordata su questo dispositivo.',
        },
        {
          heading: 'Schemi allineati',
          text:
            'Sullo schermo e in stampa, le battute di una sezione stanno in colonne, come in uno ' +
            'schema scritto a mano, e il foglio stampato comincia dallo schema e tiene le forme ' +
            'piccole sotto.',
        },
      ],
    },
    '0.4.0': {
      title: 'Cosa è cambiato nella 0.4',
      sections: [
        {
          heading: 'Strumming o fingerstyle',
          text:
            'Le regole che si chiamavano Standard ora si chiamano Strumming, e accanto a loro ' +
            'c’è Fingerstyle. Chi suona con le dita semplicemente non pizzica la corda in mezzo ' +
            'all’accordo, quindi il fingerstyle ammette forme che lo strumming non raggiunge. ' +
            'Quando configuri uno strumento la domanda te la fa, e la schermata dello strumento ' +
            'la cambia in seguito.',
        },
        {
          heading: 'Niente più corde stoppate per niente',
          text:
            'Una forma non viene più proposta quando esiste anche la stessa forma con una delle ' +
            'sue corde stoppate che suona, e le dita che la riempiono scendono senza fatica. Sol ' +
            'minore ti dà 3x0333, con il re che suona, invece di 3xx333, che lo stoppa senza ' +
            'motivo, e il do a corde vuote arriva intero invece che a pezzi. Un allungo o un ' +
            'barré contano ancora come lavoro, quindi le forme che ne hanno bisogno ci sono ' +
            'tutte. E una corda stoppata in mezzo ha smesso di pesare sulla difficoltà: con le ' +
            'dita, una corda che non pizzichi non costa nulla.',
        },
      ],
    },
    '0.5.0': {
      title: 'Cosa è cambiato nella 0.5',
      sections: [
        {
          heading: 'Canzoni con il testo',
          text:
            'Ora una canzone si può scrivere come una cifra: una riga di accordi sopra la riga ' +
            'su cui si canta, ogni accordo sopra la sillaba su cui cade. Incollane una e viene ' +
            'letta così, con [Intro] e Intro: che danno il nome alle sezioni come già fa #. Il ' +
            'testo la segue sul foglio stampato, e sul telefono la strofa va a capo invece di ' +
            'scappare di lato.',
        },
        {
          heading: 'Gli schemi di sempre restano uguali',
          text:
            'Una canzone senza testo sotto gli accordi viene letta esattamente come prima. ' +
            'Quando una riga potrebbe essere entrambe le cose, una barra verticale la rende ' +
            'schema e un > iniziale la rende testo: l’unico modo di risolvere una strofa che ' +
            'dice davvero "A", contro l’accordo con lo stesso nome.',
        },
      ],
    },
  },
};
