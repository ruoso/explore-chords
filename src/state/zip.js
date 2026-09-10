/**
 * Zip files, written and read here rather than by a library.
 *
 * A backup is a handful of text files, and the format needed to put them in one
 * download is small enough to write out: a header per file, a directory at the
 * end, and a CRC. That is worth a hundred lines to keep the app's promise that
 * it ships no runtime dependencies (docs/DESIGN.md §3.1).
 *
 * Entries are deflated where the browser can (`deflate-raw`, the same stream a
 * shared link uses) and stored uncompressed where it cannot, which is a valid
 * zip either way. Reading handles both.
 */

import { fault } from '../core/errors.js';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
/** Bit 11: the names in here are UTF-8, which matters for a song called "Coração". */
const UTF8_FLAG = 0x0800;
const STORED = 0;
const DEFLATED = 8;

const table = (() => {
  const out = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    out[i] = c >>> 0;
  }
  return out;
})();

/** CRC-32, which every entry carries so a reader can tell it arrived whole. */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function through(bytes, stream) {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const packed = await through(bytes, new CompressionStream('deflate-raw'));
    // Compression that makes a file bigger is not compression.
    return packed.length < bytes.length ? packed : null;
  } catch {
    return null;
  }
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw fault('cannotDecompress', {}, 'This browser cannot read a compressed backup.');
  }
  return through(bytes, new DecompressionStream('deflate-raw'));
}

/** Two 16-bit fields nobody reads, but every entry has to carry. */
function dosTime(date) {
  const time =
    (Math.floor(date.getSeconds() / 2) & 0x1f) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getHours() & 0x1f) << 11);
  const day =
    (date.getDate() & 0x1f) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    ((Math.max(0, date.getFullYear() - 1980) & 0x7f) << 9);
  return { time, day };
}

/**
 * @param {{name: string, text: string}[]} files
 * @param {Date} [at]  the timestamp written into every entry
 * @returns {Promise<Blob>}
 */
export async function createZip(files, at = new Date()) {
  const { time, day } = dosTime(at);
  const encoder = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const raw = encoder.encode(file.text);
    const packed = await deflate(raw);
    const body = packed ?? raw;
    const method = packed ? DEFLATED : STORED;
    const sum = crc32(raw);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, LOCAL_SIGNATURE, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, UTF8_FLAG, true);
    local.setUint16(8, method, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, sum, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, body);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, CENTRAL_SIGNATURE, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, UTF8_FLAG, true);
    central.setUint16(10, method, true);
    central.setUint16(12, time, true);
    central.setUint16(14, day, true);
    central.setUint32(16, sum, true);
    central.setUint32(20, body.length, true);
    central.setUint32(24, raw.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    directory.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + body.length;
  }

  const directorySize = directory.reduce((n, part) => n + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, END_SIGNATURE, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...directory, new Uint8Array(end.buffer)], {
    type: 'application/zip',
  });
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{name: string, text: string}[]>}
 * @throws when it is not a zip, or an entry did not arrive whole
 */
export async function readZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder();

  // The directory is at the end, after a comment of unknown length, so the
  // signature is found by scanning back from there.
  let end = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === END_SIGNATURE) {
      end = i;
      break;
    }
  }
  if (end < 0) throw fault('notABackup', {}, 'That file is not a zip.');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = [];

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      throw fault('notABackup', {}, 'That zip is not readable.');
    }
    const method = view.getUint16(at + 10, true);
    const sum = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const start = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    const localName = view.getUint16(start + 26, true);
    const localExtra = view.getUint16(start + 28, true);
    const from = start + 30 + localName + localExtra;
    const body = bytes.subarray(from, from + compressed);
    const raw = method === DEFLATED ? await inflate(body) : body;
    if (crc32(raw) !== sum) {
      throw fault('backupDamaged', { name }, `“${name}” did not arrive whole.`);
    }
    files.push({ name, text: decoder.decode(raw) });

    at += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}
