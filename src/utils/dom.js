/**
 * Крошечный помощник для сборки DOM без шаблонизаторов.
 *
 *   el('button.btn.btn--primary', { onClick: fn }, 'Играть')
 */

/** Создаёт элемент по CSS-подобному описанию тега. */
export function el(selector, props = {}, ...children) {
  const [tagPart, ...classes] = selector.split('.');
  const [tag, id] = tagPart.split('#');
  const node = document.createElement(tag || 'div');
  if (id) node.id = id;
  if (classes.length) node.classList.add(...classes);

  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.classList.add(...String(value).split(' ').filter(Boolean));
    else if (key === 'style' && typeof value === 'object') {
      // Пользовательские свойства (--i) через Object.assign не проходят.
      for (const [name, css] of Object.entries(value)) {
        if (name.startsWith('--')) node.style.setProperty(name, css);
        else node.style[name] = css;
      }
    }
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }

  append(node, children);
  return node;
}

/** Рекурсивно добавляет детей: строки, узлы, массивы, null. */
export function append(parent, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Убирает элемент с анимацией исчезновения. */
export function removeSoft(node, className = 'toast--leaving', delay = 200) {
  if (!node) return;
  node.classList.add(className);
  setTimeout(() => node.remove(), delay);
}
