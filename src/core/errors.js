/**
 * Errors the core raises for things a user typed.
 *
 * `core/` knows nothing about languages, so an error carries a `code` and the
 * `params` a message needs, alongside an English `message` for logs and tests.
 * The UI translates by code (src/i18n) and shows the message only when it has
 * no text for the code.
 */

/**
 * @param {string} code
 * @param {object} params
 * @param {string} message   English, for anyone reading a log
 * @returns {Error & { code: string, params: object }}
 */
export function fault(code, params, message) {
  return Object.assign(new Error(message), { code, params });
}
