// Entry point: hash routing between views, the sliding nav indicator,
// the local clock and the quick-jump command bar.
import { load, h, hideTip } from "./util.js?v=20261125-8";
import { initRadar } from "./radar.js?v=20261125-8";
import { initMap, selectRegion } from "./map.js?v=20261125-8";
import { initReports, openReport } from "./reports.js?v=20261125-8";
import { initSkills } from "./skills.js?v=20261125-8";
import { initTimeline } from "./timeline.js?v=20261125-8";
import { initProfile, showProfileSection } from "./profile.js?v=20261125-8";

const VIEWS = ["overview", "map", "reports", "profile", "experience", "skills"];
const started = new Set();
let current = null;

/* ---------- lazy start each view the first time it opens ---------- */
async function start(view) {
  if (started.has(view)) return;
  started.add(view);
  if (view === "overview") initRadar(document.getElementById("radar"), await load("geo"), await load("projects"));
  if (view === "map") await initMap(document.getElementById("mapview"), await load("geo"), await load("projects"));
  if (view === "reports") initReports(document.getElementById("reports"), await load("projects"));
  if (view === "profile") initProfile(document.getElementById("view-profile"));
  if (view === "skills") initSkills(document.getElementById("skillmap"));
  if (view === "experience") initTimeline(document.getElementById("timeline"), document.getElementById("entries"));
}

/* ---------- routing: #view/detail/sub ---------- */
async function route() {
  const [rawView, a, b] = decodeURIComponent(location.hash.slice(1)).split("/");
  const view = VIEWS.includes(rawView) ? rawView : "overview";
  hideTip();

  if (view !== current) {
    document.querySelectorAll(".view").forEach((v) => {
      const on = v.dataset.view === view;
      v.classList.toggle("active", on);
      v.classList.remove("entering");
      if (on) {
        void v.offsetWidth; // restart the entrance animation
        v.classList.add("entering");
      }
    });
    document.querySelectorAll(".viewnav a").forEach((link) => {
      if (link.dataset.view === view) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    moveIndicator();
    if (current !== null) {
      window.scrollTo({ top: 0 });
      document.getElementById("main").focus({ preventScroll: true });
    }
    current = view;
    document.title = `${(document.querySelector(`.viewnav a[data-view="${view}"] .nav-full`) || document.querySelector(`.viewnav a[data-view="${view}"]`)).textContent} | Anto Abousefian`;
  }

  await start(view);
  if (view === "map" && a) selectRegion(a);
  if (view === "reports") openReport(a, b);
  if (view === "profile" && a) showProfileSection(a);
}

function moveIndicator() {
  const nav = document.querySelector(".viewnav");
  const active = nav.querySelector('[aria-current="page"]');
  const bar = nav.querySelector(".viewnav-indicator");
  if (!active) return;
  bar.style.width = `${active.offsetWidth}px`;
  bar.style.transform = `translateX(${active.offsetLeft}px)`;
}

/* ---------- local clock in the status bar (real time, Montréal) ---------- */
function tick() {
  const t = new Date().toLocaleTimeString("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  document.getElementById("clock").textContent = `Local time ${t} ET`;
}

/* ---------- quick-jump command bar ---------- */
async function initCommand() {
  const dialog = document.getElementById("command");
  const input = document.getElementById("command-input");
  const list = document.getElementById("command-list");
  const geo = await load("geo");

  const items = [
    { label: "Overview", hint: "Section", href: "#overview" },
    { label: "Research map", hint: "Section", href: "#map" },
    { label: "Reports", hint: "Section", href: "#reports" },
    { label: "Profile", hint: "Section", href: "#profile" },
    { label: "Experience", hint: "Section", href: "#experience" },
    { label: "Skills", hint: "Section", href: "#skills" },
    { label: "Why defence", hint: "Profile section", href: "#profile/why-defence" },
    { label: "Forecasting fatalities on the Russia–Ukraine fronts", hint: "Report", href: "#reports/forecast" },
    { label: "Kursk: actual vs forecast", hint: "Report chart", href: "#reports/forecast/findings" },
    { label: "Are drones deadlier than artillery?", hint: "Report", href: "#reports/drones" },
    { label: "Robustness tests", hint: "Report section", href: "#reports/drones/robustness" },
    { label: "How to KudosMaxx: what drives engagement on Strava?", hint: "Report", href: "#reports/kudos" },
    ...geo.regions.map((r) => ({ label: r.id, hint: `Region, ${r.country}`, href: `#map/${r.id}` })),
    { label: "My Strava dashboard", hint: "Link", href: "https://strava-dashboard-lovat-one.vercel.app/kudos" },
    { label: "Code on GitHub", hint: "Link", href: "https://github.com/AntoA301/ukraine-fronts-forecasting" },
  ];
  let shown = items;
  let index = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = items.filter((i) => !q || `${i.label} ${i.hint}`.toLowerCase().includes(q));
    index = Math.min(index, Math.max(shown.length - 1, 0));
    list.replaceChildren(
      ...shown.map((item, i) =>
        h(
          "li",
          {
            role: "option",
            id: `cmd-${i}`,
            "aria-selected": String(i === index),
            onclick: () => go(item),
            onpointermove: () => {
              index = i;
              mark();
            },
          },
          [item.label, h("span", { text: item.hint })],
        ),
      ),
    );
    if (!shown.length) list.append(h("li", { "aria-disabled": "true" }, ["No match", h("span", { text: "" })]));
    input.setAttribute("aria-activedescendant", shown.length ? `cmd-${index}` : "");
  };
  const mark = () => {
    list.querySelectorAll("[role=option]").forEach((li, i) => li.setAttribute("aria-selected", String(i === index)));
    input.setAttribute("aria-activedescendant", `cmd-${index}`);
    list.querySelector(`#cmd-${index}`)?.scrollIntoView({ block: "nearest" });
  };
  const go = (item) => {
    dialog.close();
    if (item.href.startsWith("http")) window.open(item.href, "_blank", "noopener");
    else location.hash = item.href;
  };
  const open = () => {
    if (dialog.open) return;
    input.value = "";
    index = 0;
    render();
    dialog.showModal();
    input.focus();
  };

  input.addEventListener("input", () => {
    index = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      index = (index + 1) % Math.max(shown.length, 1);
      mark();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      index = (index - 1 + shown.length) % Math.max(shown.length, 1);
      mark();
      e.preventDefault();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[index]) go(shown[index]);
    }
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  document.querySelectorAll("[data-open-command]").forEach((b) => b.addEventListener("click", open));
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      open();
    }
  });
}

/* ---------- boot ---------- */
window.addEventListener("hashchange", route);
window.addEventListener("resize", moveIndicator);
document.fonts?.ready.then(moveIndicator);
tick();
setInterval(tick, 30_000);
route();
initCommand();
