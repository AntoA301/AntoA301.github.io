// Small SVG chart builders used by the reports. Every mark gets a keyboard-
// focusable hit area with a tooltip, so values are readable without a mouse.
import { s, h, scale, withTip } from "./util.js?v=20261125-3";

// Charts are drawn once per open, at a width that suits the screen.
const narrow = () => window.innerWidth < 600;
let W = 720;
export const chartWidth = () => (W = narrow() ? 360 : 720);

function hitRect(attrs, tip, onclick) {
  const r = s("rect", { class: "hit", tabindex: 0, ...attrs });
  if (tip) withTip(r, tip);
  if (onclick) {
    r.style.cursor = "pointer";
    r.setAttribute("role", "link");
    r.addEventListener("click", onclick);
    r.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onclick();
    });
  }
  return r;
}

function ticks(lo, hi, n = 5) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n)));
  const err = (hi - lo) / n / step;
  const m = err >= 7 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
  const st = m * step;
  const out = [];
  for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10));
  return out;
}

/** Wrap a chart in a titled figure. */
export function figure({ title, note, controls, source, body }) {
  return h("figure", { class: "chart" }, [
    h("div", { class: "chart-head" }, [
      h("div", {}, [h("h4", { text: title }), note ? h("p", { text: note }) : null]),
      controls || null,
    ]),
    body,
    source ? h("figcaption", { class: "chart-source", text: source }) : null,
  ]);
}

/** Segmented toggle. options: [{key,label}] */
export function toggle(options, active, onChange, label) {
  const g = h("div", { class: "segmented", role: "group", "aria-label": label });
  const set = (k) => {
    g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
    onChange(k);
  };
  for (const o of options) {
    g.append(h("button", { type: "button", "data-k": o.key, "aria-pressed": String(o.key === active), onclick: () => set(o.key) }, o.label));
  }
  return g;
}

/**
 * Horizontal bars, optionally with confidence intervals and a zero line.
 * rows: [{label, value, lo, hi, color, tip, onclick, emphasis}]
 */
export function hbars(rows, { domain, format, valueFormat, labelWidth = 230, rowH = 30, ci = false, zero = true, ref = null } = {}) {
  chartWidth();
  const vfmt = valueFormat || format;
  const stacked = narrow();
  if (stacked) rowH = Math.max(rowH, 26) + 16; // room for the label above each bar
  const H = rows.length * rowH + 30;
  const left = stacked ? 8 : labelWidth;
  const right = W - (stacked ? 56 : 64);
  const vals = rows.flatMap((r) => [r.value, r.lo ?? r.value, r.hi ?? r.value, 0]);
  const [d0, d1] = domain || [Math.min(...vals), Math.max(...vals)];
  const x = scale(d0, d1, left, right);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });

  for (const t of ticks(d0, d1)) {
    svg.append(s("line", { class: t === 0 && zero && ref === null ? "zero" : "gridline", x1: x(t), x2: x(t), y1: 0, y2: H - 22 }));
    svg.append(s("text", { class: "axis-label", x: x(t), y: H - 6, "text-anchor": "middle", text: format(t) }));
  }
  // reference line, e.g. a rate ratio of 1 = no effect
  if (ref !== null) svg.append(s("line", { class: "zero", x1: x(ref), x2: x(ref), y1: 0, y2: H - 22, "stroke-dasharray": "4 3" }));

  rows.forEach((r, i) => {
    const y = stacked ? i * rowH + 16 : i * rowH;
    const cy = stacked ? y + (rowH - 16) / 2 : y + rowH / 2;
    if (stacked) svg.append(s("text", { class: "row-label", x: left, y: y - 3, text: r.label }));
    else svg.append(s("text", { class: "row-label", x: left - 12, y: cy + 4, "text-anchor": "end", text: r.label }));
    if (ci) {
      if (r.lo !== null && r.lo !== undefined) {
        svg.append(s("line", { x1: x(r.lo), x2: x(r.hi), y1: cy, y2: cy, stroke: r.color, "stroke-width": 2 }));
        for (const v of [r.lo, r.hi]) svg.append(s("line", { x1: x(v), x2: x(v), y1: cy - 5, y2: cy + 5, stroke: r.color, "stroke-width": 2 }));
      }
      svg.append(
        r.emphasis === "hollow"
          ? s("circle", { cx: x(r.value), cy, r: 5, fill: "#161c18", stroke: r.color, "stroke-width": 2 })
          : s("rect", { x: x(r.value) - 5, y: cy - 5, width: 10, height: 10, fill: r.color }),
      );
      svg.append(
        s("text", { class: "value-label", x: right + 8, y: cy + 4, text: vfmt(r.value) }),
      );
    } else {
      const x0 = x(Math.max(d0, 0));
      const x1 = x(r.value);
      const barH = stacked ? rowH - 24 : rowH - 14;
      svg.append(
        s("rect", { x: Math.min(x0, x1), y: cy - barH / 2, width: Math.max(Math.abs(x1 - x0), 1.5), height: barH, fill: r.color }),
      );
      const outside = r.value >= 0;
      svg.append(
        s("text", {
          class: "value-label",
          x: outside ? x1 + 6 : x1 - 6,
          y: cy + 4,
          "text-anchor": outside ? "start" : "end",
          text: vfmt(r.value),
        }),
      );
    }
    svg.append(hitRect({ x: 0, y: stacked ? y - 16 : y, width: W, height: rowH }, r.tip, r.onclick));
  });
  return svg;
}

/**
 * Two series over the same categories: solid "actual" and dashed "forecast".
 * points: [{key, label, a, b}] ; a = actual, b = forecast
 */
export function lineCompare(points, { labels = ["Actual", "Forecast"], format, annotate } = {}) {
  chartWidth();
  const H = narrow() ? 260 : 300;
  const L = 46;
  const R = W - 16;
  const T = 16;
  const B = H - 34;
  const max = Math.max(...points.flatMap((p) => [p.a, p.b])) * 1.1;
  const x = scale(0, points.length - 1, L + 10, R - 10);
  const y = scale(0, max, B, T);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });

  for (const t of ticks(0, max, 4)) {
    svg.append(s("line", { class: "gridline", x1: L, x2: R, y1: y(t), y2: y(t) }));
    svg.append(s("text", { class: "axis-label", x: L - 8, y: y(t) + 4, "text-anchor": "end", text: format(t) }));
  }
  points.forEach((p, i) => {
    if (!narrow() || i % 2 === 0)
      svg.append(s("text", { class: "axis-label", x: x(i), y: H - 12, "text-anchor": "middle", text: p.label }));
  });

  const path = (k) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  svg.append(s("path", { d: path("a"), fill: "none", stroke: "#d9ded4", "stroke-width": 2.2 }));
  svg.append(s("path", { d: path("b"), fill: "none", stroke: "#d69e3a", "stroke-width": 2.2, "stroke-dasharray": "6 5" }));
  points.forEach((p, i) => {
    svg.append(s("circle", { cx: x(i), cy: y(p.a), r: 3.5, fill: "#d9ded4" }));
    svg.append(s("circle", { cx: x(i), cy: y(p.b), r: 3.5, fill: "#161c18", stroke: "#d69e3a", "stroke-width": 2 }));
  });

  if (annotate) {
    const i = annotate.index;
    const ax = x(i);
    svg.append(s("line", { x1: ax, x2: ax, y1: y(points[i].b), y2: y(points[i].a), stroke: "#d69e3a", "stroke-width": 1, "stroke-dasharray": "2 3" }));
    svg.append(s("text", { class: "value-label", x: ax + 10, y: (y(points[i].a) + y(points[i].b)) / 2, text: annotate.text }));
  }

  // one focus column per category, showing both values
  const colW = (R - L) / points.length;
  const guide = s("line", { x1: 0, x2: 0, y1: T, y2: B, stroke: "#626b5f", "stroke-dasharray": "2 3", opacity: 0 });
  svg.append(guide);
  points.forEach((p, i) => {
    const r = hitRect(
      { x: x(i) - colW / 2, y: T, width: colW, height: B - T },
      `<strong>${p.key}</strong>
       <div class="t-row">${labels[0]} <b>${format(p.a)}</b></div>
       <div class="t-row">${labels[1]} <b>${format(p.b)}</b></div>
       <div class="t-row">Miss <b>${format(p.b - p.a)}</b></div>`,
    );
    const on = () => {
      guide.setAttribute("x1", x(i));
      guide.setAttribute("x2", x(i));
      guide.setAttribute("opacity", 1);
    };
    r.addEventListener("pointerenter", on);
    r.addEventListener("focus", on);
    r.addEventListener("pointerleave", () => guide.setAttribute("opacity", 0));
    r.addEventListener("blur", () => guide.setAttribute("opacity", 0));
    svg.append(r);
  });
  return svg;
}

/** Vertical bars over time. points: [{key, label, value, color, tip}] */
export function vbars(points, { format, labelEvery = 1, marker } = {}) {
  chartWidth();
  if (narrow()) labelEvery *= 2;
  const H = 240;
  const L = 46;
  const R = W - 10;
  const T = 14;
  const B = H - 30;
  const max = Math.max(...points.map((p) => p.value)) * 1.08;
  const bw = (R - L) / points.length;
  const y = scale(0, max, B, T);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
  for (const t of ticks(0, max, 4)) {
    svg.append(s("line", { class: "gridline", x1: L, x2: R, y1: y(t), y2: y(t) }));
    svg.append(s("text", { class: "axis-label", x: L - 8, y: y(t) + 4, "text-anchor": "end", text: format(t) }));
  }
  if (marker) {
    const mx = L + marker.index * bw;
    svg.append(s("line", { x1: mx, x2: mx, y1: T - 4, y2: B, stroke: "#d69e3a", "stroke-dasharray": "3 4" }));
    svg.append(s("text", { class: "value-label", x: mx + 6, y: T + 8, fill: "#d69e3a", text: marker.text }));
  }
  points.forEach((p, i) => {
    const bx = L + i * bw;
    svg.append(s("rect", { x: bx + 2, y: y(p.value), width: bw - 4, height: B - y(p.value), fill: p.color || "#5d6f50" }));
    if (i % labelEvery === 0)
      svg.append(s("text", { class: "axis-label", x: bx + bw / 2, y: H - 10, "text-anchor": "middle", text: p.label }));
    svg.append(hitRect({ x: bx, y: T, width: bw, height: B - T }, p.tip));
  });
  return svg;
}
