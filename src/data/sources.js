/**
 * Works cited by the voicing wizard (docs/DESIGN.md §2.10).
 *
 * A planner that claims to play a particular idiom has to be able to say where
 * it got that idiom from, and each planner cites its own: what backs the choro
 * texture says nothing about keeping a hand near the nut. So references live
 * here, per work, and a planner names the ones behind it.
 *
 * Language-independent on purpose. An author, a title and a year are the same
 * in every language, and translating a citation would only invite four ways to
 * get it wrong. The prose explaining a planner is in src/i18n; this is the
 * bibliography it points at.
 *
 * Only works whose full reference is known are listed. A half-remembered one is
 * worse than none, since the reader cannot check it.
 */

export const SOURCES = {
  camposRamos2016: {
    author: 'Lucas de Campos Ramos',
    title: 'O Violão de 6 Cordas e as habilidades de acompanhamento no Choro',
    where: 'Universidade de Brasília',
    year: 2016,
    url: 'https://www.ceart.udesc.br/arquivos/id_submenu/739/lucas_campos_dissertacao.pdf',
  },
  korver2020: {
    author: 'Ines Körver',
    title: '150 Years of Choro – Where Are We Now?',
    where: 'Musicologist 4(1)',
    year: 2020,
    url: 'https://dergipark.org.tr/en/download/article-file/1174581',
  },
  vilelaMangueira2023: {
    author: 'João Victor Rodrigues Vilela and Bruno Mangueira',
    title: 'Padrões de acompanhamento ao violão de João Gilberto',
    where: 'XI Congresso Internacional da ABRAPEM',
    year: 2023,
    url: 'https://abrapem.org/wp-content/uploads/2023/10/60.-Padroes-de-acompanhamento-ao-violao-de-Joao-Gilberto-01.pdf',
  },
  botelho2018: {
    author: 'Paulo Cesar Botelho',
    title: 'Violão Brasileiro: O Acompanhador de Gêneros Urbanos',
    where: 'PROMUS, Universidade Federal do Rio de Janeiro',
    year: 2018,
    url: 'https://promus.musica.ufrj.br/wp-content/uploads/2022/07/Paulo-Cesar-botelho-prod.-pedagogico-violaobrasileiropcbotelho.pdf',
  },
  faria: {
    author: 'Nelson Faria',
    title: 'The Brazilian Guitar Book',
    where: 'Sher Music, sample pages 50-53',
    url: 'https://www.shermusic.com/1883217024.php',
  },
};

/** The works a planner cites, in the order it cites them. */
export function sourcesFor(ids = []) {
  return ids.map((id) => ({ id, ...SOURCES[id] })).filter((source) => source.title);
}

/** "Author, Title (Where, Year)" — one line, for a list of references. */
export function citation(source) {
  const place = [source.where, source.year].filter(Boolean).join(', ');
  return place ? `${source.author}, ${source.title} (${place})` : `${source.author}, ${source.title}`;
}
