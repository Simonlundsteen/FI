# FI – Financial Independence

A static website about financial independence (FI), built with plain HTML, CSS and JavaScript. There's no build step and no dependencies.

## Pages

- **`index.html`: Overview & calculators.** A short introduction to FI and the 4% rule, plus five calculators:
  FI number, years to FI, savings rate, compound growth and Coast FI.
- **`tracker.html`: My tracker.** Enter your net worth and follow 38 milestones from 10,000 to 10,000,000.
  Each milestone shows the yearly cost it can pay for under the 4% rule (10,000 → 400 a year, for life),
  and you can write what each one pays for. You can also list your own costs and see which ones are covered,
  and keep a net worth history with a chart.

Milestones are close together early (10k, 25k, 50k, 75k, 100k), then every 50k up to 1M, every 250k up to 2M,
every 500k up to 5M and every 1M up to 10M. For EUR/USD/GBP/CHF the ladder is scaled by 1/10.

Currency (DKK, SEK, NOK, EUR, USD, GBP, CHF) can be picked on every page. All data is stored in the
browser's `localStorage`, and the tracker can export and import a JSON backup.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Structure

```
index.html         overview + calculators
tracker.html       personal 4% rule tracker
css/style.css      styles (light + dark mode)
js/common.js       currency, formatting, storage, canvas chart
js/calculators.js  calculator logic
js/tracker.js      tracker logic
```

For education only, not financial advice.
