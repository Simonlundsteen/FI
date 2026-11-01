/* Calculators on the overview page. */
(() => {
  const $ = (id) => document.getElementById(id);
  const { fmt, fmtPct, fmtNumber, num } = FI;

  const { monthlyRate, formatDuration, monthsToTarget } = FI.math;

  /* ---------- Tabs ---------- */
  function activateTab(id) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
    document.querySelectorAll('.calc').forEach((c) => c.classList.toggle('active', c.id === id));
  }

  function initTabs() {
    // index.html#calc-years opens that calculator (used by the dashboard's "Edit" links)
    const openFromHash = () => {
      const id = location.hash.slice(1);
      if (document.getElementById(id)?.classList.contains('calc')) {
        activateTab(id);
        document.getElementById('calculators').scrollIntoView();
        scheduleRender();
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.calc').forEach((c) => c.classList.toggle('active', c.id === tab.dataset.tab));
        scheduleRender(); // canvases need a visible size to draw
      });
    });
  }

  /* ---------- FI number ---------- */
  function renderFI() {
    const yearly = num('fi-monthly') * 12;
    const rate = num('fi-rate') / 100;
    if (rate <= 0) return;
    const target = yearly / rate;
    $('fi-out').textContent = fmt(target);
    $('fi-sub').textContent = `With ${fmtPct(rate, 1)} withdrawals you can take out ${fmt(yearly)} a year, or ${fmt(yearly / 12)} a month.`;
    $('fi-yearly').textContent = fmt(yearly);
    $('fi-mult').textContent = `${fmtNumber(1 / rate, 1)}×`;
    $('fi-alt').textContent = fmt(yearly / 0.035);
  }

  /* ---------- Years to FI ---------- */
  function renderYears() {
    const start = num('y-current');
    const monthly = num('y-saving');
    const ret = num('y-return');
    const rate = num('y-rate') / 100;
    const target = rate > 0 ? (num('y-expenses') * 12) / rate : Infinity;
    const months = monthsToTarget(start, monthly, ret, target);
    const age = num('y-age');

    $('y-target').textContent = fmt(target);
    if (!Number.isFinite(months)) {
      $('y-out').textContent = '100+ years';
      $('y-sub').textContent = 'Try investing more each month or lowering your expenses.';
      $('y-contrib').textContent = '–';
      $('y-growth').textContent = '–';
      FI.lineChart($('y-chart'), [{ label: 'Portfolio', points: [] }]);
      return;
    }
    $('y-out').textContent = formatDuration(months);
    $('y-sub').textContent = age > 0 && months > 0
      ? `You'd reach FI at around age ${fmtNumber(age + months / 12, 0)}.`
      : '';
    const contributed = start + monthly * months;
    $('y-contrib').textContent = fmt(contributed);
    $('y-growth').textContent = fmt(Math.max(0, target - contributed));

    // chart: yearly points until FI (+ a little after)
    const r = monthlyRate(ret);
    const totalYears = Math.max(1, Math.ceil(months / 12));
    const pts = [{ x: 0, y: start }];
    let v = start;
    for (let m = 1; m <= totalYears * 12; m++) {
      v = v * (1 + r) + monthly;
      if (m % 12 === 0) pts.push({ x: m / 12, y: v });
    }
    FI.lineChart($('y-chart'), [{ label: 'Portfolio', points: pts, fill: true }], {
      xLabel: (x) => (age > 0 ? `Age ${Math.round(age + x)}` : `Year ${Math.round(x)}`),
      hLines: [{ y: target, label: 'FI number' }],
    });
  }

  /* ---------- Savings rate ---------- */
  function renderRate() {
    const income = num('r-income');
    const spend = num('r-spend');
    const ret = num('r-return');
    const rate = income > 0 ? (income - spend) / income : 0;

    $('r-out').textContent = fmtPct(rate, 1);
    if (rate <= 0) {
      $('r-sub').textContent = 'You spend all your income or more, so FI is out of reach until that changes.';
    } else {
      const months = monthsToTarget(0, income - spend, ret, (spend * 12) / 0.04);
      $('r-sub').textContent = `Saving ${fmt(income - spend)} a month. Starting from zero, that's about ${formatDuration(months)} to FI.`;
    }

    const tbody = $('r-table').querySelector('tbody');
    tbody.innerHTML = '';
    const userPct = Math.round(rate * 100);
    const rows = [10, 20, 30, 40, 50, 60, 70, 80];
    if (userPct > 0 && userPct < 100 && !rows.includes(userPct)) rows.push(userPct);
    rows.sort((a, b) => a - b).forEach((pct) => {
      // using an income of 1: saving pct, spending 1 - pct
      const s = pct / 100;
      const months = monthsToTarget(0, s, ret, ((1 - s) * 12) / 0.04);
      const tr = document.createElement('tr');
      if (pct === userPct) tr.className = 'highlight';
      tr.innerHTML = `<td>${pct}%${pct === userPct ? ' (you)' : ''}</td><td class="num">${
        Number.isFinite(months) ? fmtNumber(months / 12, 1) : '100+'
      }</td>`;
      tbody.appendChild(tr);
    });
  }

  /* ---------- Compound growth ---------- */
  function renderCompound() {
    const start = num('c-start');
    const monthly = num('c-monthly');
    const ret = num('c-return');
    const years = Math.max(1, Math.min(70, Math.round(num('c-years'))));
    const r = monthlyRate(ret);

    let v = start;
    const total = [{ x: 0, y: start }];
    const contrib = [{ x: 0, y: start }];
    for (let m = 1; m <= years * 12; m++) {
      v = v * (1 + r) + monthly;
      if (m % 12 === 0) {
        total.push({ x: m / 12, y: v });
        contrib.push({ x: m / 12, y: start + monthly * m });
      }
    }
    const put = start + monthly * years * 12;
    $('c-years-label').textContent = years;
    $('c-out').textContent = fmt(v);
    $('c-sub').textContent = `Returns make up ${fmtPct(v > 0 ? (v - put) / v : 0, 0)} of the final amount.`;
    $('c-contrib').textContent = fmt(put);
    $('c-growth').textContent = fmt(v - put);
    $('c-sustain').textContent = fmt(v * 0.04);

    FI.lineChart(
      $('c-chart'),
      [
        { label: 'Total value', points: total, fill: true },
        { label: 'You put in', points: contrib, color: getComputedStyle(document.documentElement).getPropertyValue('--warn').trim() },
      ],
      { xLabel: (x) => `Year ${Math.round(x)}` }
    );
  }

  /* ---------- Coast FI ---------- */
  function renderCoast() {
    const age = num('k-age');
    const retire = num('k-retire');
    const current = num('k-current');
    const ret = num('k-return') / 100;
    const rate = num('k-rate') / 100;
    const years = Math.max(0, retire - age);
    const target = rate > 0 ? (num('k-expenses') * 12) / rate : Infinity;
    const growth = Math.pow(1 + ret, years);
    const coast = target / growth;
    const future = current * growth;

    $('k-out').textContent = fmt(coast);
    $('k-target').textContent = fmt(target);
    $('k-future').textContent = fmt(future);
    $('k-progress').textContent = fmtPct(Math.min(1, current / coast), 0);
    if (current >= coast) {
      $('k-sub').textContent = `You've reached Coast FI 🎉 Without saving more, your money should grow to your FI number by age ${retire}.`;
    } else {
      $('k-sub').textContent = `You need ${fmt(coast - current)} more invested before you can stop saving and coast to age ${retire}.`;
    }

    const pts = [];
    const need = [];
    for (let y = 0; y <= years; y++) {
      pts.push({ x: age + y, y: current * Math.pow(1 + ret, y) });
      need.push({ x: age + y, y: target / Math.pow(1 + ret, years - y) });
    }
    FI.lineChart(
      $('k-chart'),
      [
        { label: 'Your money (no new saving)', points: pts, fill: true },
        { label: 'Coast FI line', points: need, color: getComputedStyle(document.documentElement).getPropertyValue('--warn').trim() },
      ],
      { xLabel: (x) => `Age ${Math.round(x)}` }
    );
  }

  const RENDERERS = {
    'calc-fi': renderFI,
    'calc-years': renderYears,
    'calc-rate': renderRate,
    'calc-compound': renderCompound,
    'calc-coast': renderCoast,
  };

  // Only the visible calculator is recalculated, at most once per animation frame,
  // so typing quickly never queues up redundant work.
  let pending = false;
  function scheduleRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const active = document.querySelector('.calc.active');
      if (active && RENDERERS[active.id]) RENDERERS[active.id]();
    });
  }

  /* ---------- Remember the values typed in (synced to your account when logged in) ---------- */
  const CALC_KEY = 'fi.calc';
  const inputs = () => document.querySelectorAll('#calculators input[id]');

  function restoreInputs() {
    const saved = FI.store.get(CALC_KEY, {});
    inputs().forEach((el) => {
      if (saved[el.id] !== undefined && saved[el.id] !== '') el.value = saved[el.id];
    });
  }

  let saveTimer;
  function saveInputs() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const values = {};
      inputs().forEach((el) => (values[el.id] = el.value));
      FI.store.set(CALC_KEY, values);
    }, 400);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    restoreInputs();
    const root = document.getElementById('calculators');
    root.addEventListener('input', () => {
      scheduleRender();
      saveInputs();
    });
    document.addEventListener('currencychange', scheduleRender);
    // Numbers arrived from your account after logging in
    document.addEventListener('fi:synced', () => {
      restoreInputs();
      scheduleRender();
    });
    scheduleRender();
  });
})();
