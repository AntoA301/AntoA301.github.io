# antoa301.github.io

Portfolio of Anto Abousefian: defence analytics research, profile and experience.
Plain HTML, CSS and JavaScript modules, served by GitHub Pages from `main`. No build step, no dependencies.

## Structure

| Path | What it holds |
|---|---|
| `index.html` | Page shell. Profile, experience and skills text live here, so they are easy to edit. |
| `css/site.css` | All styles. Colours and type sizes are tokens at the top. |
| `js/main.js` | Routing between views (`#overview`, `#map/Kursk`, `#reports/drones/robustness` …), quick-jump bar, clock. |
| `js/radar.js`, `js/map.js` | Overview radar and the research map. |
| `js/reports.js`, `js/charts.js` | The two research reports and the small SVG chart library they use. |
| `js/skills.js`, `js/timeline.js`, `js/profile.js` | Skills map, experience timeline, profile section menu. |
| `data/projects.json` | Every figure shown in the reports, copied from the notebook outputs in [ukraine-fronts-forecasting](https://github.com/AntoA301/ukraine-fronts-forecasting). |
| `data/geo.json` | Simplified region borders from Natural Earth (public domain). |

## Editing

- **After any change:** bump the `?v=` version on the stylesheet and script links in `index.html` and on the imports in `js/*.js` (search and replace the old version). This makes browsers load the new files instead of a saved copy.

- **Add a job or activity:** copy an `<article class="xp">` block in `index.html`. Its `data-lane`, `data-start` and `data-end` place it on the timeline.
- **Add a report:** add a function in `js/reports.js` like `forecastReport`, put its numbers in `data/projects.json`, and list it in `initReports`.

All conflict data is historical ACLED data (Aug 2023 – Sep 2025). Nothing on the site is live intelligence.
