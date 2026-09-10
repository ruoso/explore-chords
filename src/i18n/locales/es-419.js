/**
 * Español de Latinoamérica.
 *
 * Vocabulario de quien enseña guitarra: traste, cejilla, cuerda al aire,
 * digitación, cifrado. "Voicing" se queda en inglés, como se usa en la práctica.
 */
export default {
  app: { name: 'Explore Chords' },

  ordinal: { other: '{n}ª' },

  locale: { label: 'Idioma' },

  header: {
    help: 'Ayuda',
    helpLabel: 'Ayuda y novedades',
  },

  nav: {
    label: 'Secciones',
    explore: 'Acordes',
    instrument: 'Instrumento',
    library: 'Guardados',
    sheets: 'Canciones',
  },

  chip: {
    summary: 'Instrumento: {label}. Cambiar de instrumento.',
    add: '+ Agregar instrumento',
  },

  viewAs: {
    fromSheet: 'de este cifrado',
    fromLink: 'del enlace',
    viewing: ' Viendo como {label} ({source})',
    back: 'Volver a mi {label}',
    keep: 'Dejar como predeterminado',
  },

  input: {
    label: 'Acorde',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Mostrar',
    readAs: ' “{text}” leído como {reading}. ',
    use: 'Usar {reading}',
    build: 'Armar el acorde',
    root: 'Fundamental',
    quality: 'Cualidad',
    seventh: 'Séptima',
    bass: 'Bajo',
    bassRoot: 'Fundamental',
    extensions: 'Extensiones',
  },

  quality: {
    major: 'Mayor',
    minor: 'Menor',
    dim: 'Disminuido',
    aug: 'Aumentado',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'Sin séptima',
    dominant: 'Séptima dominante',
    major: 'Séptima mayor',
    diminished: 'Séptima disminuida',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'séptima mayor',
      dominantSharpFive: 'séptima dominante con quinta aumentada',
    },
    bareNine: {
      add: 'novena agregada, sin séptima',
      dominant: 'novena dominante, con la séptima menor',
    },
    degreeSign: {
      diminishedSeventh: 'séptima disminuida',
      diminishedTriad: 'tríada disminuida, sin séptima',
    },
  },

  errors: {
    empty: 'Escribe un acorde.',
    unexpected: 'No esperaba "{text}".',
    needsNumber: '"{text}" debe ir seguido de un número.',
    bassNeeded: 'Después de "/" va una nota de bajo o un número.',
    badNote: 'No entiendo la nota: {text}',
    badPitch: 'No entiendo la altura: {text}',
    emptyTuning: 'Una afinación necesita al menos una cuerda.',
    unknownQuality: 'Cualidad de acorde desconocida: {quality}',
    badDegree: 'Grado de extensión inválido: {degree}',
    badAlteration: 'Alteración de extensión inválida: {alter}',
    unknownDialect: 'Sistema de cifrado desconocido: {dialect}',
    noRoot: '"{text}" no empieza con el nombre de una nota.',
    badRoot: 'No entiendo la fundamental "{text}".',
    badBass: 'No entiendo la nota de bajo "{text}".',
    unreadable: 'No entiendo "{text}" en "{whole}".',
    noSheetInLink: 'Ese enlace no trae ningún cifrado.',
    cannotDecompress: 'Este navegador no puede leer enlaces de cifrado comprimidos.',
    unknownLinkFormat: 'Ese enlace no está en un formato que la app entienda.',
    notASheet: 'Ese enlace no contiene un cifrado.',
  },

  toggles: {
    label: 'Vista del diagrama',
    neck: 'Vista del mástil',
    left: 'Zurdo',
  },

  results: {
    announceNone: 'No se encontraron digitaciones.',
    announceCount: '{count} digitaciones en {positions} posiciones.',
    empty: 'Escribe un acorde para ver cómo se toca.',
    none: 'No hay digitaciones para este acorde en {label}.',
    noneHelp:
      'Puede que necesite más cuerdas de las que tiene el instrumento, o que tus reglas de voicing sean demasiado estrictas.',
    adjustRules: 'Ajustar reglas de voicing',
    save: ' Guardar',
    saved: ' Guardado',
    saveLabel: 'Guardar {shorthand} en tu biblioteca',
    removeLabel: 'Quitar {shorthand} de tu biblioteca',
  },

  groups: {
    open: 'Posición abierta',
    fret: 'Traste {position}',
    list: 'Digitaciones: {position}',
    showFewer: 'Mostrar menos',
    showAll: 'Mostrar las {count}',
  },

  difficulty: { easy: 'Fácil', medium: 'Media', hard: 'Difícil' },

  diagram: {
    open: 'posición abierta',
    startingAt: 'desde el traste {position}',
    barre: 'cejilla en {count} cuerdas en el traste {fret}',
    fingers: 'dedos {fingers}',
    muted: { one: '{count} cuerda sin tocar', other: '{count} cuerdas sin tocar' },
    rootOn: 'fundamental en la {ordinal} cuerda',
    toPlay: 'dificultad {difficulty}',
  },

  library: {
    title: 'Formas guardadas',
    empty:
      'Nada guardado para {label} todavía. Marca una forma con estrella en la pantalla de acordes para tenerla aquí.',
    count: '{count} guardadas para {label}.',
    list: 'Formas guardadas para {label}',
    open: 'Abrir',
    openLabel: 'Mostrar {chord} en la pantalla de acordes',
    remove: 'Quitar',
    removeLabel: 'Quitar {chord} {shorthand} de tus formas guardadas',
  },

  catalog: {
    '6guitar': 'Guitarra (6 cuerdas)',
    '7guitar': 'Guitarra (7 cuerdas)',
    '4bass': 'Bajo (4 cuerdas)',
    '5bass': 'Bajo (5 cuerdas)',
    ukulele: 'Ukelele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Mandolina',
    tenorbanjo: 'Banjo tenor',
  },

  tuning: {
    Standard: 'Estándar',
    'Drop D': 'Drop D',
    'Open G': 'Sol abierto',
    'Open D': 'Re abierto',
    DADGAD: 'DADGAD',
    'Open C': 'Do abierto',
    Brazilian: 'Brasileña',
    'Standard (re-entrant)': 'Estándar (reentrante)',
    'Low G': 'Sol grave',
    Baritone: 'Barítono',
    'Standard (Brazil)': 'Estándar (Brasil)',
    Irish: 'Irlandesa',
    custom: 'Personalizada',
    customOption: 'Afinación personalizada',
  },

  form: {
    edit: 'Editar instrumento',
    choose: 'Elige tu instrumento',
    add: 'Agregar un instrumento',
    firstRunHelp: 'Todo se muestra para este instrumento. Puedes agregar otros y cambiar cuando quieras.',
    addHelp: 'Se suma a tu lista; el selector del encabezado cambia entre ellos.',
    instrument: 'Instrumento',
    fallbackName: 'Instrumento',
    tuning: 'Afinación',
    strings: 'Cuerdas',
    stringsHelp:
      'De la cuerda más grave a la más aguda. Sirve cualquier lista de notas separadas por comas, incluidas las afinaciones reentrantes.',
    style: 'Cómo tocas',
    styleHelp:
      'Define qué formas se ofrecen: con los dedos se permite una cuerda apagada en medio del acorde; al rasguear, no. La pantalla del instrumento lo cambia después.',
    name: 'Nombre',
    nameHelp: 'Aparece en el selector. Ponles a las afinaciones personalizadas nombres que reconozcas.',
    frets: 'Trastes',
    save: 'Guardar cambios',
    start: 'Empezar a tocar',
    addButton: 'Agregar instrumento',
    cancel: 'Cancelar',
    needName: 'Ponle un nombre al instrumento.',
    badTuning: 'No entiendo esa afinación: {reason}',
  },

  instruments: {
    title: 'Instrumentos',
    help:
      'Todo lo que está en pantalla es para el instrumento en uso. Cada uno guarda su afinación, sus reglas de voicing, sus formas guardadas y sus canciones.',
    inUse: 'En uso',
    reentrant: 'Reentrante',
    meta: '{tuning} · {count} trastes',
    use: 'Usar',
    useLabel: 'Usar {label}',
    edit: 'Editar',
    editLabel: 'Editar {label}',
    delete: 'Eliminar',
    deleteLabel: 'Eliminar {label}',
    add: 'Agregar instrumento',
    back: '← Todos los instrumentos',
    deleteThis: 'Eliminar este instrumento',
    confirmTitle: '¿Eliminar {label}?',
    confirmShapes: {
      one: 'Su {count} forma guardada se va con él. ',
      other: 'Sus {count} formas guardadas se van con él. ',
    },
    confirmSongs: 'Las canciones se conservan, porque llevan su propia afinación. Esto no se puede deshacer.',
    confirmButton: 'Eliminar instrumento',
  },

  rules: {
    title: 'Reglas de voicing',
    help: 'Cómo se arman los acordes en {label}.',
    preset: 'Ajuste predefinido',
    custom: 'Personalizado',
    presets: {
      beginner: 'Principiante',
      strumming: 'Rasgueo',
      fingerstyle: 'Punteo',
      jazz: 'Jazz',
      bassFriendly: 'Para bajo',
    },
    rules: 'Reglas',
    rootInBass: 'La fundamental debe ser la nota más grave',
    requireThird: 'Exigir la tercera',
    omitFifth: 'La quinta se puede omitir',
    allowRootless: 'Permitir voicings sin fundamental',
    requireExtensions: 'Exigir todas las extensiones escritas',
    allowBarre: 'Permitir cejilla',
    allowInnerMutes: 'Permitir una cuerda apagada entre cuerdas que suenan',
    allowDoubling: 'Permitir la misma nota en más de una cuerda',
    allowDuplicatePitch: 'Permitir la misma altura dos veces',
    limits: 'Límites',
    maxSpan: 'Apertura máxima (trastes)',
    minSoundingStrings: 'Mínimo de cuerdas que suenan',
    maxResultsPerGroup: 'Formas mostradas por posición',
    weights: 'Pesos de dificultad',
    weightsHelp:
      'Cuánto pesa cada cosa para que una forma sea difícil. Los valores negativos hacen la forma más fácil.',
    weight: {
      spanPerFret: 'Apertura, por traste',
      barre: 'Cejilla',
      fullBarre: 'Cejilla completa, extra',
      perFinger: 'Cada dedo',
      innerMute: 'Cuerda apagada en medio',
      mutedString: 'Cada cuerda apagada',
      positionPerFret: 'Posición, por traste',
      omittedFifth: 'Omitir la quinta',
      rootless: 'Omitir la fundamental',
      nonRootBass: 'Inversión no pedida',
      openString: 'Cada cuerda al aire (una bonificación)',
      nonAdjacentStretch: 'Apertura amplia',
    },
  },

  sheets: {
    title: 'Cifrados',
    help: 'Los acordes de una canción en {label}, cada uno fijado a la digitación que quieres enseñar.',
    titlePlaceholder: 'Título de la canción',
    newTitleLabel: 'Título de la nueva canción',
    create: 'Nueva canción',
    untitled: 'Canción sin título',
    shared: 'Canción compartida',
    sharedInstrument: 'Instrumento compartido',
    empty: 'Todavía no hay canciones.',
    measures: { one: '{count} compás', other: '{count} compases' },
    chords: { one: '{count} acorde', other: '{count} acordes' },
    chosenHere: { one: ' · {count} voicing elegido aquí', other: ' · {count} voicings elegidos aquí' },
    voicedFor: 'Con voicings para {list}',
    open: 'Abrir',
    openLabel: 'Abrir {title}',
    duplicate: 'Duplicar',
    duplicateLabel: 'Duplicar {title}',
    delete: 'Eliminar',
    deleteLabel: 'Eliminar {title}',
    imported: 'Se importó la canción "{title}".',
  },

  editor: {
    back: '← Todas las canciones',
    titleLabel: 'Título de la canción',
    title: 'Título',
    song: 'La canción',
    placeholder: '# Verso\nA | Cm | A | Cm',
    help: {
      sections: {
        term: 'Secciones',
        text: 'Tres maneras de nombrar una: una línea que empieza con #, un nombre entre ' +
          'corchetes, o un nombre con dos puntos. Las dos últimas pueden llevar los ' +
          'acordes de la sección en la misma línea. Los dos puntos solo nombran una ' +
          'sección cuando lo que sigue son acordes, así que una línea cantada con dos ' +
          'puntos sigue siendo letra.',
        example: '# Verso\n[Intro] G  D  Em  C\nSolo: Am  F  C  G',
      },
      chart: {
        term: 'Un cifrado',
        text: 'Una barra vertical inicia un compás; los espacios separan los acordes dentro de él.',
        example: 'C  Am | F  G | C\nF     | G    | C',
      },
      words: {
        term: 'O con la letra debajo',
        text: 'Una línea de acordes sobre la línea que se canta, cada acorde encima de la sílaba en la que cae.',
        example: 'G         D\nCuando te vi pasar',
      },
      either: {
        term: 'Cuando la línea podría ser las dos cosas',
        text: 'Una barra vertical la hace cifrado. Un > al principio la hace letra, y es la única manera de resolver una línea que se lee como acorde.',
        example: 'G\n> A',
      },
      voicings: {
        term: 'Voicings',
        text: 'Van después de una línea ---, un bloque por afinación bajo un título que la nombra, para que la misma canción sirva en todos los instrumentos. Un acorde que se toca de más de una manera lleva una nota. Un acorde para el que guardaste una forma recibe esa forma la primera vez que aparece.',
        example: '---\n\n# Posiciones: E2, A2, D3, G3, B3, E4\nCm = x35543\nCm[2] = 8-10-10-8-8-8',
      },
    },
    notAChord: 'No es un acorde: {list}',
    badVoicingLines: 'No pude leer estas líneas de voicing: {list}',
    chart: 'El cifrado',
    chartHelp: 'Haz clic en un acorde para elegir cómo se toca ahí.',
    nothingYet: 'Todavía no hay nada escrito.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', con la forma predeterminada',
    chordUnvoiced: ', sin digitación posible',
    chordChoose: '. Elegir un voicing.',
    voicings: 'Voicings',
    voicingsHelp: 'Haz clic en una forma para cambiarla en todos los lugares donde se usa.',
    voicingsDefaults:
      ' Las formas marcadas como predeterminadas son lo que la pantalla de acordes mostraría primero; elige solo las que lo necesiten.',
    voicingsEmpty: 'Escribe la canción arriba y sus acordes aparecen aquí.',
    voicingsList: 'Voicings usados en esta canción',
    choose: 'Elegir',
    change: 'Cambiar',
    everywhere: '{verb} {key} en todos los lugares. ',
    usingDefault: 'Con la forma predeterminada. ',
    usedIn: { one: 'Usado en {count} lugar.', other: 'Usado en {count} lugares.' },
    default: 'predeterminada',
    missing: 'No hay forma tocable en {label} para: {list}. Sus reglas de voicing pueden ser demasiado estrictas.',
    share: 'Compartir enlace',
    print: 'Imprimir',
    shareLabel: 'Enlace para compartir esta canción',
    shareHelp: 'Quien abra este enlace ve la canción tal como está escrita.',
  },

  picker: {
    changeEverywhere: 'Cambiar {label} en todos los lugares',
    howPlayed: '¿Cómo se toca {chord} aquí?',
    noParse: 'Ese acorde no se entiende.',
    none: 'No hay digitaciones para {chord} en {label}. Sus reglas de voicing pueden ser demasiado estrictas.',
    replaces: { one: 'Reemplaza esta forma en {count} lugar. ', other: 'Reemplaza esta forma en {count} lugares. ' },
    ways: '{count} maneras de tocarlo, agrupadas por posición y de la más fácil a la más difícil.',
    changesOne: 'Cambia solo este acorde. ',
    chosen: ', elegida actualmente',
    clearEverywhere: 'Quitar en todos los lugares',
    clearChoice: 'Quitar elección',
    cancel: 'Cancelar',
  },

  print: { legend: 'Formas de acorde usadas' },

  confirm: { cancel: 'Cancelar', confirm: 'Eliminar' },

  install: {
    title: 'Agrega Explore Chords a tu pantalla de inicio',
    label: 'Instalar esta app',
    promptHelp: 'Se abre como una app y sigue funcionando sin red — útil en una clase.',
    iosHelp:
      'Toca Compartir y luego "Agregar a inicio". Después se abre como una app y sigue funcionando sin red.',
    install: 'Instalar',
    notNow: 'Ahora no',
    gotIt: 'Entendido',
    never: 'No volver a preguntar',
  },

  update: {
    ready: 'Hay una nueva versión lista.',
    reload: 'Recargar',
    later: 'Después',
  },

  announce: {
    whatsNew: 'Novedades',
    showTutorial: 'Ver el tutorial',
    letsGo: 'Vamos',
    close: 'Cerrar',
    sinceLast: 'Qué cambió desde tu última visita',
  },

  announcements: {
    welcome: {
      title: 'Bienvenido a Explore Chords',
      sections: [
        {
          heading: 'Encuentra un acorde',
          text:
            'Escríbelo como lo escribes tú — C7M, Cmaj7 o C∆7 funcionan — y aparecen todas las ' +
            'maneras de tocarlo en tu instrumento, agrupadas por dónde se apoya la mano y de la ' +
            'más fácil a la más difícil. Cuando un símbolo puede significar dos cosas, un aviso ' +
            'dice qué lectura se tomó y te deja cambiarla.',
        },
        {
          heading: 'Tu instrumento va primero',
          text:
            'El selector del encabezado cambia entre los instrumentos que configuraste. Cada uno ' +
            'guarda su afinación y sus reglas de voicing; la pantalla Instrumento es donde las ' +
            'editas, y donde un bajo y un ukelele pueden querer cosas distintas.',
        },
        {
          heading: 'Guarda las formas que te gusten',
          text:
            'Marca una forma con estrella y va a Guardados. Después, un acorde para el que tienes ' +
            'una forma guardada toma esa forma automáticamente la primera vez que aparece en una ' +
            'canción.',
        },
        {
          heading: 'Escribe canciones como texto',
          text:
            'En Canciones, un cifrado es texto plano: una línea que empieza con # nombra una ' +
            'sección, una barra vertical inicia un compás, los espacios separan los acordes dentro ' +
            'de él. Haz clic en un acorde para elegir cómo se toca; la elección se escribe de vuelta ' +
            'en el texto después de una línea ---, un bloque por afinación, para que la misma ' +
            'canción sirva en todos los instrumentos.',
        },
        {
          heading: 'Funciona sin señal',
          text:
            'Una vez cargada, todo corre en tu dispositivo. Agrégala a tu pantalla de inicio y ' +
            'llévala a una clase sin red.',
        },
      ],
    },
    '0.2.0': {
      title: 'Qué cambió en la 0.2',
      sections: [
        {
          heading: 'Una canción, todos los instrumentos',
          text:
            'Una canción ya no pertenece a un instrumento. Sus voicings se guardan por afinación, ' +
            'después de una línea --- en el texto, así que el mismo cifrado se toca en tu guitarra ' +
            'y en tu ukelele, cada uno con sus formas. Las canciones guardadas en el formato ' +
            'anterior se convierten solas, y las copias separadas por instrumento de una misma ' +
            'canción se unen en una.',
        },
        {
          heading: 'Los acordes sin forma elegida igual tienen una',
          text:
            'Toman la forma que la pantalla de acordes mostraría primero, marcada como ' +
            'predeterminada. Elige solo los que lo necesiten.',
        },
        {
          heading: 'Las formas guardadas entran en las canciones',
          text:
            'Una forma que marcaste con estrella se usa en cuanto su acorde entra en una canción, ' +
            'si es distinta de la predeterminada.',
        },
        {
          heading: 'B° es la séptima',
          text:
            'Un ° solo ahora se lee como séptima disminuida, que es lo que el símbolo significa en ' +
            'la práctica; la palabra dim es la tríada, y un aviso ofrece la otra lectura.',
        },
      ],
    },
    '0.3.0': {
      title: 'Qué cambió en la 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'La app ahora habla portugués de Brasil, español de Latinoamérica e italiano, además de inglés. ' +
            'Sigue el idioma del navegador; el selector del encabezado lo cambia, y la elección se ' +
            'recuerda en este dispositivo.',
        },
        {
          heading: 'Cifrados alineados',
          text:
            'En pantalla y al imprimir, los compases de una sección quedan en columnas, como en un ' +
            'cifrado escrito a mano, y la hoja impresa empieza por el cifrado y deja las formas ' +
            'pequeñas debajo.',
        },
      ],
    },
    '0.4.0': {
      title: 'Qué cambió en la 0.4',
      sections: [
        {
          heading: 'Rasgueo o punteo',
          text:
            'Las reglas que se llamaban Estándar ahora se llaman Rasgueo, y Punteo quedó al ' +
            'lado. Quien puntea sencillamente no toca la cuerda del medio del acorde, así que ' +
            'el punteo permite formas que el rasgueo no alcanza. Al configurar un instrumento ' +
            'se te pregunta cuál tocas, y la pantalla del instrumento lo cambia después.',
        },
        {
          heading: 'Se acabaron las cuerdas apagadas porque sí',
          text:
            'Una forma deja de ofrecerse cuando la misma forma con una de sus cuerdas apagadas ' +
            'sonando también está y los dedos que la completan bajan sin esfuerzo. Sol menor te ' +
            'da 3x0333, con la cuerda re sonando, en lugar de 3xx333, que la apaga sin razón, y ' +
            'el do al aire aparece entero en vez de a pedazos. Una estirada o una cejilla siguen ' +
            'contando como trabajo, así que las formas que necesitan una siguen ahí. Y una ' +
            'cuerda apagada en medio dejó de contar en la dificultad: al puntear, una cuerda que ' +
            'no tocas no cuesta nada.',
        },
      ],
    },
    '0.5.0': {
      title: 'Qué cambió en la 0.5',
      sections: [
        {
          heading: 'Canciones con su letra',
          text:
            'Ahora una canción se puede escribir como un cifrado con letra: una línea de ' +
            'acordes sobre la línea que se canta, cada acorde encima de la sílaba en la que ' +
            'cae. Pega una y se lee así, con [Intro] e Intro: nombrando secciones como ya lo ' +
            'hacía #. La letra va con ella a la hoja impresa, que ahora sale en dos columnas ' +
            'cuando la canción es lo bastante angosta — normalmente a la mitad de páginas. Y en ' +
            'el teléfono la estrofa salta de línea en vez de irse de lado.',
        },
        {
          heading: 'Los cifrados de siempre no cambian',
          text:
            'Una canción sin letra debajo de los acordes se lee exactamente como antes. Cuando ' +
            'una línea podría ser las dos cosas, una barra vertical la hace cifrado y un > al ' +
            'principio la hace letra, que es la única manera de resolver una estrofa que de ' +
            'verdad dice "A", contra el acorde del mismo nombre.',
        },
      ],
    },
  },
};
