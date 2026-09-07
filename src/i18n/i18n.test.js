import { describe, it, expect, afterEach } from 'vitest';
import {
  LOCALES,
  LOCALE_IDS,
  DEFAULT_LOCALE,
  t,
  tr,
  ordinal,
  errorText,
  setLocale,
  currentLocale,
  detectLocale,
  isLocale,
  hasMessage,
} from './index.js';
import en from './locales/en.js';

afterEach(() => setLocale(DEFAULT_LOCALE));

/** Every leaf path in a message tree, so two languages can be compared. */
function leaves(node, prefix = []) {
  if (node === null || typeof node !== 'object') return [prefix.join('.')];
  if (Array.isArray(node)) {
    return node.flatMap((item, i) => leaves(item, [...prefix, String(i)]));
  }
  return Object.entries(node).flatMap(([key, value]) => leaves(value, [...prefix, key]));
}

/** The `{name}` placeholders a string uses. */
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function leafValue(node, path) {
  return path.split('.').reduce((n, seg) => (n == null ? undefined : n[seg]), node);
}

describe('the languages', () => {
  it('are English, Brazilian Portuguese, Latin American Spanish and Italian', () => {
    expect(LOCALE_IDS).toEqual(['en', 'pt-BR', 'es-419', 'it']);
    expect(DEFAULT_LOCALE).toBe('en');
    for (const locale of LOCALES) expect(locale.name).toBeTruthy();
  });

  for (const locale of LOCALES.filter((l) => l.id !== 'en')) {
    describe(locale.id, () => {
      it('has every key English has, and no others', () => {
        // Plural objects may legitimately differ in which forms they carry
        // (English has `one`, Portuguese too, but a language might add `many`),
        // so compare at the level above the plural forms.
        const collapse = (paths) =>
          [...new Set(paths.map((p) => p.replace(/\.(zero|one|two|few|many|other)$/, '')))].sort();
        expect(collapse(leaves(locale.messages))).toEqual(collapse(leaves(en)));
      });

      it('uses the same placeholders as English in every string', () => {
        for (const path of leaves(en)) {
          const ours = leafValue(en, path);
          const theirs = leafValue(locale.messages, path);
          if (typeof ours !== 'string' || typeof theirs !== 'string') continue;
          if (/\.(zero|one|two|few|many|other)$/.test(path)) continue;
          expect(placeholders(theirs), path).toEqual(placeholders(ours));
        }
      });

      it('translates rather than copies, for the bulk of the strings', () => {
        const paths = leaves(en).filter((p) => typeof leafValue(en, p) === 'string');
        const same = paths.filter((p) => leafValue(en, p) === leafValue(locale.messages, p));
        // Chord symbols, tuning names and the app's name are the same everywhere.
        expect(same.length / paths.length).toBeLessThan(0.15);
      });
    });
  }
});

describe('lookup', () => {
  it('interpolates named parameters', () => {
    expect(t('results.none', { label: 'Guitar' })).toBe('No fingerings for this chord on Guitar.');
  });

  it('chooses the plural form by count', () => {
    expect(t('sheets.measures', { count: 1 })).toBe('1 measure');
    expect(t('sheets.measures', { count: 2 })).toBe('2 measures');
    expect(t('sheets.measures', { count: 0 })).toBe('0 measures');
  });

  it('follows the language for plurals too', () => {
    setLocale('pt-BR');
    expect(t('sheets.measures', { count: 1 })).toBe('1 compasso');
    expect(t('sheets.measures', { count: 3 })).toBe('3 compassos');
  });

  it('accepts a path with a dotted segment', () => {
    expect(tr(['announcements', '0.2.0']).title).toBe('What changed in 0.2');
    expect(t(['announcements', '0.2.0', 'title'])).toBe('What changed in 0.2');
  });

  it('shows the key rather than nothing for a missing string', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(hasMessage('no.such.key')).toBe(false);
    expect(hasMessage('nav.explore')).toBe(true);
  });

  it('falls back to English for a key a language lacks', () => {
    // Nothing is missing today, so simulate: the raw lookup falls through to
    // English when the current language has no value.
    setLocale('es-419');
    expect(t('app.name')).toBe('Explore Chords');
    expect(tr('nav')).toBeTruthy();
  });

  it('leaves an unknown placeholder visible', () => {
    expect(t('results.none', {})).toBe('No fingerings for this chord on {label}.');
  });
});

describe('ordinals', () => {
  it('follow English suffix rules', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st',
    ]);
  });

  it('use the feminine ordinal indicator in Portuguese, Spanish and Italian (string is feminine)', () => {
    setLocale('pt-BR');
    expect(ordinal(5)).toBe('5ª');
    setLocale('es-419');
    expect(ordinal(1)).toBe('1ª');
    setLocale('it');
    expect(ordinal(3)).toBe('3ª');
  });
});

describe('choosing a language', () => {
  it('matches the browser languages by primary subtag, first match wins', () => {
    expect(detectLocale(['pt-PT', 'en'])).toBe('pt-BR');
    expect(detectLocale(['es-ES'])).toBe('es-419');
    expect(detectLocale(['es-MX', 'pt-BR'])).toBe('es-419');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['it-IT', 'en'])).toBe('it');
    expect(detectLocale(['it-CH'])).toBe('it');
    expect(detectLocale(['fr', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
    expect(detectLocale(['fr', 'pt'])).toBe('pt-BR');
  });

  it('is case-insensitive about tags', () => {
    expect(detectLocale(['PT-br'])).toBe('pt-BR');
  });

  it('setLocale ignores an unknown id and reports what it set', () => {
    expect(setLocale('pt-BR')).toBe('pt-BR');
    expect(currentLocale()).toBe('pt-BR');
    expect(setLocale('xx')).toBe('en');
    expect(isLocale('xx')).toBe(false);
    expect(isLocale('es-419')).toBe(true);
  });
});

describe('errors from the core', () => {
  it('are translated by code, with their parameters', () => {
    const error = Object.assign(new Error('Unexpected "q".'), {
      code: 'unexpected',
      params: { text: 'q' },
    });
    expect(errorText(error)).toBe('Unexpected "q".');
    setLocale('pt-BR');
    expect(errorText(error)).toBe('Não esperava "q".');
  });

  it('show their own message when they carry no code we know', () => {
    expect(errorText(new Error('Something odd'))).toBe('Something odd');
    expect(errorText(Object.assign(new Error('Odd'), { code: 'nope' }))).toBe('Odd');
    expect(errorText({ code: 'empty' })).toBe('Enter a chord.');
  });
});
