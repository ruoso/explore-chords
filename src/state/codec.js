/**
 * Share-link encoding for song sheets (docs/DESIGN.md §8.2).
 *
 * Sheets can be large, so they travel in the URL *fragment* — never sent to a
 * server, even if one were later introduced — as compressed JSON.
 *
 * Compression uses the platform's CompressionStream rather than a bundled
 * library, which keeps the no-dependency claim honest. Where it is missing the
 * payload is simply carried uncompressed; a one-character prefix says which,
 * so a reader never has to guess.
 */

const COMPRESSED = 'z';
const PLAIN = 'u';

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hasCompression() {
  return typeof globalThis.CompressionStream === 'function';
}

/**
 * Push bytes through a transform stream and collect the result.
 *
 * Deliberately avoids Blob.stream() and Response: those are unavailable or
 * incomplete in some environments (jsdom has Blob but not Blob.stream), and
 * reading the reader directly works the same everywhere.
 */
async function through(transform, bytes) {
  const writer = transform.writable.getWriter();
  writer.write(bytes);
  writer.close();

  const reader = transform.readable.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** @returns {Promise<string>} a fragment-safe payload */
export async function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (!hasCompression()) return PLAIN + toBase64Url(bytes);

  const compressed = await through(new CompressionStream('deflate'), bytes);
  // Compression can lose to base64 overhead on very small payloads.
  if (compressed.length >= bytes.length) return PLAIN + toBase64Url(bytes);
  return COMPRESSED + toBase64Url(compressed);
}

/** @returns {Promise<unknown>} @throws when the payload is unreadable */
export async function decodePayload(text) {
  if (typeof text !== 'string' || text.length < 2) {
    throw new Error('That link carries no sheet.');
  }
  const marker = text[0];
  const bytes = fromBase64Url(text.slice(1));

  if (marker === PLAIN) {
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  if (marker === COMPRESSED) {
    if (!hasCompression()) {
      throw new Error('This browser cannot read compressed sheet links.');
    }
    const plain = await through(new DecompressionStream('deflate'), bytes);
    return JSON.parse(new TextDecoder().decode(plain));
  }
  throw new Error('That link is not in a format this app understands.');
}

/** Build the fragment for a sheet. */
export async function encodeSheetLink(sheet) {
  return `#s=${await encodePayload(sheet)}`;
}

/** Read a sheet out of a fragment, or null when there is none. */
export async function decodeSheetLink(hash = globalThis.location?.hash ?? '') {
  const match = /[#&]s=([^&]+)/.exec(hash);
  if (!match) return null;
  return decodePayload(decodeURIComponent(match[1]));
}
