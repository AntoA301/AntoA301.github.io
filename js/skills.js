// Skills map: each skill is linked only to the places I actually used it.
// There are no proficiency scores, on purpose.
import { h } from "./util.js?v=20261125-5";

const CONTEXTS = [
  { id: "butterfield", label: "Butterfield", href: "#experience" },
  { id: "bluewater", label: "Blue Water", href: "#experience" },
  { id: "enactus", label: "Enactus", href: "#experience" },
  { id: "forecast", label: "Forecast report", href: "#reports/forecast" },
  { id: "drones", label: "Drones report", href: "#reports/drones" },
  { id: "kudos", label: "KudosMaxx report", href: "#reports/kudos" },
  { id: "mma", label: "MMA coursework", href: "#experience" },
];

// [skill, contexts it was used in, what it looked like there]
const GROUPS = [
  {
    name: "Finance and risk",
    skills: [
      ["Fraud & risk analysis", ["butterfield"], "Investigated 2,400+ fraud cases and flagged suspicious dormant-account activity."],
      ["Reconciliation", ["butterfield", "bluewater", "enactus"], "Fraud cases and client records, 75 GL accounts a month, token sales across 30 restaurants."],
      ["Financial analysis", ["bluewater", "enactus"], "Month-end close, payables and receivables, token program finances."],
      ["Process improvement", ["bluewater", "enactus"], "Moved 75 vendors from cheques to EFT; reminders that kept every restaurant partner."],
    ],
  },
  {
    name: "Analytics methods",
    skills: [
      ["Predictive modelling", ["forecast", "kudos", "mma"], "Weekly fatality forecast; breakout-run classifier; regression and classification coursework."],
      ["Regression (OLS, Poisson, logistic)", ["kudos", "mma"], "Count models with rate ratios, robust errors and refits for the Strava study."],
      ["Machine learning", ["forecast", "drones", "mma"], "Random Forest, XGBoost T-learner, neural networks."],
      ["Causal inference", ["drones"], "Meta-learners, propensity scores and refutation tests."],
      ["Monte Carlo simulation", ["mma"], "Revenue management simulation in Excel."],
      ["Linear programming", ["mma"], "Optimization and sensitivity analysis with Excel Solver."],
      ["NLP", ["mma"], "Text analytics module cases."],
    ],
  },
  {
    name: "Tools",
    skills: [
      ["Python and pandas", ["forecast", "drones", "kudos", "mma"], "All three reports, end to end."],
      ["scikit-learn", ["forecast", "kudos", "mma"], "Pipelines, Random Forest, time-series cross-validation, train/test splits and ROC."],
      ["statsmodels", ["kudos"], "OLS, Poisson GLM and logistic models, diagnostics and autocorrelation tests."],
      ["CausalML, DoWhy, XGBoost", ["drones"], "Average and per-strike effects, causal graph, refutations."],
      ["GeoPandas", ["forecast", "drones"], "Maps of the front lines from Natural Earth borders."],
      ["PyTorch", ["mma"], "Neural network assignment (regression and MNIST)."],
      ["SQL", ["mma"], "Database design and querying coursework."],
      ["Excel (Solver)", ["enactus", "mma"], "Matching redemption logs; optimization models."],
      ["SAP", ["bluewater"], "General ledger reconciliation."],
      ["GitHub", ["forecast", "drones", "kudos", "mma"], "Public repositories for all three reports."],
    ],
  },
];

export function initSkills(host) {
  const wrap = h("div", { class: "skillmap" });
  const evidence = h("p", { class: "skill-evidence", "aria-live": "polite", text: "Select a skill to see where it was used." });
  const table = h("table", {}, []);
  const head = h("tr", {}, [h("th", { scope: "col" }, h("span", { class: "sr-only", text: "Skill" }))]);
  const colButtons = {};
  for (const c of CONTEXTS) {
    colButtons[c.id] = h("button", { type: "button", "aria-pressed": "false", onclick: () => traceColumn(c.id) }, c.label);
    head.append(h("th", { scope: "col" }, colButtons[c.id]));
  }
  table.append(h("thead", {}, head));

  const body = h("tbody");
  const rows = [];
  for (const g of GROUPS) {
    body.append(h("tr", { class: "group" }, [h("th", { colspan: CONTEXTS.length + 1, scope: "colgroup", text: g.name })]));
    for (const [skill, used, note] of g.skills) {
      const btn = h("button", { type: "button", "aria-pressed": "false", onclick: () => traceSkill(row) }, skill);
      const row = { skill, used, note, btn, tr: h("tr", {}, [h("th", { scope: "row" }, btn)]), cells: {} };
      for (const c of CONTEXTS) {
        const on = used.includes(c.id);
        const td = h("td", {}, [
          h("span", { class: `cell${on ? " on" : ""}`, "aria-hidden": "true" }),
          h("span", { class: "sr-only", text: on ? `Used at ${c.label}` : "" }),
        ]);
        row.cells[c.id] = td;
        row.tr.append(td);
      }
      rows.push(row);
      body.append(row.tr);
    }
  }
  table.append(body);
  wrap.append(table);
  host.replaceChildren(wrap, evidence);

  let active = null;
  const clear = () => {
    wrap.classList.remove("tracing");
    rows.forEach((r) => {
      r.tr.classList.remove("lit");
      r.btn.setAttribute("aria-pressed", "false");
      Object.values(r.cells).forEach((td) => td.classList.remove("lit"));
    });
    Object.values(colButtons).forEach((b) => b.setAttribute("aria-pressed", "false"));
  };

  function traceSkill(row) {
    const same = active === row.skill;
    clear();
    active = same ? null : row.skill;
    if (same) {
      evidence.textContent = "Select a skill to see where it was used.";
      return;
    }
    wrap.classList.add("tracing");
    row.tr.classList.add("lit");
    row.btn.setAttribute("aria-pressed", "true");
    const where = row.used.map((id) => CONTEXTS.find((c) => c.id === id).label).join(", ");
    evidence.replaceChildren(h("strong", { text: `${row.skill}: ` }), `${where}. ${row.note}`);
  }

  function traceColumn(id) {
    const same = active === `col:${id}`;
    clear();
    active = same ? null : `col:${id}`;
    if (same) {
      evidence.textContent = "Select a skill to see where it was used.";
      return;
    }
    const c = CONTEXTS.find((x) => x.id === id);
    wrap.classList.add("tracing");
    colButtons[id].setAttribute("aria-pressed", "true");
    const hits = rows.filter((r) => r.used.includes(id));
    hits.forEach((r) => {
      r.tr.classList.add("lit");
      r.cells[id].classList.add("lit");
    });
    evidence.replaceChildren(
      h("strong", { text: `${c.label}: ` }),
      `${hits.map((r) => r.skill).join(", ")}. `,
      h("a", { class: "textlink", href: c.href, text: c.href.startsWith("#reports") ? "Open the report" : "See the experience" }),
    );
  }
}
