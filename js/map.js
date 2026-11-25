// Research map: the 11 study regions coloured by a chosen layer, with a
// sortable region list and a detail card that joins both reports' results.
import { s, h, fmt, withTip, hideTip } from "./util.js?v=20261125-5";

const LAYERS = {
  error: {
    label: "Forecast error",
    title: "Forecast error: average miss as a % of average weekly deaths",
    get: (r) => r.err.maePct,
    show: (v) => `${fmt.num(v, 0)}%`,
    ramp: ["#26302a", "#d69e3a"],
    note: "Higher = the forecast missed by more, relative to how deadly the region was.",
  },
  deaths: {
    label: "Weekly deaths",
    title: "Average weekly deaths, Dec 2023 – Sep 2025",
    get: (r) => r.err.meanActual,
    show: (v) => fmt.num(v, 1),
    log: true,
    ramp: ["#26302a", "#c8823a"],
    note: "Log colour scale: Donetsk averaged about 1,000 times more deaths a week than Bryansk.",
  },
  effect: {
    label: "Drone vs artillery",
    title: "Drone/air vs artillery: average change in deaths per strike",
    get: (r) => r.st.avgEffect,
    show: (v) => fmt.signed(v, 3),
    diverging: true,
    note: "Green = drone/air strikes killed fewer people per strike than comparable artillery strikes.",
  },
  strikes: {
    label: "Strikes analysed",
    title: "Strikes analysed in the drone study",
    get: (r) => r.st.strikes,
    show: (v) => fmt.int(v),
    ramp: ["#26302a", "#8fa67a"],
    note: "Drone/air strikes plus shelling, artillery and missile attacks, Aug 2023 – Sep 2025.",
  },
};

const mix = (a, b, t) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

let state = null;

export async function initMap(host, geo, data) {
  const regions = geo.regions.map((r) => ({
    ...r,
    err: data.forecast.regionErrors[r.id],
    st: data.causal.byOblast[r.id],
  }));
  const { lon0, lat1, k, cos } = geo.proj;
  const proj = (lon, lat) => [(lon - lon0) * cos * k, (lat1 - lat) * k];

  // crop the view to the study regions
  const nums = regions.flatMap((r) => r.d.match(/-?\d+\.?\d*/g).map(Number));
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const pad = 46;
  const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, 0, 0];
  vb[2] = Math.max(...xs) + pad - vb[0];
  vb[3] = Math.max(...ys) + pad - vb[1];

  const svg = s("svg", {
    class: "map-svg",
    viewBox: vb.map((v) => v.toFixed(0)).join(" "),
    role: "group",
    "aria-label": "Map of the 11 study regions",
  });

  for (const d of geo.context) svg.append(s("path", { class: "ctx", d }));

  // 1° graticule with coordinate labels on the top and left edges
  for (let lon = 29; lon <= 42; lon++) {
    const [x] = proj(lon, 0);
    if (x < vb[0] || x > vb[0] + vb[2]) continue;
    svg.append(s("line", { class: "grat", x1: x, x2: x, y1: vb[1], y2: vb[1] + vb[3] }));
    svg.append(s("text", { class: "grat-label", x: x + 4, y: vb[1] + 18, text: `${lon}° E` }));
  }
  for (let lat = 45; lat <= 54; lat++) {
    const [, y] = proj(0, lat);
    if (y < vb[1] || y > vb[1] + vb[3]) continue;
    svg.append(s("line", { class: "grat", x1: vb[0], x2: vb[0] + vb[2], y1: y, y2: y }));
    svg.append(s("text", { class: "grat-label", x: vb[0] + 4, y: y - 4, text: `${lat}° N` }));
  }

  svg.append(s("path", { class: "border-ua", d: geo.ukraineBorder }));
  {
    const [ux, uy] = proj(30.6, 49.25);
    const [rx, ry] = proj(39.6, 52.3);
    svg.append(s("text", { class: "country-label", x: ux, y: uy, text: "Ukraine" }));
    svg.append(s("text", { class: "country-label", x: rx, y: ry, "text-anchor": "middle", text: "Russia" }));
  }

  const shapes = {};
  for (const r of regions) {
    const p = s("path", {
      class: "region",
      d: r.d,
      tabindex: 0,
      role: "button",
      "aria-label": `${r.id}, ${r.country}`,
      onclick: () => (location.hash = `#map/${r.id}`),
      onkeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          location.hash = `#map/${r.id}`;
        }
      },
    });
    withTip(p, () => {
      const L = LAYERS[state.layer];
      return `<strong>${r.id}</strong><div class="t-row">${L.label} <b>${L.show(L.get(r))}</b></div>`;
    });
    shapes[r.id] = p;
    svg.append(p);
  }
  for (const r of regions) {
    svg.append(s("text", { class: "region-label", x: r.lx, y: r.ly, "text-anchor": "middle", text: r.id }));
  }

  // toolbar, legend, list and detail card
  const seg = h("div", { class: "segmented", role: "group", "aria-label": "Map layer" });
  for (const [key, L] of Object.entries(LAYERS)) {
    seg.append(
      h("button", { type: "button", "aria-pressed": "false", "data-layer": key, onclick: () => setLayer(key) }, L.label),
    );
  }
  const layerTitle = h("p", { class: "box-note", style: "margin:0" });
  const legend = h("div", { class: "legend" });
  const layerNote = h("span");
  const list = h("ul", { class: "region-list" });
  const detail = h("div", { class: "panel region-detail", "aria-live": "polite" });

  host.replaceChildren(
    h("div", { class: "panel map-stage" }, [
      h("div", { class: "map-toolbar" }, [seg, layerTitle]),
      svg,
      h("div", { class: "map-foot" }, [legend, layerNote]),
    ]),
    h("div", { class: "map-side" }, [
      detail,
      h("div", { class: "panel" }, [h("h3", { class: "box-title", text: "All regions, ranked by layer" }), list]),
    ]),
  );

  state = { regions, shapes, seg, layerTitle, legend, layerNote, list, detail, layer: "error", selected: "Kursk" };
  setLayer("error");
  selectRegion(state.selected);
}

function colourFor(L, values) {
  if (L.diverging) {
    const m = Math.max(...values.map(Math.abs));
    return (v) => (v < 0 ? mix("#26302a", "#8fa67a", Math.abs(v) / m) : mix("#26302a", "#d69e3a", v / m));
  }
  const f = L.log ? Math.log10 : (v) => v;
  const lo = f(Math.min(...values));
  const hi = f(Math.max(...values));
  return (v) => mix(L.ramp[0], L.ramp[1], (f(v) - lo) / (hi - lo || 1));
}

function setLayer(key) {
  const st = state;
  st.layer = key;
  const L = LAYERS[key];
  st.seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layer === key)));
  st.layerTitle.textContent = L.title;
  st.layerNote.textContent = L.note;

  const values = st.regions.map(L.get);
  const colour = colourFor(L, values);
  for (const r of st.regions) st.shapes[r.id].style.fill = colour(L.get(r));

  // legend
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const stops = L.diverging
    ? `linear-gradient(90deg, #8fa67a, #26302a ${((-lo / (hi - lo)) * 100).toFixed(0)}%, #d69e3a)`
    : `linear-gradient(90deg, ${L.ramp[0]}, ${L.ramp[1]})`;
  st.legend.replaceChildren(
    h("span", { class: "num", text: L.show(lo) }),
    h("span", { class: "legend-bar", style: `background:${stops}` }),
    h("span", { class: "num", text: L.show(hi) }),
  );

  // ranked list with inline bars
  const sorted = [...st.regions].sort((a, b) => (L.diverging ? L.get(a) - L.get(b) : L.get(b) - L.get(a)));
  const maxAbs = Math.max(...values.map(Math.abs));
  st.list.replaceChildren(
    ...sorted.map((r) => {
      const v = L.get(r);
      const w = L.log
        ? (Math.log10(v + 1) / Math.log10(maxAbs + 1)) * 100
        : (Math.abs(v) / maxAbs) * 100;
      return h("li", {}, [
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(r.id === st.selected),
            onclick: () => (location.hash = `#map/${r.id}`),
          },
          [
            h("span", { class: "rl-name", text: r.id }),
            h("span", { class: "rl-track" }, [
              h("span", { class: "rl-fill", style: `width:${w.toFixed(1)}%;background:${colour(v)}` }),
            ]),
            h("span", { class: "rl-val", text: L.show(v) }),
          ],
        ),
      ]);
    }),
  );
}

export function selectRegion(id) {
  const st = state;
  if (!st) return;
  const r = st.regions.find((x) => x.id.toLowerCase() === String(id).toLowerCase());
  if (!r) return;
  st.selected = r.id;
  hideTip();
  for (const [key, p] of Object.entries(st.shapes)) {
    p.classList.toggle("selected", key === r.id);
    if (key === r.id) p.parentNode.append(p); // draw the selected outline on top
  }
  // keep labels above shapes
  labelsToTop();
  st.list.querySelectorAll("button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.querySelector(".rl-name").textContent === r.id)),
  );

  const e = r.err;
  const c = r.st;
  const effectText =
    Math.abs(c.avgEffect) < 0.02
      ? "Here the difference between drone/air and artillery strikes is close to zero."
      : c.avgEffect < 0
        ? `Here a drone/air strike killed on average ${Math.abs(c.avgEffect).toFixed(3)} fewer people than a comparable artillery strike, which averaged ${c.artilleryAvg.toFixed(3)} deaths.`
        : `Here a drone/air strike killed on average ${c.avgEffect.toFixed(3)} more people than a comparable artillery strike. With only ${fmt.int(c.strikes)} strikes, treat this with caution.`;

  st.detail.replaceChildren(
    h("h3", { text: r.id }),
    h("p", { class: "country", text: `${r.country}, ${r.lat.toFixed(1)}° N, ${r.lon.toFixed(1)}° E` }),
    h("div", { class: "metric-group" }, [
      h("h4", {}, [h("span", { text: "Forecast report" }), h("a", { class: "textlink", href: "#reports/forecast", text: "Open" })]),
      h("dl", { class: "metrics" }, [
        h("div", {}, [h("dt", { text: fmt.num(e.meanActual) }), h("dd", { text: "average weekly deaths" })]),
        h("div", {}, [h("dt", { text: fmt.num(e.mae) }), h("dd", { text: "average forecast miss (MAE)" })]),
        h("div", {}, [h("dt", { text: fmt.num(e.rmse) }), h("dd", { text: "RMSE, which punishes big misses" })]),
        h("div", {}, [h("dt", { text: `${fmt.num(e.maePct, 0)}%` }), h("dd", { text: "miss as a share of average deaths" })]),
      ]),
      r.id === "Kursk"
        ? h("p", { class: "metric-note" }, [
            "First week of the August 2024 incursion: the model forecast 3 deaths, 136 occurred. ",
            h("a", { class: "textlink", href: "#reports/forecast/findings", text: "See the weekly chart" }),
          ])
        : null,
    ]),
    h("div", { class: "metric-group" }, [
      h("h4", {}, [h("span", { text: "Drone vs artillery report" }), h("a", { class: "textlink", href: "#reports/drones", text: "Open" })]),
      h("dl", { class: "metrics" }, [
        h("div", {}, [h("dt", { text: fmt.int(c.strikes) }), h("dd", { text: "strikes analysed" })]),
        h("div", {}, [h("dt", { text: fmt.pct(c.droneShare) }), h("dd", { text: "were drone/air strikes" })]),
        h("div", {}, [h("dt", { text: fmt.signed(c.avgEffect) }), h("dd", { text: "change in deaths per strike, drone vs artillery" })]),
        h("div", {}, [h("dt", { text: c.artilleryAvg.toFixed(3) }), h("dd", { text: "deaths per artillery strike" })]),
      ]),
      h("p", { class: "metric-note", text: effectText }),
    ]),
  );
}

function labelsToTop() {
  const svg = Object.values(state.shapes)[0].ownerSVGElement;
  svg.querySelectorAll(".region-label").forEach((t) => svg.append(t));
}
