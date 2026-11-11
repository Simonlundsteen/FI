/* Shared helpers: currency handling, formatting, storage and a small chart. */
const FI = (() => {
  const CURRENCIES = {
    // scale: how milestone amounts (defined in dollars) are sized in each currency
    USD: { locale: 'en-US', name: 'US dollar', scale: 1 },
    CAD: { locale: 'en-CA', name: 'Canadian dollar', scale: 1 },
    EUR: { locale: 'de-DE', name: 'Euro', scale: 1 },
    GBP: { locale: 'en-GB', name: 'British pound', scale: 1 },
    CHF: { locale: 'de-CH', name: 'Swiss franc', scale: 1 },
    DKK: { locale: 'da-DK', name: 'Danish krone', scale: 10 },
    SEK: { locale: 'sv-SE', name: 'Swedish krona', scale: 10 },
    NOK: { locale: 'nb-NO', name: 'Norwegian krone', scale: 10 },
  };
  const CURRENCY_KEY = 'fi.currency';

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value, { silent = false } = {}) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable (private mode etc.) */
      }
      // lets the account sync know something changed
      if (!silent) document.dispatchEvent(new CustomEvent('fi:storechange', { detail: key }));
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };

  /* ---------- Shared finance math (used by calculators and dashboard) ---------- */
  const math = {
    /* Milestones in dollars (scaled by currency). Close together early, further apart later:
       $1k, $2.5k, $5k, $7.5k, $10k → every $5k to $100k → every $25k to $200k → every $50k to $500k → every $100k to $1M */
    BASE_LADDER: (() => {
      const out = [1e3, 2.5e3, 5e3, 7.5e3, 10e3];
      for (let v = 15e3; v <= 100e3; v += 5e3) out.push(v);
      for (let v = 125e3; v <= 200e3; v += 25e3) out.push(v);
      for (let v = 250e3; v <= 500e3; v += 50e3) out.push(v);
      for (let v = 600e3; v <= 1e6; v += 100e3) out.push(v);
      return out;
    })(),

    // Suggested labels for the base amounts (yearly cost = 4%: $1,000 → $40 a year).
    DEFAULT_LABELS: {
      1e3: 'A movie night for two',
      2.5e3: 'A nice dinner out',
      5e3: 'Streaming subscriptions for a year',
      7.5e3: 'Concert tickets for two',
      10e3: 'A gym membership for a year',
      15e3: 'A weekend getaway',
      20e3: 'Home internet for a year',
      25e3: 'Holiday and birthday gifts',
      50e3: 'A summer vacation',
      100e3: 'Groceries for one person for a year',
    },

    milestoneLabel(labels, i) {
      return labels && Object.prototype.hasOwnProperty.call(labels, i)
        ? labels[i]
        : math.DEFAULT_LABELS[math.BASE_LADDER[i]] || '';
    },

    monthlyRate: (annualPct) => Math.pow(1 + annualPct / 100, 1 / 12) - 1,

    /** Simulate monthly investing until target is reached. Returns months, or Infinity. */
    monthsToTarget(start, monthly, annualReturnPct, target, maxYears = 100) {
      const r = math.monthlyRate(annualReturnPct);
      let v = start;
      if (v >= target) return 0;
      for (let m = 1; m <= maxYears * 12; m++) {
        v = v * (1 + r) + monthly;
        if (v >= target) return m;
      }
      return Infinity;
    },

    formatDuration(months) {
      if (!Number.isFinite(months)) return '100+ years';
      if (months <= 0) return 'Already there 🎉';
      const y = Math.floor(months / 12);
      const m = months % 12;
      const parts = [];
      if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`);
      if (m) parts.push(`${m} month${m === 1 ? '' : 's'}`);
      return parts.join(' ');
    },
  };

  // Before the site defaulted to US dollars it defaulted to kroner. Anyone who saved
  // tracker data back then without picking a currency keeps kroner, so their numbers
  // aren't suddenly shown as dollars.
  // New visitors get US dollars saved right away, so this check only ever catches
  // data from before the switch.
  if (store.get(CURRENCY_KEY, null) === null) {
    store.set(CURRENCY_KEY, store.get('fi.tracker', null) !== null ? 'DKK' : 'USD', { silent: true });
  }

  function getCurrency() {
    const c = store.get(CURRENCY_KEY, 'USD');
    return CURRENCIES[c] ? c : 'USD';
  }

  function setCurrency(code, { silent = false } = {}) {
    if (!CURRENCIES[code]) return;
    store.set(CURRENCY_KEY, code, { silent });
    updateCurrencyLabels();
    document.dispatchEvent(new CustomEvent('currencychange', { detail: code }));
  }

  function currencyInfo(code = getCurrency()) {
    return { code, ...CURRENCIES[code] };
  }

  function fmt(value, decimals = 0) {
    if (!Number.isFinite(value)) return '–';
    const code = getCurrency();
    return new Intl.NumberFormat(CURRENCIES[code].locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  function fmtCompact(value) {
    if (!Number.isFinite(value)) return '–';
    const code = getCurrency();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  function fmtNumber(value, decimals = 0) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  function fmtPct(value, decimals = 1) {
    if (!Number.isFinite(value)) return '–';
    return `${fmtNumber(value * 100, decimals)}%`;
  }

  function num(input) {
    const el = typeof input === 'string' ? document.getElementById(input) : input;
    const v = parseFloat(String(el.value).replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
  }

  function updateCurrencyLabels() {
    const code = getCurrency();
    document.querySelectorAll('[data-currency-code]').forEach((el) => {
      el.textContent = code;
    });
    document.querySelectorAll('[data-currency-select]').forEach((sel) => {
      sel.value = code;
    });
  }

  function initCurrencySelects() {
    document.querySelectorAll('[data-currency-select]').forEach((sel) => {
      sel.innerHTML = '';
      Object.entries(CURRENCIES).forEach(([code, info]) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.dataset.long = `${code} – ${info.name}`;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => setCurrency(sel.value));
    });
    // Short labels ("USD") on phones, long ("USD – US dollar") elsewhere
    const narrow = window.matchMedia('(max-width: 600px)');
    const label = () =>
      document.querySelectorAll('[data-currency-select] option').forEach((o) => {
        o.textContent = narrow.matches ? o.value : o.dataset.long;
      });
    label();
    narrow.addEventListener('change', label);
    updateCurrencyLabels();
  }

  /* ---------- Minimal responsive line chart on <canvas> ---------- */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /**
   * series: [{ label, color, points: [{x, y}], fill?: bool }]
   * opts: { xLabel: (x) => string, hLines: [{ y, label, color }] }
   */
  function lineChart(canvas, series, opts = {}) {
    const state = { series, opts, hoverIdx: null };
    canvas._chart = state;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return; // hidden: nothing to draw
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const all = state.series.flatMap((s) => s.points);
      if (all.length < 2) {
        ctx.fillStyle = cssVar('--muted');
        ctx.font = '14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(opts.emptyText || 'Not enough data yet', w / 2, h / 2);
        return;
      }

      const xs = all.map((p) => p.x);
      const ys = all.map((p) => p.y).concat((opts.hLines || []).map((l) => l.y));
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(0, ...ys);
      const yMax = Math.max(...ys) * 1.05 || 1;
      // left padding fits the widest y-axis label
      ctx.font = '11px system-ui, sans-serif';
      let labelW = 0;
      for (let i = 0; i <= 4; i++) labelW = Math.max(labelW, ctx.measureText(fmtCompact(yMin + ((yMax - yMin) * i) / 4)).width);
      const pad = { l: Math.ceil(labelW) + 14, r: 16, t: 16, b: 28 };
      const X = (x) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * (w - pad.l - pad.r);
      const Y = (y) => h - pad.b - ((y - yMin) / (yMax - yMin || 1)) * (h - pad.t - pad.b);

      // grid + y labels
      ctx.font = '11px system-ui, sans-serif';
      ctx.strokeStyle = cssVar('--grid');
      ctx.fillStyle = cssVar('--muted');
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const v = yMin + ((yMax - yMin) * i) / 4;
        const y = Y(v);
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w - pad.r, y);
        ctx.stroke();
        ctx.fillText(fmtCompact(v), pad.l - 8, y);
      }

      // x labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const xLabel = opts.xLabel || ((x) => String(Math.round(x)));
      const ticks = Math.min(6, all.length);
      for (let i = 0; i < ticks; i++) {
        const x = xMin + ((xMax - xMin) * i) / (ticks - 1 || 1);
        ctx.textAlign = ticks > 1 && i === ticks - 1 ? 'right' : i === 0 ? 'left' : 'center';
        ctx.fillText(xLabel(x), X(x), h - pad.b + 8);
      }

      // horizontal reference lines
      (opts.hLines || []).forEach((line) => {
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = line.color || cssVar('--warn');
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(line.y));
        ctx.lineTo(w - pad.r, Y(line.y));
        ctx.stroke();
        ctx.restore();
        if (line.label) {
          ctx.fillStyle = line.color || cssVar('--warn');
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(line.label, pad.l + 6, Y(line.y) - 4);
        }
      });

      // series
      state.series.forEach((s) => {
        if (!s.points.length) return;
        const color = s.color || cssVar('--accent');
        if (s.fill) {
          ctx.beginPath();
          ctx.moveTo(X(s.points[0].x), Y(0));
          s.points.forEach((p) => ctx.lineTo(X(p.x), Y(p.y)));
          ctx.lineTo(X(s.points[s.points.length - 1].x), Y(0));
          ctx.closePath();
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        s.points.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        if (s.dots) {
          ctx.fillStyle = color;
          s.points.forEach((p) => {
            ctx.beginPath();
            ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });

      // hover tooltip
      const base = state.series[0].points;
      if (state.hoverIdx !== null && base[state.hoverIdx]) {
        const p = base[state.hoverIdx];
        const hx = X(p.x);
        ctx.strokeStyle = cssVar('--muted');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx, pad.t);
        ctx.lineTo(hx, h - pad.b);
        ctx.stroke();

        const lines = [xLabel(p.x)].concat(
          state.series
            .filter((s) => s.points[state.hoverIdx])
            .map((s) => `${s.label}: ${fmt(s.points[state.hoverIdx].y)}`)
        );
        ctx.font = '12px system-ui, sans-serif';
        const boxW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
        const boxH = lines.length * 17 + 10;
        let bx = hx + 10;
        if (bx + boxW > w - pad.r) bx = hx - boxW - 10;
        const by = pad.t + 4;
        ctx.fillStyle = cssVar('--surface');
        ctx.strokeStyle = cssVar('--border');
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((l, i) => {
          ctx.fillStyle = i === 0 ? cssVar('--muted') : cssVar('--text');
          ctx.fillText(l, bx + 8, by + 6 + i * 17);
        });
      }

      state.geom = { X, pad, w };
    }

    if (!canvas._chartBound) {
      canvas._chartBound = true;
      canvas.addEventListener('mousemove', (e) => {
        const st = canvas._chart;
        if (!st.geom) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const pts = st.series[0].points;
        let best = null;
        let bestD = Infinity;
        pts.forEach((p, i) => {
          const d = Math.abs(st.geom.X(p.x) - mx);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best === st.hoverIdx) return; // nothing changed, skip redraw
        st.hoverIdx = best;
        canvas._draw();
      });
      canvas.addEventListener('mouseleave', () => {
        canvas._chart.hoverIdx = null;
        canvas._draw();
      });
      let resizeFrame = null;
      window.addEventListener('resize', () => {
        if (resizeFrame) return;
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          if (canvas.clientWidth) canvas._draw();
        });
      });
    }
    canvas._draw = draw;
    draw();
  }

  function toast(message) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 4000);
  }

  document.addEventListener('DOMContentLoaded', initCurrencySelects);

  return { store, math, getCurrency, setCurrency, currencyInfo, fmt, fmtCompact, fmtNumber, fmtPct, num, lineChart, toast };
})();
