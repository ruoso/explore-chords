/**
 * Small DOM helpers.
 *
 * Deliberately tiny: the app has no framework, and the subtrees each module
 * re-renders are small enough that building elements directly is clearer than
 * any abstraction over it (docs/DESIGN.md §3.4).
 */

/**
 * Append children, skipping the ones that are not there.
 *
 * `el()` has always dropped a null child, while the DOM's own `append` turns
 * one into the text "null". That asymmetry is a trap, because a child behind a
 * condition is the most ordinary thing to write — and it had put a literal
 * "null" on the reading page and in the voicings panel. So this is the one to
 * reach for whenever a child might be absent.
 */
export function add(parent, ...children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/**
 * Create an element with attributes and children.
 * `hidden` is set as a property so `[hidden]` behaves, and event handlers are
 * passed as `on*` keys.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'hidden') node.hidden = Boolean(value);
    else if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  return add(node, ...children);
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Announce a message to screen readers without moving focus. */
export function announce(region, message) {
  if (!region) return;
  region.textContent = message;
}
