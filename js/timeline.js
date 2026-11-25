// Experience timeline, built from the <article class="xp"> entries in index.html.
// Selecting a bar shows that entry's details below the timeline.
import { s, h } from "./util.js?v=20261125-3";

const START = 2017;
const END = 2028;
const LANES = ["Education", "Work", "Extracurricular"];
const W = 1000;
const LEFT = 130;
const RIGHT = W - 20;
const LANE_H = 54;
const TOP = 28;

const toYear = (ym) => {
  if (ym === "present") {
    const d = new Date();
    return d.getFullYear() + d.getMonth() / 12;
  }
  const [y, m] = ym.split("-").map(Number);
  return y + (m - 1) / 12;
};

export function initTimeline(host, entriesHost) {
  const entries = [...entriesHost.querySelectorAll(".xp")].map((el) => ({
    el,
    id: el.id,
    lane: el.dataset.lane,
    label: el.dataset.label,
    start: toYear(el.dataset.start),
    end: toYear(el.dataset.end),
    title: el.querySelector("h3").textContent,
  }));

  const x = (v) => LEFT + ((v - START) / (END - START)) * (RIGHT - LEFT);
  const H = TOP + LANES.length * LANE_H + 10;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Timeline of education, work and extracurriculars" });

  for (let y = START; y <= END; y++) {
    svg.append(s("line", { class: "yearline", x1: x(y), x2: x(y), y1: TOP - 6, y2: H - 10 }));
    if (y < END) svg.append(s("text", { class: "year", x: x(y) + 4, y: TOP - 12, text: y }));
  }
  LANES.forEach((lane, i) =>
    svg.append(s("text", { class: "lane-label", x: 0, y: TOP + i * LANE_H + LANE_H / 2 + 4, text: lane })),
  );

  const now = toYear("present");
  svg.append(
    s("g", { class: "now" }, [
      s("line", { x1: x(now), x2: x(now), y1: TOP - 6, y2: H - 10 }),
      s("text", { x: x(now) + 4, y: H - 2, text: "Today" }),
    ]),
  );

  const bars = {};
  for (const e of entries) {
    const lane = LANES.indexOf(e.lane);
    const y = TOP + lane * LANE_H + 10;
    const x0 = x(e.start);
    const w = Math.max(x(e.end) - x0, 26);
    const g = s("g", {
      class: `bar lane-${e.lane}`,
      tabindex: 0,
      role: "button",
      "aria-label": `${e.title}, ${e.label}`,
      onclick: () => select(e.id),
      onkeydown: (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select(e.id);
        }
      },
    });
    g.append(s("rect", { x: x0, y, width: w, height: LANE_H - 20 }));
    // label inside the bar if it fits, otherwise beside it (left of it near the right edge)
    const labelW = e.label.length * 8 + 14;
    const fits = w > labelW;
    const before = !fits && x0 + w + labelW > RIGHT;
    g.append(
      s("text", {
        x: fits ? x0 + 8 : before ? x0 - 6 : x0 + w + 6,
        y: y + (LANE_H - 20) / 2 + 4,
        "text-anchor": before ? "end" : "start",
        text: e.label,
      }),
    );
    bars[e.id] = g;
    svg.append(g);
  }

  // lane filter
  const filters = h("div", { class: "segmented", role: "group", "aria-label": "Show" });
  const setFilter = (lane) => {
    filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lane === lane)));
    for (const e of entries) bars[e.id].classList.toggle("muted", lane !== "All" && e.lane !== lane);
    for (const [key, g] of Object.entries(groups)) g.hidden = lane !== "All" && key !== lane;
  };
  for (const lane of ["All", ...LANES]) {
    filters.append(h("button", { type: "button", "data-lane": lane, "aria-pressed": String(lane === "All"), onclick: () => setFilter(lane) }, lane));
  }

  // show every card at once, grouped by lane (work first)
  const GROUP_ORDER = [
    ["Work", "Work experience"],
    ["Extracurricular", "Extracurriculars"],
    ["Education", "Education"],
  ];
  const groups = {};
  for (const [lane, title] of GROUP_ORDER) {
    const list = h("div", { class: "xp-list" });
    entries
      .filter((e) => e.lane === lane)
      .sort((a, b) => b.start - a.start)
      .forEach((e) => {
        e.el.classList.add("panel");
        list.append(e.el);
      });
    groups[lane] = h("section", { class: "xp-group", "aria-label": title }, [h("h3", { class: "xp-group-title", text: title }), list]);
  }
  entriesHost.replaceChildren(...GROUP_ORDER.map(([lane]) => groups[lane]));

  host.replaceChildren(
    h("div", { class: "panel timeline" }, [
      h("div", { class: "timeline-filters" }, [filters, h("span", { text: "Select a bar for details" })]),
      h("div", { class: "timeline-scroll" }, svg),
    ]),
  );

  function select(id, scrollPage = true) {
    // on narrow screens the timeline scrolls sideways: bring the selected bar into view
    const scroller = host.querySelector(".timeline-scroll");
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      const r = bars[id].getBoundingClientRect();
      const box = scroller.getBoundingClientRect();
      scroller.scrollLeft += r.left - box.left - (box.width - r.width) / 2;
    }
    for (const e of entries) {
      const on = e.id === id;
      e.el.classList.toggle("active", on);
      bars[e.id].classList.toggle("selected", on);
      bars[e.id].setAttribute("aria-pressed", String(on));
    }
    const card = entries.find((e) => e.id === id)?.el;
    if (card && scrollPage) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    }
  }
  select("xp-butterfield", false);
}
