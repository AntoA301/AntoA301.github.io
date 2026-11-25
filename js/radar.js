// Overview radar. The blips are the 11 study regions at their real bearing and
// distance from a centre point (49.5° N, 35.5° E). Each blip pings as the sweep
// passes it. Blip size = average weekly deaths in the forecast's test window.
import { s, fmt, withTip } from "./util.js?v=20261125-4";

const CENTER = { lat: 49.5, lon: 35.5 };
const KM_PER_DEG = 111.2;
const MAX_KM = 420;
const R = 230; // radius in SVG units
const PERIOD = 8; // seconds per sweep, must match the CSS animation

function polar(lat, lon) {
  const dx = (lon - CENTER.lon) * Math.cos((CENTER.lat * Math.PI) / 180) * KM_PER_DEG;
  const dy = (lat - CENTER.lat) * KM_PER_DEG;
  const km = Math.hypot(dx, dy);
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360; // clockwise from north
  return { km, bearing, x: (dx / MAX_KM) * R, y: (-dy / MAX_KM) * R };
}

const arcPoint = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
};

export function initRadar(host, geo, data) {
  const errors = data.forecast.regionErrors;
  const strikes = data.causal.byOblast;
  const svg = s("svg", { viewBox: "-270 -270 540 540", role: "group", "aria-label": "Radar of study regions" });

  // range rings every 100 km
  for (let km = 100; km <= 400; km += 100) {
    const r = (km / MAX_KM) * R;
    svg.append(s("circle", { class: "ring", r }));
    svg.append(s("text", { class: "range", x: 4, y: -r - 4, text: `${km} km` }));
  }
  svg.append(s("circle", { class: "ring outer", r: R }));
  svg.append(s("line", { class: "axis", x1: -R, x2: R, y1: 0, y2: 0 }));
  svg.append(s("line", { class: "axis", x1: 0, x2: 0, y1: -R, y2: R }));

  // bearing ticks and labels
  for (let deg = 0; deg < 360; deg += 10) {
    const long = deg % 30 === 0;
    const [x1, y1] = arcPoint(deg, R);
    const [x2, y2] = arcPoint(deg, R + (long ? 9 : 5));
    svg.append(s("line", { class: "tick", x1, y1, x2, y2 }));
    if (long) {
      const [tx, ty] = arcPoint(deg, R + 22);
      const label = deg === 0 ? "N" : String(deg).padStart(3, "0");
      svg.append(s("text", { class: "bearing", x: tx, y: ty + 4, "text-anchor": "middle", text: label }));
    }
  }

  // sweep: a leading line with a fading trail of thin wedges behind it
  const sweep = s("g", { class: "sweep", "aria-hidden": "true" });
  const TRAIL = 40;
  for (let i = 0; i < TRAIL; i++) {
    const a0 = -i - 1;
    const a1 = -i;
    const [x0, y0] = arcPoint(a0, R);
    const [x1, y1] = arcPoint(a1, R);
    sweep.append(
      s("path", {
        d: `M0,0 L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z`,
        fill: "#8fa67a",
        "fill-opacity": (0.2 * (1 - i / TRAIL) ** 2).toFixed(3),
      }),
    );
  }
  const [lx, ly] = arcPoint(0, R);
  sweep.append(s("line", { x1: 0, y1: 0, x2: lx, y2: ly, stroke: "#8fa67a", "stroke-width": 1.5, "stroke-opacity": 0.8 }));
  svg.append(sweep);

  // blips
  const blips = geo.regions
    .map((r) => ({ ...r, ...polar(r.lat, r.lon), err: errors[r.id], st: strikes[r.id] }))
    .sort((a, b) => b.err.meanActual - a.err.meanActual);

  for (const b of blips) {
    const size = 3 + Math.sqrt(b.err.meanActual) * 0.42;
    const delay = ((b.bearing / 360) * PERIOD).toFixed(2);
    const g = s("g", {
      class: "blip",
      tabindex: 0,
      role: "link",
      transform: `translate(${b.x.toFixed(1)},${b.y.toFixed(1)})`,
      "aria-label": `${b.id}, ${b.country}. Open on the research map.`,
      onclick: () => (location.hash = `#map/${b.id}`),
      onkeydown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          location.hash = `#map/${b.id}`;
        }
      },
    });
    g.append(s("circle", { class: "blip-hit", r: Math.max(size + 6, 12) }));
    g.append(s("circle", { class: "blip-ping", r: size, style: `animation-delay:${delay}s` }));
    g.append(s("circle", { class: "blip-core", r: size, "fill-opacity": 0.85 }));
    const right = b.x > 150;
    g.append(
      s("text", {
        class: "blip-label",
        x: right ? -(size + 5) : size + 5,
        y: 4,
        "text-anchor": right ? "end" : "start",
        text: b.id,
      }),
    );
    withTip(
      g,
      () => `<strong>${b.id}</strong>
        <div class="t-row">Country <b>${b.country}</b></div>
        <div class="t-row">Distance, bearing <b>${fmt.int(b.km)} km, ${String(Math.round(b.bearing)).padStart(3, "0")}°</b></div>
        <div class="t-row">Avg weekly deaths <b>${fmt.num(b.err.meanActual)}</b></div>
        <div class="t-row">Strikes in drone study <b>${fmt.int(b.st.strikes)}</b></div>`,
    );
    svg.append(g);
  }

  svg.append(s("circle", { r: 3, fill: "#d69e3a" }));
  svg.append(
    s("text", { class: "range", x: 0, y: R + 46, "text-anchor": "middle", text: "Centre 49.5° N, 35.5° E" }),
  );
  host.replaceChildren(svg);
}
