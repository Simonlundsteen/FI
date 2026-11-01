/* Shared helpers: currency handling, formatting, storage and a small chart. */
const FI = (() => {
  const CURRENCIES = {
    DKK: { locale: 'da-DK', name: 'Danish krone', scale: 1 },
    SEK: { locale: 'sv-SE', name: 'Swedish krona', scale: 1 },
    NOK: { locale: 'nb-NO', name: 'Norwegian krone', scale: 1 },
    EUR: { locale: 'de-DE', name: 'Euro', scale: 0.1 },
    USD: { locale: 'en-US', name: 'US dollar', scale: 0.1 },
    GBP: { locale: 'en-GB', name: 'British pound', scale: 0.1 },
    CHF: { locale: 'de-CH', name: 'Swiss franc', scale: 0.1 },
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
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable (private mode etc.) */
      }
    },
  };

  function getCurrency() {
    const c = store.get(CURRENCY_KEY, 'DKK');
    return CURRENCIES[c] ? c : 'DKK';
  }

  function setCurrency(code) {
    if (!CURRENCIES[code]) return;
    store.set(CURRENCY_KEY, code);
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
        opt.textContent = `${code} – ${info.name}`;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => setCurrency(sel.value));
    });
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

      const pad = { l: 64, r: 16, t: 16, b: 28 };
      const xs = all.map((p) => p.x);
      const ys = all.map((p) => p.y).concat((opts.hLines || []).map((l) => l.y));
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(0, ...ys);
      const yMax = Math.max(...ys) * 1.05 || 1;
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

  return { store, getCurrency, setCurrency, currencyInfo, fmt, fmtCompact, fmtNumber, fmtPct, num, lineChart, toast };
})();
