// The two research reports, each with tabbed sections and interactive charts.
// Every number comes from data/projects.json, which copies the notebook outputs.
import { h, s, fmt } from "./util.js";
import { figure, toggle, hbars, lineCompare, vbars } from "./charts.js";

const REPO = "https://github.com/AntoA301/ukraine-fronts-forecasting/tree/main";
const SRC = "Source: my notebook outputs on ACLED data, Aug 2023 – Sep 2025 (historical).";
const C = { sage: "#8fa67a", sageDim: "#5d6f50", amber: "#d69e3a", text: "#d9ded4", soft: "#939c8f" };

let built = null;

export function initReports(host, data) {
  const reports = [forecastReport(data), dronesReport(data)];
  const index = h("ul", { class: "report-index", "aria-label": "Reports" });
  const stage = h("div");

  for (const r of reports) {
    index.append(
      h("li", {}, [
        h("button", { type: "button", "data-id": r.id, "aria-pressed": "false", onclick: () => (location.hash = `#reports/${r.id}`) }, [
          h("strong", { text: r.title }),
          h("span", { text: r.method }),
        ]),
      ]),
    );
  }
  index.append(h("li", { class: "pending", text: "Next report in preparation: Strava kudos analysis (MGSC 661)." }));
  host.replaceChildren(index, stage);
  built = { reports, index, stage, open: null };
}

export function openReport(id, tab) {
  if (!built) return;
  const r = built.reports.find((x) => x.id === id) || built.reports[0];
  built.index.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === r.id)));
  if (built.open !== r.id) {
    built.stage.replaceChildren(r.el);
    built.open = r.id;
  }
  r.select(tab && r.tabs.includes(tab) ? tab : r.current || r.tabs[0], Boolean(tab));
}

/* ------------------------------------------------------------------
   Shared report frame with tabs
   ------------------------------------------------------------------ */
function frame({ id, title, method, question, tools, repoPath, sections }) {
  const tabs = Object.keys(sections);
  const tablist = h("div", { class: "tabs", role: "tablist", "aria-label": `${title} sections` });
  const panels = {};
  const buttons = {};
  const api = { id, title, method, tabs, current: null };

  for (const key of tabs) {
    const sec = sections[key];
    buttons[key] = h(
      "button",
      {
        type: "button",
        role: "tab",
        id: `tab-${id}-${key}`,
        "aria-controls": `panel-${id}-${key}`,
        "aria-selected": "false",
        tabindex: "-1",
        onclick: () => (location.hash = `#reports/${id}/${key}`),
        onkeydown: (e) => {
          const i = tabs.indexOf(key);
          const next = e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
          if (next) {
            location.hash = `#reports/${id}/${next}`;
            buttons[next].focus();
          }
        },
      },
      sec.label,
    );
    tablist.append(buttons[key]);
    panels[key] = h("div", { class: "tabpanel", role: "tabpanel", id: `panel-${id}-${key}`, "aria-labelledby": `tab-${id}-${key}`, hidden: true });
  }

  const built = new Set();
  api.select = (key, fromLink) => {
    api.current = key;
    for (const k of tabs) {
      const on = k === key;
      buttons[k].setAttribute("aria-selected", String(on));
      buttons[k].setAttribute("tabindex", on ? "0" : "-1");
      panels[k].hidden = !on;
    }
    if (!built.has(key)) {
      panels[key].append(...[].concat(sections[key].render()));
      built.add(key);
    }
    if (fromLink) api.el.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  api.el = h("article", { class: "panel report", "aria-labelledby": `title-${id}` }, [
    h("header", { class: "report-head" }, [
      h("div", { class: "report-meta" }, [
        h("span", { text: "INSY 674, McGill MMA, 2026" }),
        h("span", { text: method }),
        h("a", { class: "textlink", href: `${REPO}/${repoPath}`, target: "_blank", rel: "noopener", text: "Notebook and code on GitHub" }),
      ]),
      h("h3", { id: `title-${id}`, text: title }),
      h("p", { class: "report-question", text: question }),
      h("ul", { class: "tools", "aria-label": "Tools" }, tools.map((t) => h("li", { text: t }))),
    ]),
    tablist,
    ...Object.values(panels),
  ]);
  return api;
}

const stat = (value, label, tone = "") => h("div", { class: "stat" }, [h("span", { class: `readout ${tone}`, text: value }), h("span", { text: label })]);
const p = (text) => h("p", { text });
const explain = (summary, paras) => h("details", { class: "explain" }, [h("summary", { text: summary }), h("div", {}, paras.map(p))]);

/* ------------------------------------------------------------------
   REPORT 1: fatality forecast
   ------------------------------------------------------------------ */
function forecastReport(data) {
  const f = data.forecast;
  const ds = data.dataset;
  const test = f.results.find((r) => r.label.includes("test") && r.label.includes("Random"));
  const naive = f.results.find((r) => r.label.includes("Naive"));
  const gain = 1 - test.rmse / naive.rmse;

  return frame({
    id: "forecast",
    title: "Forecasting fatalities on the Russia–Ukraine fronts",
    method: "Random Forest regression with time-series cross-validation",
    question:
      "Can a model trained on past conflict activity forecast deaths on a front that opens suddenly, like the August 2024 Ukrainian incursion into Kursk, as well as on long-running fronts like Donetsk and Kherson?",
    tools: ["Python", "scikit-learn", "pandas", "GeoPandas"],
    repoPath: "assignment-1-fatality-forecast",
    sections: {
      brief: {
        label: "Brief",
        render: () => [
          h("div", { class: "finding" }, [
            p("No. A model trained on past event data cannot anticipate a sudden offensive, but it is a useful short-term guide on active fronts."),
            p("It tracks steady fronts like Zaporizhia, Kherson and Donetsk well, and reacts late to sudden change in either direction."),
          ]),
          h("div", { class: "stat-row" }, [
            stat(fmt.int(ds.events), "ACLED events for Ukraine and Russia, 31 columns"),
            stat("11", "front-line regions: 8 Ukrainian oblasts plus Kursk, Belgorod and Bryansk"),
            stat(`${fmt.num(test.rmse)} vs ${fmt.num(naive.rmse)}`, `test RMSE, forest vs naive baseline: ${Math.round(gain * 100)}% lower`, "amber"),
            stat("3 vs 136", "Kursk, first week of the incursion: forecast vs actual deaths", "amber"),
          ]),
          h("div", { class: "prose" }, [
            p("I adapted the end-to-end workflow from chapter 2 of Aurélien Géron's Hands-On Machine Learning to a regression problem on conflict data. Each row is one region-week, and the model predicts next week's total deaths in that region."),
            p("The forest beats a naive \"next week = this week\" forecast mostly by cutting the large misses. It behaves like a smoothed persistence forecast, which is why it lags behind sudden escalations and de-escalations."),
          ]),
          h("p", { class: "chart-source" }, [
            "Explore each region's error on the ",
            h("a", { class: "textlink", href: "#map/Kursk", text: "research map" }),
            ".",
          ]),
        ],
      },

      method: {
        label: "Method",
        render: () => {
          const corr = figure({
            title: "What moves with next week's deaths",
            note: "Correlation of each feature with the target, training data. Past deaths dominate, which is why the model leans on persistence.",
            source: SRC,
            body: hbars(
              f.correlations.map((c) => ({
                label: c.feature,
                value: c.r,
                color: c.r > 0.8 ? C.amber : C.sageDim,
                tip: `<strong>${c.feature}</strong><div class="t-row">Correlation <b>${c.r.toFixed(2)}</b></div>`,
              })),
              { domain: [-0.2, 1], format: (v) => v.toFixed(1), valueFormat: (v) => v.toFixed(2), labelWidth: 210, rowH: 26 },
            ),
          });
          const meanCv = f.cvFolds.reduce((a, b) => a + b.rmse, 0) / f.cvFolds.length;
          const cv = figure({
            title: "Time-series cross-validation",
            note: `RMSE on five validation windows, each trained only on earlier weeks. Mean ${fmt.num(meanCv)}. The spring 2024 window, when Kharkiv flared up, was hardest.`,
            source: SRC,
            body: hbars(
              f.cvFolds.map((c) => ({
                label: c.weeks,
                value: c.rmse,
                color: c.rmse > 200 ? C.amber : C.sageDim,
                tip: `<strong>${c.weeks}</strong><div class="t-row">RMSE <b>${fmt.num(c.rmse)}</b></div>`,
              })),
              { domain: [0, 240], format: (v) => fmt.num(v, 0), valueFormat: (v) => fmt.num(v, 1), labelWidth: 170, rowH: 28 },
            ),
          });
          return [
            h("ol", { class: "pipeline" }, [
              h("li", {}, [h("strong", { text: "Filter" }), `${fmt.int(ds.frontlineEventsKept)} events in 11 front-line regions, ${Math.round(ds.fatalitiesKeptShare * 1000) / 10}% of all deaths`]),
              h("li", {}, [h("strong", { text: "Aggregate" }), `Sum to region-weeks, because ${Math.round(ds.zeroFatalityShare * 100)}% of single events report zero deaths`]),
              h("li", {}, [h("strong", { text: "Engineer" }), "Activity counts, 1, 2 and 4-week lags, 4-week rolling means, region, all log-transformed"]),
              h("li", {}, [h("strong", { text: "Split by time" }), `Train ${f.train.rows} rows to Apr 2025, test ${f.test.rows} rows Apr – Sep 2025`]),
              h("li", {}, [h("strong", { text: "Model" }), "Random Forest in a scikit-learn pipeline, tested against a naive baseline"]),
            ]),
            explain("Why split by time instead of randomly?", [
              "A random split would let the model learn from weeks that come after the ones it is tested on, which makes results look better than they would be in real use.",
              "Training on the earliest 80% of weeks and testing on the most recent 20% means the model never sees the future, like a forecaster working week to week.",
            ]),
            corr,
            cv,
          ];
        },
      },

      findings: {
        label: "Findings",
        render: () => {
          // results
          const resHost = h("div");
          const drawRes = (metric) => {
            const rows = f.results.filter((r) => r[metric] !== null);
            resHost.replaceChildren(
              hbars(
                rows.map((r) => ({
                  label: r.label,
                  value: r[metric],
                  color: r.label.startsWith("Naive") ? C.soft : r.label.includes("test") ? C.amber : C.sageDim,
                  tip: `<strong>${r.label}</strong><div class="t-row">RMSE <b>${fmt.num(r.rmse)}</b></div>${r.mae !== null ? `<div class="t-row">MAE <b>${fmt.num(r.mae)}</b></div>` : ""}`,
                })),
                { domain: [0, metric === "rmse" ? 140 : 40], format: (v) => fmt.num(v, 0), valueFormat: (v) => fmt.num(v, 1), labelWidth: 270 },
              ),
            );
          };
          drawRes("rmse");
          const results = figure({
            title: "Model vs naive baseline",
            note: "Error in deaths per region-week. Lower is better. The forest beats the baseline on the test set.",
            controls: toggle([{ key: "rmse", label: "RMSE" }, { key: "mae", label: "MAE" }], "rmse", drawRes, "Error metric"),
            source: SRC,
            body: resHost,
          });

          // Kursk onset
          const kursk = figure({
            title: "Kursk: actual vs forecast deaths, first nine weeks of the incursion",
            note: "Out-of-sample forecasts. The model missed the first week, caught up a week later, then stayed about one step behind.",
            controls: h("div", { class: "key" }, [
              h("span", {}, [h("i", { style: `background:${C.text}` }), "Actual"]),
              h("span", {}, [h("i", { class: "dash" }), "Forecast"]),
            ]),
            source: SRC,
            body: lineCompare(
              f.kurskOnset.map((w) => ({
                key: `Week of ${fmt.week(w.week)}`,
                label: new Date(w.week + "T00:00:00").toLocaleDateString("en-CA", { day: "numeric", month: "short" }),
                a: w.actual,
                b: w.forecast,
              })),
              { format: (v) => fmt.int(v), annotate: { index: 0, text: "Forecast 3, actual 136" } },
            ),
          });

          // Kursk monthly context
          const monthLabel = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
          const monthlyHost = h("div");
          const drawMonthly = (metric) => {
            const idx = metric === "deaths" ? 2 : 1;
            monthlyHost.replaceChildren(
              vbars(
                f.kurskMonthly.map(([ym, ev, de]) => ({
                  key: ym,
                  label: monthLabel(ym),
                  value: idx === 2 ? de : ev,
                  color: ym >= "2024-08" && ym <= "2025-03" ? C.amber : C.sageDim,
                  tip: `<strong>${new Date(ym + "-01T00:00:00").toLocaleDateString("en-CA", { month: "long", year: "numeric" })}</strong><div class="t-row">Events <b>${fmt.int(ev)}</b></div><div class="t-row">Deaths <b>${fmt.int(de)}</b></div>`,
                })),
                { format: (v) => fmt.int(v), labelEvery: 3, marker: { index: 12, text: "6 Aug 2024" } },
              ),
            );
          };
          drawMonthly("deaths");
          const monthly = figure({
            title: "Kursk by month: a quiet border region, then a new front",
            note: "Before August 2024 Kursk averaged a handful of deaths a month, so nothing in its history pointed to what came next.",
            controls: toggle([{ key: "deaths", label: "Deaths" }, { key: "events", label: "Events" }], "deaths", drawMonthly, "Kursk monthly measure"),
            source: SRC,
            body: monthlyHost,
          });

          // region errors
          const regHost = h("div");
          const drawReg = (key) => {
            const rows = Object.entries(f.regionErrors)
              .map(([id, e]) => ({ id, ...e }))
              .sort((a, b) => b[key] - a[key]);
            regHost.replaceChildren(
              hbars(
                rows.map((r) => ({
                  label: r.id,
                  value: r[key],
                  color: key === "maePct" && r.maePct >= 100 ? C.amber : C.sageDim,
                  tip: `<strong>${r.id}</strong>
                    <div class="t-row">Avg weekly deaths <b>${fmt.num(r.meanActual)}</b></div>
                    <div class="t-row">MAE <b>${fmt.num(r.mae)}</b></div>
                    <div class="t-row">RMSE <b>${fmt.num(r.rmse)}</b></div>
                    <div class="t-row">MAE as % of avg <b>${fmt.num(r.maePct, 0)}%</b></div>
                    <div class="t-row">Select to open on the map</div>`,
                  onclick: () => (location.hash = `#map/${r.id}`),
                })),
                {
                  domain: key === "maePct" ? [0, 160] : [0, 220],
                  format: (v) => (key === "maePct" ? `${fmt.num(v, 0)}%` : fmt.num(v, 0)),
                  valueFormat: (v) => (key === "maePct" ? `${fmt.num(v, 1)}%` : fmt.num(v, 1)),
                  labelWidth: 130,
                  rowH: 26,
                },
              ),
            );
          };
          drawReg("maePct");
          const regions = figure({
            title: "Forecast error by region",
            note: `${f.regionErrorsNote} Relative error is highest in quiet regions, where a miss of one or two deaths is a large share. Select a row to see it on the map.`,
            controls: toggle([{ key: "maePct", label: "Relative error" }, { key: "mae", label: "Error in deaths" }], "maePct", drawReg, "Region error measure"),
            source: SRC,
            body: regHost,
          });

          const img = h("figure", { class: "figure chart" }, [
            h("img", { src: "images/ukraine-fatality-forecast.png", alt: "Notebook chart of actual vs forecast weekly fatalities in Kursk", loading: "lazy" }),
            h("figcaption", { text: "Original notebook chart (Kursk, actual vs out-of-sample forecast). The full Kursk and Donetsk figure is in the notebook on GitHub." }),
          ]);

          return [results, kursk, monthly, regions, img];
        },
      },

      limitations: {
        label: "Limitations",
        render: () =>
          h("div", { class: "prose" }, [
            h("h4", { text: "What the model cannot do" }),
            h("ul", { class: "bullets" }, [
              h("li", { text: "It cannot anticipate a sudden offensive. Kharkiv in May 2024 and Sumy showed the same weakness as Kursk, so the problem is sudden change in general, not Kursk itself." }),
              h("li", { text: "After fighting in Kursk eased in November 2024, it kept over-forecasting for around six weeks, because it leans on recent deaths." }),
              h("li", { text: "Quiet regions have very high relative errors (Chernihiv, Bryansk, Belgorod above 100%), since a small miss is a large share of a small average." }),
            ]),
            h("h4", { text: "About the data" }),
            h("ul", { class: "bullets" }, [
              h("li", { text: "ACLED fatalities are conservative totals per event across all parties. They are not broken down by side." }),
              h("li", { text: "The raw ACLED export is not included in the repository. Anyone can reproduce it with a free ACLED account (Ukraine and Russia, 1 Aug 2023 to 19 Sep 2025)." }),
              h("li", { text: "This is coursework on historical data, not an operational forecasting system." }),
            ]),
          ]),
      },
    },
  });
}

/* ------------------------------------------------------------------
   REPORT 2: drones vs artillery (causal inference)
   ------------------------------------------------------------------ */
function dronesReport(data) {
  const c = data.causal;
  const lr = c.estimates.find((e) => e.method === "Linear regression");

  return frame({
    id: "drones",
    title: "Are drones deadlier than artillery?",
    method: "Causal inference with CausalML meta-learners and DoWhy",
    question:
      "Do air and drone strikes cause more deaths per strike than shelling, artillery and missile attacks on the Russia–Ukraine front, holding the front, the time period and the attacking side constant?",
    tools: ["Python", "CausalML", "DoWhy", "XGBoost", "pandas"],
    repoPath: "assignment-2-drones-vs-artillery",
    sections: {
      brief: {
        label: "Brief",
        render: () => {
          const rawHost = h("div");
          const drawRaw = (k) => {
            const rows = [
              { label: "Drone/air strikes", v: k === "mean" ? c.drone.meanDeaths : c.drone.shareZero, n: c.drone.events, color: C.sage },
              { label: "Shelling/artillery/missile", v: k === "mean" ? c.artillery.meanDeaths : c.artillery.shareZero, n: c.artillery.events, color: C.amber },
            ];
            rawHost.replaceChildren(
              hbars(
                rows.map((r) => ({
                  label: r.label,
                  value: r.v,
                  color: r.color,
                  tip: `<strong>${r.label}</strong><div class="t-row">Strikes <b>${fmt.int(r.n)}</b></div><div class="t-row">${k === "mean" ? "Deaths per strike" : "Strikes with no deaths"} <b>${k === "mean" ? r.v.toFixed(3) : fmt.pct(r.v, 1)}</b></div>`,
                })),
                { domain: k === "mean" ? [0, 0.4] : [0, 1], format: (v) => (k === "mean" ? v.toFixed(2) : fmt.pct(v)), valueFormat: (v) => (k === "mean" ? v.toFixed(3) : fmt.pct(v, 1)), labelWidth: 200, rowH: 40 },
              ),
            );
          };
          drawRaw("mean");
          return [
            h("div", { class: "finding" }, [
              p("Hypothesis supported: despite the narrative that drones have revolutionised the war, artillery is still the deadlier weapon per strike."),
              p(`Every method finds that drone/air strikes cause fewer deaths per strike, about 55% fewer than artillery's average of ${c.artillery.meanDeaths.toFixed(3)}.`),
            ]),
            h("div", { class: "stat-row" }, [
              stat(fmt.int(c.strikes), "strikes in 11 front-line regions"),
              stat(fmt.signed(lr.ate), `deaths per strike, drone vs artillery (95% CI ${lr.lo} to ${lr.hi})`, "sage"),
              stat("3 of 3", "robustness tests passed", "sage"),
              stat(`+${c.kursk.effects[1].est}`, "extra deaths per strike in Kursk after the incursion began", "amber"),
            ]),
            figure({
              title: "Before any adjustment",
              note: "Raw averages. Most strikes kill no one, and artillery strikes kill more on average. Causal inference checks whether this holds once confounders are controlled.",
              controls: toggle([{ key: "mean", label: "Deaths per strike" }, { key: "zero", label: "Strikes with no deaths" }], "mean", drawRaw, "Raw measure"),
              source: SRC,
              body: rawHost,
            }),
          ];
        },
      },

      method: {
        label: "Method",
        render: () => [
          explain("What is causal inference, in plain terms?", [
            "A raw comparison would mix the weapon's effect with where and when it was used. If drones were used more on quiet fronts, they would look less deadly even if they were not.",
            "Causal inference estimates what would have happened to the same kind of strike, on the same front, in the same month and by the same side, if the other weapon had been used. The difference is the weapon's effect.",
          ]),
          figure({
            title: "Causal graph",
            note: "Front, month and attacking side influence both which weapon is chosen and how deadly a strike is, so all three are controlled.",
            body: dag(),
          }),
          h("div", { class: "prose" }, [
            h("h4", { text: "Set-up" }),
            h("ul", { class: "bullets" }, [
              h("li", { text: "Treatment: drone/air strike (57,763). Control: shelling, artillery or missile attack (50,106)." }),
              h("li", { text: "Outcome: fatalities per strike." }),
              h("li", { text: "Confounders: oblast, month, and attacking side (Russia vs Ukraine)." }),
              h("li", { text: "Left out on purpose: civilian targeting and exact coordinates, which partly depend on the weapon chosen, and the attacking unit, because ACLED codes almost every drone strike to an Air Force unit, so the unit nearly duplicates the treatment." }),
            ]),
            h("h4", { text: "Estimators" }),
            h("ul", { class: "bullets" }, [
              h("li", { text: "CausalML: S-learner (LRSRegressor) and T-learner (XGBTRegressor) for the average effect, per-strike effects by oblast, and feature importance." }),
              h("li", { text: "DoWhy: a causal graph, backdoor identification, linear regression, propensity score weighting and matching, and three refutation tests." }),
              h("li", { text: "A second treatment: whether a strike happened in Kursk or on another front, over the full period and after 6 Aug 2024, split by attacking side." }),
            ]),
          ]),
        ],
      },

      findings: {
        label: "Findings",
        render: () => {
          const est = figure({
            title: "Six estimates, one direction",
            note: "Effect of a drone/air strike instead of artillery on deaths per strike. Lines show 95% confidence intervals where the method reports one. Left of zero = fewer deaths.",
            source: SRC,
            controls: h("div", { class: "key" }, [
              h("span", {}, [h("i", { style: `background:${C.soft}` }), "Naive"]),
              h("span", {}, [h("i", { style: `background:${C.sage}` }), "CausalML"]),
              h("span", {}, [h("i", { style: `background:${C.amber}` }), "DoWhy"]),
            ]),
            body: hbars(
              c.estimates.map((e) => ({
                label: e.method,
                value: e.ate,
                lo: e.lo,
                hi: e.hi,
                color: e.family === "Baseline" ? C.soft : e.family === "CausalML" ? C.sage : C.amber,
                emphasis: e.family === "Baseline" ? "hollow" : null,
                tip: `<strong>${e.method}</strong><div class="t-row">Library <b>${e.family}</b></div><div class="t-row">Effect <b>${fmt.signed(e.ate)}</b></div>${e.lo !== null ? `<div class="t-row">95% CI <b>${e.lo} to ${e.hi}</b></div>` : ""}`,
              })),
              { domain: [-0.32, 0.02], format: (v) => fmt.signed(v, 2), valueFormat: (v) => fmt.signed(v, 3), labelWidth: 230, ci: true },
            ),
          });

          const obHost = h("div");
          const drawOb = (key) => {
            const rows = Object.entries(c.byOblast)
              .map(([id, o]) => ({ id, ...o }))
              .sort((a, b) => a[key] - b[key]);
            obHost.replaceChildren(
              hbars(
                rows.map((o) => ({
                  label: o.id,
                  value: o[key],
                  color: o[key] < 0 ? C.sage : C.amber,
                  tip: `<strong>${o.id}</strong>
                    <div class="t-row">Strikes <b>${fmt.int(o.strikes)}</b></div>
                    <div class="t-row">Drone/air share <b>${fmt.pct(o.droneShare)}</b></div>
                    <div class="t-row">Average effect <b>${fmt.signed(o.avgEffect)}</b></div>
                    <div class="t-row">Median effect <b>${fmt.signed(o.medianEffect)}</b></div>
                    <div class="t-row">Artillery deaths/strike <b>${o.artilleryAvg.toFixed(3)}</b></div>
                    <div class="t-row">Select to open on the map</div>`,
                  onclick: () => (location.hash = `#map/${o.id}`),
                })),
                { domain: [-0.7, 0.1], format: (v) => fmt.signed(v, 1), valueFormat: (v) => fmt.signed(v, 3), labelWidth: 130, rowH: 26 },
              ),
            );
          };
          drawOb("avgEffect");
          const oblast = figure({
            title: "Where the effect holds",
            note: `${c.byOblastNote} Consistently negative on the Kharkiv, Zaporizhia, Dnipropetrovsk and Kherson fronts, close to zero in the quiet border regions.`,
            controls: toggle([{ key: "avgEffect", label: "Average" }, { key: "medianEffect", label: "Median" }], "avgEffect", drawOb, "Per-oblast summary"),
            source: SRC,
            body: obHost,
          });

          const kursk = figure({
            title: "Second question: was Kursk deadlier?",
            note: "Extra deaths per strike in Kursk compared with similar strikes elsewhere. After the incursion began, Kursk was deadlier for both Russian and Ukrainian strikes.",
            source: SRC,
            body: hbars(
              c.kursk.effects.map((e) => ({
                label: e.label,
                value: e.est,
                lo: e.lo,
                hi: e.hi,
                color: e.label.startsWith("Full") ? C.soft : C.amber,
                tip: `<strong>${e.label}</strong><div class="t-row">Effect <b>${fmt.signed(e.est)}</b></div><div class="t-row">95% CI <b>${e.lo} to ${e.hi}</b></div>`,
              })),
              { domain: [0, 0.9], format: (v) => fmt.signed(v, 1), valueFormat: (v) => fmt.signed(v, 3), labelWidth: 260, ci: true },
            ),
          });

          return [
            h("div", { class: "finding" }, [
              p("The gap grew once oblast, month and attacking side were controlled for, because drones were used more where strikes tend to be deadlier."),
            ]),
            est,
            oblast,
            kursk,
          ];
        },
      },

      robustness: {
        label: "Robustness",
        render: () => {
          const x = (v) => 120 + ((v + 0.2) / 0.25) * 440;
          const rows = c.refutations.map((r) => {
            const svg = s("svg", { viewBox: "0 0 680 44", role: "img", "aria-label": `${r.test}: original ${r.original}, after test ${r.refuted}` });
            svg.append(s("line", { x1: x(0), x2: x(0), y1: 6, y2: 38, stroke: "#3b463e" }));
            svg.append(s("text", { class: "axis-label", x: x(0), y: 44, "text-anchor": "middle", fill: "#626b5f", "font-size": 11, text: "0" }));
            svg.append(s("line", { x1: x(r.original), x2: x(r.refuted), y1: 22, y2: 22, stroke: "#626b5f", "stroke-dasharray": "3 3" }));
            svg.append(s("circle", { cx: x(r.original), cy: 22, r: 7, fill: "none", stroke: C.sage, "stroke-width": 2 }));
            svg.append(s("rect", { x: x(r.refuted) - 5, y: 17, width: 10, height: 10, fill: C.amber }));
            return h("div", { class: "refute-row" }, [
              h("div", {}, [h("strong", { text: r.test }), h("span", { text: r.expect })]),
              svg,
              h("div", {}, [
                h("span", { class: "verdict", text: "Passed" }),
                h("span", { style: "display:block", text: `${fmt.signed(r.original, 3)} to ${fmt.signed(r.refuted, 3)}, p = ${r.p.toFixed(2)}` }),
              ]),
            ]);
          });
          return [
            h("div", { class: "finding" }, [p("The estimate passed all three DoWhy refutation tests. Shuffling the treatment labels (placebo) dropped the effect to about zero, as it should.")]),
            h("div", { class: "key", style: "margin-bottom:10px" }, [
              h("span", {}, [h("i", { style: `background:${C.sage}` }), "Original estimate"]),
              h("span", {}, [h("i", { style: `background:${C.amber}` }), "After the test"]),
            ]),
            h("div", { class: "refute" }, rows),
            explain("How a refutation test works", [
              "Each test changes the data in a way that should or should not move the answer. Adding a random fake confounder, or re-running on a random subset, should leave the effect where it is.",
              "Replacing the real treatment with a random placebo should make the effect vanish. If an estimate survives all three, it is less likely to be an artefact of the model.",
            ]),
          ];
        },
      },

      limitations: {
        label: "Limitations",
        render: () =>
          h("div", { class: "prose" }, [
            h("ul", { class: "bullets" }, [
              h("li", { text: "The estimate is only causal if oblast, month and attacking side are the main confounders. Target type (vehicles vs infantry positions) is not recorded by ACLED and partly depends on the weapon, so the result is the effect of the weapon together with how it is typically used." }),
              h("li", { text: "ACLED fatality counts are conservative, and reporting may differ across fronts and between sides." }),
              h("li", { text: "Most strikes kill no one, so a few mass-casualty events drive the averages." }),
              h("li", { text: "Location cannot be assigned like a weapon, so the Kursk result describes how deadly conditions were there, not the effect of an intervention." }),
              h("li", { text: "Per-oblast averages come from a model of individual strikes. Where few strikes were recorded, as in Bryansk, they are less reliable." }),
            ]),
          ]),
      },
    },
  });
}

/* Simple causal graph drawn in SVG. */
function dag() {
  const small = window.innerWidth < 600;
  const VW = small ? 360 : 720;
  const svg = s("svg", { class: "dag", viewBox: `0 0 ${VW} ${small ? 250 : 230}`, role: "img", "aria-label": "Causal graph: oblast, month and attacking side affect both weapon choice and fatalities; weapon affects fatalities." });
  svg.append(
    s("defs", {}, [
      s("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, [s("path", { d: "M0,0 L10,5 L0,10 z", fill: "#939c8f" })]),
      s("marker", { id: "arrow-amber", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, [s("path", { d: "M0,0 L10,5 L0,10 z", fill: "#d69e3a" })]),
    ]),
  );
  const node = (x, y, w, label, cls = "") => {
    const g = s("g", { class: `node ${cls}` });
    g.append(s("rect", { x: x - w / 2, y: y - 18, width: w, height: 36 }));
    g.append(s("text", { x, y: y + 4, "text-anchor": "middle", text: label }));
    svg.append(g);
  };
  const mid = VW / 2;
  const cw = small ? 108 : 150; // confounder node width
  const ow = small ? 160 : 190; // treatment / outcome node width
  const conf = small
    ? [[60, 40, "Oblast"], [180, 40, "Month"], [300, 40, "Attacker"]]
    : [[160, 40, "Oblast (front)"], [360, 40, "Month"], [560, 40, "Attacking side"]];
  const T = small ? [90, 150] : [200, 185];
  const Y = small ? [270, 215] : [520, 185];
  for (const [x, y] of conf) {
    svg.append(s("path", { class: "edge", d: `M${x},${y + 18} L${T[0] + (x - mid) * 0.25},${T[1] - 20}`, "marker-end": "url(#arrow)" }));
    svg.append(s("path", { class: "edge", d: `M${x},${y + 18} L${Y[0] + (x - mid) * 0.25},${Y[1] - 20}`, "marker-end": "url(#arrow)" }));
  }
  svg.append(
    s("path", {
      class: "edge main",
      d: small ? `M${T[0]},${T[1] + 18} L${T[0]},${Y[1]} L${Y[0] - ow / 2},${Y[1]}` : `M${T[0] + ow / 2},${T[1]} L${Y[0] - ow / 2},${Y[1]}`,
      "marker-end": "url(#arrow-amber)",
    }),
  );
  for (const [x, y, l] of conf) node(x, y, cw, l);
  node(T[0], T[1], ow, "Drone/air vs artillery", "treat");
  node(Y[0], Y[1], ow, "Deaths per strike", "outcome");
  return svg;
}
