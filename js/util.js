// Small helpers shared by every view: element builders, number formatting,
// a single tooltip, and data loading.

export const SVGNS = "http://www.w3.org/2000/svg";

function apply(node, attrs, kids) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.setAttribute("class", v);
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of [].concat(kids || [])) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** Create an SVG element. */
export const s = (tag, attrs, kids) => apply(document.createElementNS(SVGNS, tag), attrs, kids);
/** Create an HTML element. */
export const h = (tag, attrs, kids) => apply(document.createElement(tag), attrs, kids);

export const fmt = {
  int: (n) => Math.round(n).toLocaleString("en-CA"),
  num: (n, d = 1) => Number(n).toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d }),
  signed: (n, d = 3) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(d),
  pct: (n, d = 0) => `${(n * 100).toFixed(d)}%`,
  week: (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }),
};

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- one shared tooltip ---------- */
let tip;
export function showTip(html, x, y) {
  if (!tip) {
    tip = h("div", { class: "tooltip", role: "status", "aria-live": "polite" });
    document.body.append(tip);
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const pad = 14;
  const { width, height } = tip.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + width > window.innerWidth - 8) left = x - width - pad;
  if (top + height > window.innerHeight - 8) top = y - height - pad;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}
export function hideTip() {
  if (tip) tip.hidden = true;
}
/** Wire hover + keyboard focus on an element to show a tooltip. */
export function withTip(node, html) {
  const at = (e) => showTip(typeof html === "function" ? html() : html, e.clientX, e.clientY);
  node.addEventListener("pointerenter", at);
  node.addEventListener("pointermove", at);
  node.addEventListener("pointerleave", hideTip);
  node.addEventListener("focus", () => {
    const r = node.getBoundingClientRect();
    showTip(typeof html === "function" ? html() : html, r.left + r.width / 2, r.top + r.height / 2);
  });
  node.addEventListener("blur", hideTip);
  return node;
}

/* ---------- data ---------- */
const cache = {};
export async function load(name) {
  if (!cache[name]) cache[name] = fetch(`data/${name}.json`).then((r) => r.json());
  return cache[name];
}

/** Linear scale helper. */
export const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
