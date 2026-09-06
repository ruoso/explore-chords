/**
 * Small DOM helpers.
 *
 * Deliberately tiny: the app has no framework, and the subtrees each module
 * re-renders are small enough that building elements directly is clearer than
 * any abstraction over it (docs/DESIGN.md §3.4).
 */

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
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
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
