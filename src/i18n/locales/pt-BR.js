/**
 * Português do Brasil.
 *
 * Vocabulário de quem ensina violão por aqui: casa, pestana, corda solta,
 * digitação, cifra. "Voicing" fica em inglês, como se diz na prática.
 */
export default {
  app: { name: 'Explore Chords' },

  ordinal: { other: '{n}ª' },

  locale: { label: 'Idioma' },

  header: {
    help: 'Ajuda',
    helpLabel: 'Ajuda e novidades',
  },

  nav: {
    label: 'Seções',
    explore: 'Acordes',
    instrument: 'Instrumento',
    library: 'Salvos',
    sheets: 'Músicas',
    backup: 'Backup',
  },

  chip: {
    summary: 'Instrumento: {label}. Trocar de instrumento.',
    add: '+ Adicionar instrumento',
  },

  viewAs: {
    fromSheet: 'desta cifra',
    fromLink: 'do link',
    viewing: ' Vendo como {label} ({source})',
    back: 'Voltar para meu {label}',
    keep: 'Manter como padrão',
  },

  input: {
    label: 'Acorde',
    placeholder: 'C7M, Am7, F#m7b5…',
    show: 'Mostrar',
    readAs: ' “{text}” lido como {reading}. ',
    use: 'Usar {reading}',
    build: 'Montar o acorde',
    root: 'Fundamental',
    quality: 'Qualidade',
    seventh: 'Sétima',
    bass: 'Baixo',
    bassRoot: 'Fundamental',
    extensions: 'Extensões',
  },

  quality: {
    major: 'Maior',
    minor: 'Menor',
    dim: 'Diminuto',
    aug: 'Aumentado',
    sus2: 'Sus2',
    sus4: 'Sus4',
    power: 'Power (5)',
  },

  seventh: {
    none: 'Sem sétima',
    dominant: 'Sétima dominante',
    major: 'Sétima maior',
    diminished: 'Sétima diminuta',
  },

  readings: {
    sevenPlus: {
      majorSeventh: 'sétima maior',
      dominantSharpFive: 'sétima dominante com quinta aumentada',
    },
    bareNine: {
      add: 'nona adicionada, sem sétima',
      dominant: 'nona dominante, com a sétima menor',
    },
    degreeSign: {
      diminishedSeventh: 'sétima diminuta',
      diminishedTriad: 'tríade diminuta, sem sétima',
    },
  },

  errors: {
    empty: 'Digite um acorde.',
    unexpected: 'Não esperava "{text}".',
    needsNumber: '"{text}" precisa vir seguido de um número.',
    bassNeeded: 'Depois de "/" vem uma nota de baixo ou um número.',
    badNote: 'Não entendi a nota: {text}',
    badPitch: 'Não entendi a altura: {text}',
    emptyTuning: 'Uma afinação precisa de pelo menos uma corda.',
    unknownQuality: 'Qualidade de acorde desconhecida: {quality}',
    badDegree: 'Grau de extensão inválido: {degree}',
    badAlteration: 'Alteração de extensão inválida: {alter}',
    unknownDialect: 'Sistema de cifra desconhecido: {dialect}',
    noRoot: '"{text}" não começa com o nome de uma nota.',
    badRoot: 'Não entendi a fundamental "{text}".',
    badBass: 'Não entendi a nota de baixo "{text}".',
    unreadable: 'Não entendi "{text}" em "{whole}".',
    noSheetInLink: 'Esse link não traz nenhuma cifra.',
    cannotDecompress: 'Este navegador não consegue ler links de cifra comprimidos.',
    unknownLinkFormat: 'Esse link não está num formato que o app entenda.',
    notASheet: 'Esse link não contém uma cifra.',
  },

  toggles: {
    label: 'Exibição do diagrama',
    neck: 'Vista do braço',
    left: 'Canhoto',
  },

  results: {
    announceNone: 'Nenhuma digitação encontrada.',
    announceCount: '{count} digitações em {positions} posições.',
    empty: 'Digite um acorde para ver como tocá-lo.',
    none: 'Nenhuma digitação para este acorde em {label}.',
    noneHelp:
      'Pode ser que ele precise de mais cordas do que o instrumento tem, ou que suas regras de voicing estejam rígidas demais.',
    adjustRules: 'Ajustar regras de voicing',
    save: ' Salvar',
    saved: ' Salvo',
    saveLabel: 'Salvar {shorthand} na sua biblioteca',
    removeLabel: 'Remover {shorthand} da sua biblioteca',
  },

  groups: {
    open: 'Posição aberta',
    fret: 'Casa {position}',
    list: 'Digitações: {position}',
    showFewer: 'Mostrar menos',
    showAll: 'Mostrar todas as {count}',
  },

  difficulty: { easy: 'Fácil', medium: 'Média', hard: 'Difícil' },

  diagram: {
    open: 'posição aberta',
    startingAt: 'a partir da casa {position}',
    barre: 'pestana em {count} cordas na casa {fret}',
    fingers: 'dedos {fingers}',
    muted: { one: '{count} corda não tocada', other: '{count} cordas não tocadas' },
    rootOn: 'fundamental na {ordinal} corda',
    toPlay: 'dificuldade {difficulty}',
  },

  library: {
    title: 'Desenhos salvos',
    empty:
      'Nada salvo para {label} ainda. Marque um desenho com estrela na tela de acordes para guardá-lo aqui.',
    count: '{count} salvos para {label}.',
    list: 'Desenhos salvos para {label}',
    open: 'Abrir',
    openLabel: 'Mostrar {chord} na tela de acordes',
    remove: 'Remover',
    removeLabel: 'Remover {chord} {shorthand} dos seus desenhos salvos',
  },

  catalog: {
    '6guitar': 'Violão (6 cordas)',
    '7guitar': 'Violão (7 cordas)',
    '4bass': 'Baixo (4 cordas)',
    '5bass': 'Baixo (5 cordas)',
    ukulele: 'Ukulele',
    cavaquinho: 'Cavaquinho',
    mandolin: 'Bandolim',
    tenorbanjo: 'Banjo tenor',
  },

  tuning: {
    Standard: 'Padrão',
    'Drop D': 'Drop D',
    'Open G': 'Sol aberto',
    'Open D': 'Ré aberto',
    DADGAD: 'DADGAD',
    'Open C': 'Dó aberto',
    Brazilian: 'Brasileira',
    'Standard (re-entrant)': 'Padrão (reentrante)',
    'Low G': 'Sol grave',
    Baritone: 'Barítono',
    'Standard (Brazil)': 'Padrão (Brasil)',
    Irish: 'Irlandesa',
    custom: 'Personalizada',
    customOption: 'Afinação personalizada',
  },

  form: {
    edit: 'Editar instrumento',
    choose: 'Escolha seu instrumento',
    add: 'Adicionar um instrumento',
    firstRunHelp: 'Tudo é mostrado para este instrumento. Você pode adicionar outros e trocar quando quiser.',
    addHelp: 'Ele entra na sua lista; o seletor no cabeçalho alterna entre eles.',
    instrument: 'Instrumento',
    fallbackName: 'Instrumento',
    tuning: 'Afinação',
    strings: 'Cordas',
    stringsHelp:
      'Da corda mais grave para a mais aguda. Qualquer lista de notas separadas por vírgula serve, inclusive afinações reentrantes.',
    style: 'Como você toca',
    styleHelp:
      'Define quais formas aparecem: no dedilhado uma corda abafada no meio do acorde é permitida, na batida não. A tela do instrumento muda isso depois.',
    name: 'Nome',
    nameHelp: 'Aparece no seletor. Dê a afinações personalizadas nomes que você reconheça.',
    frets: 'Casas',
    save: 'Salvar alterações',
    start: 'Começar a tocar',
    addButton: 'Adicionar instrumento',
    cancel: 'Cancelar',
    needName: 'Dê um nome ao instrumento.',
    badTuning: 'Não entendi essa afinação: {reason}',
  },

  backup: {
    title: 'Backup',
    help:
      'Tudo o que você tem fica guardado neste navegador, o que serve até o aparelho não ' +
      'servir mais. Um backup é um único zip com seus instrumentos e ajustes, seus desenhos ' +
      'salvos e cada música como um arquivo de texto que você pode ler e editar em qualquer lugar.',
    save: 'Salvar um backup',
    insideTitle: 'O que tem dentro',
    inside:
      'Um zip, com seus instrumentos e suas regras e seus ajustes em um arquivo, seus ' +
      'desenhos salvos em outro, e cada música como um arquivo de texto com o nome dela. ' +
      'Coloque outra música na pasta songs com qualquer programa de zip e ela volta com o resto.',
    restore: 'Restaurar um backup',
    confirmTitle: 'Restaurar de “{name}”?',
    confirmBody:
      'Tudo neste aparelho é substituído pelo que o arquivo contém: {instruments} e {songs}.',
    instruments: { one: '{count} instrumento', other: '{count} instrumentos' },
    songs: { one: '{count} música', other: '{count} músicas' },
    confirmButton: 'Substituir tudo',
    nudgeTitle: 'Suas músicas só existem neste aparelho',
    nudgeText: {
      one:
        'A música aqui não está em nenhum backup. No Android um aparelho novo não a ' +
        'recebe, e um navegador que limpa os dados a leva junto.',
      other:
        'As {count} músicas aqui não estão em nenhum backup. No Android um aparelho novo ' +
        'não as recebe, e um navegador que limpa os dados as leva junto.',
    },
    notNow: 'Agora não',
    failed: 'Não consegui ler esse backup: {reason}',
  },
  instruments: {
    title: 'Instrumentos',
    help:
      'Tudo na tela é para o instrumento em uso. Cada um guarda sua afinação, suas regras de voicing, seus desenhos salvos e suas músicas.',
    inUse: 'Em uso',
    reentrant: 'Reentrante',
    meta: '{tuning} · {count} casas',
    use: 'Usar',
    useLabel: 'Usar {label}',
    edit: 'Editar',
    editLabel: 'Editar {label}',
    delete: 'Excluir',
    deleteLabel: 'Excluir {label}',
    add: 'Adicionar instrumento',
    back: '← Todos os instrumentos',
    deleteThis: 'Excluir este instrumento',
    confirmTitle: 'Excluir {label}?',
    confirmShapes: {
      one: 'O {count} desenho salvo dele vai junto. ',
      other: 'Os {count} desenhos salvos dele vão junto. ',
    },
    confirmSongs: 'As músicas ficam, pois carregam a própria afinação. Isso não pode ser desfeito.',
    confirmButton: 'Excluir instrumento',
  },

  rules: {
    title: 'Regras de voicing',
    help: 'Como os acordes são montados em {label}.',
    preset: 'Predefinição',
    custom: 'Personalizada',
    presets: {
      beginner: 'Iniciante',
      strumming: 'Batida',
      fingerstyle: 'Dedilhado',
      jazz: 'Jazz',
      bassFriendly: 'Para baixo',
    },
    rules: 'Regras',
    rootInBass: 'A fundamental deve ser a nota mais grave',
    requireThird: 'Exigir a terça',
    omitFifth: 'A quinta pode ser omitida',
    allowRootless: 'Permitir voicings sem fundamental',
    requireExtensions: 'Exigir todas as extensões escritas',
    allowBarre: 'Permitir pestana',
    allowInnerMutes: 'Permitir corda abafada entre cordas que soam',
    allowDoubling: 'Permitir a mesma nota em mais de uma corda',
    allowDuplicatePitch: 'Permitir a mesma altura duas vezes',
    limits: 'Limites',
    maxSpan: 'Abertura máxima (casas)',
    minSoundingStrings: 'Mínimo de cordas soando',
    maxResultsPerGroup: 'Desenhos mostrados por posição',
    weights: 'Pesos de dificuldade',
    weightsHelp:
      'Quanto cada coisa pesa para um desenho ser difícil. Valores negativos tornam o desenho mais fácil.',
    weight: {
      spanPerFret: 'Abertura, por casa',
      barre: 'Pestana',
      fullBarre: 'Pestana completa, extra',
      perFinger: 'Cada dedo',
      innerMute: 'Corda abafada no meio',
      mutedString: 'Cada corda abafada',
      positionPerFret: 'Posição, por casa',
      omittedFifth: 'Omitir a quinta',
      rootless: 'Omitir a fundamental',
      nonRootBass: 'Inversão não pedida',
      openString: 'Cada corda solta (um bônus)',
      nonAdjacentStretch: 'Abertura grande',
    },
  },

  sheets: {
    title: 'Cifras',
    help: 'Os acordes de uma música em {label}, cada um preso à digitação que você quer ensinar.',
    titlePlaceholder: 'Nome da música',
    newTitleLabel: 'Nome da nova música',
    create: 'Nova música',
    untitled: 'Música sem título',
    shared: 'Música compartilhada',
    sharedInstrument: 'Instrumento compartilhado',
    empty: 'Nenhuma música ainda.',
    measures: { one: '{count} compasso', other: '{count} compassos' },
    chords: { one: '{count} acorde', other: '{count} acordes' },
    chosenHere: { one: ' · {count} voicing escolhido aqui', other: ' · {count} voicings escolhidos aqui' },
    voicedFor: 'Com voicings para {list}',
    view: 'Ver',
    viewLabel: 'Ver {title}',
    edit: 'Editar',
    editLabel: 'Editar {title}',
    duplicate: 'Duplicar',
    duplicateLabel: 'Duplicar {title}',
    delete: 'Excluir',
    deleteLabel: 'Excluir {title}',
    imported: 'A música "{title}" foi importada.',
  },

  editor: {
    back: '← Todas as músicas',
    titleLabel: 'Nome da música',
    title: 'Nome',
    song: 'A música',
    placeholder: '# Verso\nA | Cm | A | Cm',
    help: {
      sections: {
        term: 'Seções',
        text: 'Três jeitos de dar nome a uma: uma linha começando com #, um nome entre ' +
          'colchetes, ou um nome com dois-pontos. As duas últimas podem trazer os acordes ' +
          'da seção na mesma linha. Os dois-pontos só dão nome a uma seção quando o que ' +
          'vem depois são acordes, então uma linha cantada com dois-pontos continua letra.',
        example: '# Verso\n[Intro] G  D  Em  C\nSolo: Am  F  C  G',
      },
      chart: {
        term: 'Uma cifra',
        text: 'Uma barra vertical inicia um compasso; espaços separam os acordes dentro dele.',
        example: 'C  Am | F  G | C\nF     | G    | C',
      },
      words: {
        term: 'Ou com a letra embaixo',
        text: 'Uma linha de acordes sobre a linha em que é cantada, cada acorde acima da sílaba em que cai.',
        example: 'G            D\nQuando eu te vi passar',
      },
      either: {
        term: 'Quando a linha poderia ser as duas coisas',
        text: 'Uma barra vertical faz dela uma cifra. Um > no começo faz dela letra, e é o único jeito de resolver uma linha que se lê como acorde.',
        example: 'G\n> A',
      },
      voicings: {
        term: 'Voicings',
        text: 'Ficam depois de uma linha ---, um bloco por afinação sob um título que a nomeia, para a mesma música servir a todos os instrumentos. Um acorde tocado de mais de um jeito ganha uma nota. Um acorde para o qual você salvou um desenho recebe esse desenho na primeira vez que aparece.',
        example: '---\n\n# Posições: E2, A2, D3, G3, B3, E4\nCm = x35543\nCm[2] = 8-10-10-8-8-8',
      },
    },
    notAChord: 'Não é um acorde: {list}',
    badVoicingLines: 'Não consegui ler estas linhas de voicing: {list}',
    chart: 'A cifra',
    chartHelp: 'Clique em um acorde para escolher como ele é tocado ali.',
    nothingYet: 'Nada escrito ainda.',
    chordVoicing: ', voicing {index}',
    chordDefault: ', usando o desenho padrão',
    chordUnvoiced: ', sem digitação possível',
    chordChoose: '. Escolher um voicing.',
    voicings: 'Voicings',
    voicingsHelp: 'Clique em um desenho para trocá-lo em todos os lugares em que é usado.',
    voicingsDefaults:
      ' Os desenhos marcados como padrão são o que a tela de acordes mostraria primeiro; escolha só os que precisam.',
    voicingsEmpty: 'Escreva a música acima e os acordes aparecem aqui.',
    voicingsList: 'Voicings usados nesta música',
    choose: 'Escolher',
    change: 'Trocar',
    everywhere: '{verb} {key} em todos os lugares. ',
    usingDefault: 'Usando o desenho padrão. ',
    usedIn: { one: 'Usado em {count} lugar.', other: 'Usado em {count} lugares.' },
    default: 'padrão',
    missing: 'Nenhum desenho tocável em {label} para: {list}. As regras de voicing podem estar rígidas demais.',
    share: 'Compartilhar link',
    snapPage: 'Encaixar esta página',
    previousPage: 'Página anterior',
    nextPage: 'Página seguinte',
    pageOf: 'Página {current} de {total}',
    print: 'Imprimir',
    shareLabel: 'Link para compartilhar esta música',
    shareHelp: 'Quem abrir este link vê a música como está escrita.',
  },

  picker: {
    changeEverywhere: 'Trocar {label} em todos os lugares',
    howPlayed: 'Como {chord} é tocado aqui?',
    noParse: 'Esse acorde não faz sentido.',
    none: 'Nenhuma digitação para {chord} em {label}. As regras de voicing podem estar rígidas demais.',
    replaces: { one: 'Substitui este desenho em {count} lugar. ', other: 'Substitui este desenho em {count} lugares. ' },
    ways: '{count} jeitos de tocar, agrupados por posição, do mais fácil ao mais difícil.',
    changesOne: 'Muda só este acorde. ',
    chosen: ', escolhido no momento',
    clearEverywhere: 'Limpar em todos os lugares',
    clearChoice: 'Limpar escolha',
    cancel: 'Cancelar',
  },

  print: { legend: 'Desenhos de acorde usados' },

  confirm: { cancel: 'Cancelar', confirm: 'Excluir' },

  install: {
    title: 'Adicione o Explore Chords à tela inicial',
    label: 'Instalar este app',
    promptHelp: 'Ele abre como um app e continua funcionando sem rede — útil numa aula.',
    iosHelp:
      'Toque em Compartilhar e depois em "Adicionar à Tela de Início". Ele passa a abrir como um app e funciona sem rede.',
    install: 'Instalar',
    notNow: 'Agora não',
    gotIt: 'Entendi',
    never: 'Não perguntar de novo',
  },

  update: {
    ready: 'Uma nova versão está pronta.',
    reload: 'Recarregar',
    later: 'Depois',
  },

  announce: {
    whatsNew: 'Novidades',
    showTutorial: 'Ver o tutorial',
    letsGo: 'Vamos lá',
    close: 'Fechar',
    sinceLast: 'O que mudou desde sua última visita',
  },

  announcements: {
    welcome: {
      title: 'Bem-vindo ao Explore Chords',
      sections: [
        {
          heading: 'Encontre um acorde',
          text:
            'Digite do jeito que você escreve — C7M, Cmaj7 ou C∆7 funcionam — e aparecem todos ' +
            'os jeitos de tocá-lo no seu instrumento, agrupados pela posição da mão e do mais ' +
            'fácil ao mais difícil. Quando um símbolo pode significar duas coisas, um aviso diz ' +
            'qual leitura foi usada e deixa você inverter.',
        },
        {
          heading: 'Seu instrumento vem primeiro',
          text:
            'O seletor no cabeçalho alterna entre os instrumentos que você configurou. Cada um ' +
            'guarda sua afinação e suas regras de voicing; a tela Instrumento é onde você as ' +
            'edita, e onde um baixo e um ukulele podem querer coisas diferentes.',
        },
        {
          heading: 'Salve os desenhos de que gosta',
          text:
            'Marque um desenho com estrela e ele vai para Salvos. Depois, um acorde para o qual ' +
            'você tem um desenho salvo recebe esse desenho automaticamente na primeira vez que ' +
            'aparece numa música.',
        },
        {
          heading: 'Escreva músicas como texto',
          text:
            'Em Músicas, uma cifra é texto puro: uma linha começando com # dá nome a uma seção, ' +
            'uma barra vertical inicia um compasso, espaços separam os acordes dentro dele. Clique ' +
            'em um acorde para escolher como ele é tocado; a escolha é escrita de volta no texto ' +
            'depois de uma linha ---, um bloco por afinação, para a mesma música servir a todos os ' +
            'instrumentos.',
        },
        {
          heading: 'Funciona sem sinal',
          text:
            'Depois de carregado, tudo roda no seu aparelho. Adicione à tela inicial e leve para ' +
            'uma aula sem rede nenhuma.',
        },
      ],
    },
    '0.2.0': {
      title: 'O que mudou na 0.2',
      sections: [
        {
          heading: 'Uma música, todos os instrumentos',
          text:
            'Uma música não pertence mais a um instrumento. Seus voicings ficam guardados por ' +
            'afinação, depois de uma linha --- no texto, então a mesma cifra toca no seu violão e ' +
            'no seu ukulele, cada um com seus desenhos. Músicas salvas no formato antigo se ' +
            'convertem sozinhas, e cópias separadas por instrumento de uma mesma música viram uma só.',
        },
        {
          heading: 'Acordes sem desenho escolhido ainda têm um',
          text:
            'Eles recebem o desenho que a tela de acordes mostraria primeiro, marcado como padrão. ' +
            'Escolha só os que precisam.',
        },
        {
          heading: 'Desenhos salvos entram nas músicas',
          text:
            'Um desenho que você marcou com estrela é usado assim que seu acorde entra numa ' +
            'música, se for diferente do padrão.',
        },
        {
          heading: 'B° é a sétima',
          text:
            'Um ° sozinho agora é lido como sétima diminuta, que é o que o símbolo significa na ' +
            'prática; a palavra dim é a tríade, e um aviso oferece a outra leitura.',
        },
      ],
    },
    '0.3.0': {
      title: 'O que mudou na 0.3',
      sections: [
        {
          heading: 'Português, español e italiano',
          text:
            'O app agora fala português do Brasil, espanhol latino-americano e italiano, além de inglês. ' +
            'Ele segue o idioma do navegador; o seletor no cabeçalho troca, e a escolha fica ' +
            'guardada neste aparelho.',
        },
        {
          heading: 'Cifras alinhadas',
          text:
            'Na tela e na impressão, os compassos de uma seção ficam em colunas, como numa cifra ' +
            'escrita à mão, e a folha impressa começa pela cifra e mantém os desenhos pequenos ' +
            'abaixo dela.',
        },
      ],
    },
    '0.4.0': {
      title: 'O que mudou na 0.4',
      sections: [
        {
          heading: 'Batida ou dedilhado',
          text:
            'As regras que se chamavam Padrão agora se chamam Batida, e Dedilhado ficou ao ' +
            'lado delas. Quem dedilha simplesmente não toca a corda do meio do acorde, então o ' +
            'dedilhado permite formas que a batida não alcança. Ao configurar um instrumento a ' +
            'pergunta aparece, e a tela do instrumento muda isso depois.',
        },
        {
          heading: 'Nada de cordas abafadas à toa',
          text:
            'Uma forma deixa de aparecer quando a mesma forma com uma das cordas abafadas ' +
            'soando também está disponível e os dedos que a preenchem descem sem esforço. Sol ' +
            'menor traz 3x0333, com a corda ré soando, no lugar de 3xx333, que a abafa sem ' +
            'motivo, e o dó solto aparece inteiro em vez de aos pedaços. Uma esticada ou uma ' +
            'pestana continuam contando como trabalho, então as formas que precisam de uma ' +
            'continuam aí. E uma corda abafada no meio deixou de pesar na dificuldade: no ' +
            'dedilhado, uma corda que você não toca não custa nada.',
        },
      ],
    },
    '0.5.0': {
      title: 'O que mudou na 0.5',
      sections: [
        {
          heading: 'Músicas com a letra',
          text:
            'Agora dá para escrever uma música como uma cifra de verdade: uma linha de acordes ' +
            'sobre a linha em que ela é cantada, cada acorde acima da sílaba em que cai. Cole ' +
            'uma e ela é lida assim, com [Intro] e Intro: dando nome às seções como o # já ' +
            'fazia. A letra vai junto para a folha impressa, que agora sai em duas colunas ' +
            'quando a música é estreita o bastante — normalmente pela metade das páginas. E no ' +
            'celular a estrofe quebra a linha em vez de sumir para o lado.',
        },
        {
          heading: 'As cifras de sempre continuam iguais',
          text:
            'Uma música sem letra embaixo dos acordes é lida exatamente como antes. Quando uma ' +
            'linha poderia ser as duas coisas, uma barra vertical faz dela uma cifra e um > no ' +
            'começo faz dela letra — o único jeito de resolver uma estrofe que diz mesmo "A", ' +
            'contra o acorde de mesmo nome.',
        },
      ],
    },
    '0.6.0': {
      title: 'O que mudou na 0.6',
      sections: [
        {
          heading: 'A música abre para ser lida',
          text:
            'Agora cada música tem uma página própria que a mostra como ela vai sair no papel ' +
            '— a letra embaixo dos acordes e os desenhos que você toca — em vez de abrir o ' +
            'editor. O texto continua a um clique, e a lista oferece os dois caminhos.',
        },
        {
          heading: 'Uma página por vez',
          text:
            'Essa página é dividida em páginas do tamanho da sua tela, então dá para ver onde ' +
            'a música passa do fim de uma delas. As setas no canto viram as páginas e deixam ' +
            'a página inteira à vista, o que transforma tocar olhando a tela em virar página ' +
            'em vez de rolar. O meio delas reenquadra a página depois de uma rolagem à mão, e ' +
            'a barra de cima não ocupa mais uma faixa da janela.',
        },
        {
          heading: 'As cifras são lidas melhor',
          text:
            'Parênteses em volta de uma sequência de acordes marcam uma repetição e não são ' +
            'mais lidos como acordes. Acordes que continuam depois do fim da letra mantêm o ' +
            'espaçamento com que foram escritos. E uma estrofe que quebra numa linha de uma ' +
            'palavra é lida como letra, não como um acorde que ninguém reconhece.',
        },
      ],
    },
    '0.7.0': {
      title: 'O que mudou na 0.7',
      sections: [
        {
          heading: 'Salve tudo em um arquivo',
          text:
            'Tudo o que você tem fica guardado neste navegador, o que serve até o aparelho ' +
            'não servir mais. A tela do instrumento agora salva tudo em um zip — seus ' +
            'instrumentos e suas regras, seus ajustes, seus desenhos salvos e cada música — e ' +
            'restaura aqui ou em outro aparelho.',
        },
        {
          heading: 'Suas músicas são arquivos de texto',
          text:
            'Dentro do zip cada música é um arquivo de texto que você abre e edita com ' +
            'qualquer coisa. Coloque outro na pasta songs com qualquer programa de zip e ele ' +
            'volta como música, com o nome do arquivo. O backup é seu para guardar, não um ' +
            'formato que só este app entende.',
        },
      ],
    },
    '0.8.0': {
      title: 'O que mudou na 0.8',
      sections: [
        {
          heading: 'Um lembrete para fazer backup',
          text:
            'O backup agora tem uma tela própria, e a lista de músicas avisa quando há ' +
            'músicas que não estão em nenhum backup — porque um Android novo não leva elas, e ' +
            'um navegador que limpa os dados leva elas junto. No celular, salvar entrega o ' +
            'arquivo para o menu de compartilhar, que é onde ficam o Drive, o Arquivos e o iCloud.',
        },
        {
          heading: 'As páginas enchem para baixo antes de para o lado',
          text:
            'Lendo uma música, a coluna agora vai até o pé da página antes de qualquer parte ' +
            'da música ir para o lado. Antes, algumas estrofes numa tela larga saíam como uma ' +
            'linha no alto de uma página vazia. Uma segunda coluna é uma página economizada, ' +
            'não largura para gastar.',
        },
        {
          heading: 'Os acordes ficam com os parênteses deles',
          text:
            'Em7(b5), A7(b13) e C7(9) estavam sendo lidos como um acorde chamado Em7(b5 com um ' +
            'parêntese solto do lado, porque parênteses também marcam repetição. Agora só é ' +
            'marca de repetição o parêntese que nada fecha, ou que nada abriu.',
        },
      ],
    },
  },
};
