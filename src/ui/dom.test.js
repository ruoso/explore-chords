/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { el, add, clear } from './dom.js';

/**
 * `el()` has always dropped a child that is not there. The DOM's own `append`
 * writes the text "null" for one, which had put a literal "null" on the reading
 * page and in the voicings panel — twice, because a child behind a condition is
 * the most ordinary thing to write.
 */
describe('adding children that might not be there', () => {
  it('skips what is absent rather than writing it out', () => {
    const node = add(document.createElement('div'), el('b', {}, 'here'), null, undefined, false);
    expect(node.textContent).toBe('here');
    expect(node.childNodes.length).toBe(1);
  });

  it('is what the DOM does not do, which is the whole reason it exists', () => {
    const plain = document.createElement('div');
    plain.append('a', String(null));
    expect(plain.textContent).toContain('null');

    const safe = add(document.createElement('div'), 'a', null);
    expect(safe.textContent).toBe('a');
  });

  it('keeps a zero, which is absent-looking and not absent', () => {
    expect(add(document.createElement('div'), 0).textContent).toBe('0');
  });

  it('flattens arrays, as spreading a mapped list produces', () => {
    const node = add(document.createElement('div'), ['a', null, 'b']);
    expect(node.textContent).toBe('ab');
  });

  it('is what el uses, so the two can never drift', () => {
    expect(el('p', {}, 'a', null, 'b').textContent).toBe('ab');
  });

  it('clear empties a node', () => {
    expect(clear(el('p', {}, 'a', el('b', {}, 'c'))).childNodes.length).toBe(0);
  });
});
