/**
 * Translations (docs/DESIGN.md §2.9).
 *
 * Deliberately tiny, like the DOM helper: a lookup by dotted key into one
 * object per language, `{name}` interpolation, and plural forms chosen by
 * `Intl.PluralRules`. No library, because the app has three languages and a
 * few hundred strings, and a framework for that would weigh more than the
 * strings.
 *
 * English is the source: every other language is checked against it in the
 * unit tests, and anything missing falls back to it rather than to a bare
 * key on screen.
 *
 * The current language is module state, set once at startup and again when
 * the user changes it. Everything on screen re-renders on that change, so no
 * module needs to hold on to translated text.
 */

import en from './locales/en.js';
import ptBR from './locales/pt-BR.js';
import es419 from './locales/es-419.js';
import it from './locales/it.js';

/** Each language's name is written in that language: it is how you find yours. */
export const LOCALES = [
  { id: 'en', name: 'English', messages: en },
  { id: 'pt-BR', name: 'Português (Brasil)', messages: ptBR },
  { id: 'es-419', name: 'Español (Latinoamérica)', messages: es419 },
  { id: 'it', name: 'Italiano', messages: it },
];

export const DEFAULT_LOCALE = 'en';
export const LOCALE_IDS = LOCALES.map((l) => l.id);

let current = LOCALES[0];

export function isLocale(id) {
  return LOCALES.some((l) => l.id === id);
}

/**
 * The first of the browser's languages we have, by primary subtag: `pt-PT`
 * gets Brazilian Portuguese and `es-ES` Latin American Spanish, which is
 * closer than English for either.
 */
export function detectLocale(languages = globalThis.navigator?.languages ?? []) {
  for (const tag of languages) {
    const primary = String(tag).toLowerCase().split('-')[0];
    const match = LOCALES.find((l) => l.id.toLowerCase().split('-')[0] === primary);
    if (match) return match.id;
  }
  return DEFAULT_LOCALE;
}

export function setLocale(id) {
  current = LOCALES.find((l) => l.id === id) ?? LOCALES[0];
  return current.id;
}

export function currentLocale() {
  return current.id;
}

/** A key is a dotted path, or an array of segments when a segment has dots in it. */
function lookup(messages, key) {
  const path = Array.isArray(key) ? key : String(key).split('.');
  let node = messages;
  for (const segment of path) {
    if (node === null || typeof node !== 'object' || !(segment in node)) return undefined;
    node = node[segment];
  }
  return node;
}

function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    name in params ? String(params[name]) : whole
  );
}

const isPluralForms = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && 'other' in value;

function pluralRules(type) {
  try {
    return new Intl.PluralRules(current.id, { type });
  } catch {
    return new Intl.PluralRules('en', { type });
  }
}

/**
 * The raw value under a key — for structured content such as the tutorial's
 * sections — from the current language, else English.
 */
export function tr(key) {
  const own = lookup(current.messages, key);
  return own === undefined ? lookup(en, key) : own;
}

export function hasMessage(key) {
  return tr(key) !== undefined;
}

/**
 * The text under a key, with `{name}` filled in from params.
 *
 * A value written as `{ one, other }` (or with `zero`, `few`, `many` where the
 * language has them) is a plural: the form is chosen by `params.count`.
 * A missing key returns the key itself, so it is visible rather than blank.
 */
export function t(key, params = {}) {
  let value = tr(key);
  if (value === undefined) return Array.isArray(key) ? key.join('.') : String(key);
  if (isPluralForms(value)) {
    const form = pluralRules('cardinal').select(Number(params.count ?? 0));
    value = value[form] ?? value.other;
  }
  return typeof value === 'string' ? interpolate(value, params) : String(value);
}

/** "5th", "5ª": the ordinal forms live under the `ordinal` key of each language. */
export function ordinal(n) {
  const forms = tr('ordinal');
  const form = pluralRules('ordinal').select(n);
  const pattern = (isPluralForms(forms) && (forms[form] ?? forms.other)) || '{n}';
  return interpolate(pattern, { n });
}

/**
 * Text for an error the core raised.
 *
 * Core errors carry a `code` and `params` rather than translated text, since
 * `core/` knows nothing about languages; an error without a code, or one we
 * have no text for, shows its own message.
 */
export function errorText(error) {
  if (error?.code && hasMessage(`errors.${error.code}`)) {
    return t(`errors.${error.code}`, error.params ?? {});
  }
  return error?.message ?? String(error);
}
