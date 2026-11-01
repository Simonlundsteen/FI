/* Dashboard: key numbers from the tracker and calculators. */
(() => {
  const $ = (id) => document.getElementById(id);
  const { fmt, fmtPct, fmtNumber, math } = FI;

  // Same starting values as the calculators on index.html
  const CALC_DEFAULTS = {
    'fi-monthly': 25000, 'fi-rate': 4,
    'y-current': 200000, 'y-saving': 10000, 'y-expenses': 25000, 'y-return': 5, 'y-rate': 4, 'y-age': 30,
    'r-income': 35000, 'r-spend': 25000, 'r-return': 5,
    'c-start': 50000, 'c-monthly': 5000, 'c-return': 5, 'c-years': 25,
    'k-age': 30, 'k-retire': 60, 'k-current': 300000, 'k-expenses': 25000, 'k-return': 5, 'k-rate': 4,
  };

  function render() {
    const calc = FI.store.get('fi.calc', {});
    const tracker = Object.assign({ history: [], labels: {}, costs: [], rate: 4 }, FI.store.get('fi.tracker', {}));
    let usedExample = false;
    const v = (id) => {
      const n = parseFloat(calc[id]);
      if (Number.isFinite(n)) return n;
      usedExample = true;
      return CALC_DEFAULTS[id];
    };

    const history = [...tracker.history].sort((a, b) => a.date.localeCompare(b.date));
    const hasNW = history.length > 0;
    const nw = hasNW ? history[history.length - 1].amount : 0;
    const wr = Math.max(0.1, tracker.rate || 4) / 100;
    const scale = FI.currencyInfo().scale;
    const steps = math.BASE_LADDER.map((x) => x * scale);

    /* ---------- Hero ---------- */
    $('d-networth').textContent = hasNW ? fmt(nw) : '–';
    $('d-networth-sub').innerHTML = '';
    if (hasNW) {
      $('d-networth-sub').textContent = `Last updated ${new Date(history[history.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      const a = document.createElement('a');
      a.href = 'tracker.html';
      a.textContent = 'Add your net worth in the tracker';
      $('d-networth-sub').appendChild(a);
    }

    $('d-sustain').textContent = `${fmt(nw * wr)} / yr`;
    $('d-sustain-sub').textContent = `${fmt((nw * wr) / 12)} a month, for life (${fmtPct(wr, 1)} rule)`;

    const fiRate = v('fi-rate') / 100;
    const fiNumber = fiRate > 0 ? (v('fi-monthly') * 12) / fiRate : Infinity;
    const fiPct = Number.isFinite(fiNumber) && fiNumber > 0 ? Math.min(1, nw / fiNumber) : 0;
    $('d-fi-pct').textContent = fmtPct(fiPct, 1);
    $('d-fi-bar').style.width = `${fiPct * 100}%`;
    $('d-fi-sub').textContent = fiPct >= 1 ? "You've reached your FI number 🎉" : `${fmt(Math.max(0, fiNumber - nw))} to go`;

    const nextIdx = steps.findIndex((x) => nw < x);
    const reached = steps.filter((x) => nw >= x).length;
    if (nextIdx === -1) {
      $('d-next').textContent = 'All reached 🎉';
      $('d-next-bar').style.width = '100%';
      $('d-next-sub').textContent = `${steps.length} of ${steps.length} milestones`;
    } else {
      const next = steps[nextIdx];
      const prev = nextIdx ? steps[nextIdx - 1] : 0;
      const pct = Math.max(0, Math.min(1, (nw - prev) / (next - prev)));
      const label = math.milestoneLabel(tracker.labels, nextIdx);
      $('d-next').textContent = fmt(next);
      $('d-next-bar').style.width = `${pct * 100}%`;
      $('d-next-sub').textContent = `${fmt(next - nw)} to go${label ? ` · ${label}` : ''}`;
    }

    /* ---------- FI number ---------- */
    $('d-finum').textContent = fmt(fiNumber);
    $('d-finum-sub').textContent = `${fmt(v('fi-monthly'))} a month in expenses at ${fmtPct(fiRate, 1)}`;

    /* ---------- Years to FI (uses tracker net worth when available) ---------- */
    const yStart = hasNW ? nw : v('y-current');
    const yRate = v('y-rate') / 100;
    const yTarget = yRate > 0 ? (v('y-expenses') * 12) / yRate : Infinity;
    const months = math.monthsToTarget(yStart, v('y-saving'), v('y-return'), yTarget);
    $('d-years').textContent = math.formatDuration(months);
    const age = v('y-age');
    if (Number.isFinite(months) && months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      $('d-years-sub').textContent = `Around ${d.getFullYear()}${age > 0 ? `, at age ${fmtNumber(age + months / 12, 0)}` : ''}. Investing ${fmt(v('y-saving'))} a month.`;
    } else {
      $('d-years-sub').textContent = Number.isFinite(months) ? '' : 'Invest more each month or lower your expenses.';
    }
    $('d-years-note').textContent = hasNW ? 'Starts from your tracker net worth.' : '';

    /* ---------- Savings rate ---------- */
    const inc = v('r-income');
    const spend = v('r-spend');
    const sr = inc > 0 ? (inc - spend) / inc : 0;
    $('d-rate').textContent = fmtPct(sr, 1);
    $('d-rate-sub').textContent = sr > 0 ? `Saving ${fmt(inc - spend)} of ${fmt(inc)} a month` : 'Spending is at or above income';

    /* ---------- Coast FI ---------- */
    const kCurrent = hasNW ? nw : v('k-current');
    const kRate = v('k-rate') / 100;
    const kYears = Math.max(0, v('k-retire') - v('k-age'));
    const kTarget = kRate > 0 ? (v('k-expenses') * 12) / kRate : Infinity;
    const coast = kTarget / Math.pow(1 + v('k-return') / 100, kYears);
    if (kCurrent >= coast) {
      $('d-coast').textContent = 'Reached 🎉';
      $('d-coast-sub').textContent = `Your money can grow to your FI number by age ${fmtNumber(v('k-retire'))} with no more saving.`;
    } else {
      $('d-coast').textContent = fmtPct(kCurrent / coast, 0);
      $('d-coast-sub').textContent = `${fmt(coast - kCurrent)} more to reach Coast FI (${fmt(coast)})`;
    }
    $('d-coast-note').textContent = hasNW ? 'Uses your tracker net worth.' : '';

    /* ---------- Milestones ---------- */
    $('d-ms').textContent = `${reached} of ${steps.length}`;
    if (reached) {
      const label = math.milestoneLabel(tracker.labels, reached - 1);
      $('d-ms-sub').textContent = `Latest: ${fmt(steps[reached - 1])}${label ? ` · ${label}` : ''}`;
    } else {
      $('d-ms-sub').textContent = `First one at ${fmt(steps[0])}`;
    }

    /* ---------- Costs covered ---------- */
    const costs = [...tracker.costs]
      .map((c) => (c.period === 'month' ? c.amount * 12 : c.amount))
      .sort((a, b) => a - b);
    if (!costs.length) {
      $('d-costs').textContent = '–';
      $('d-costs-sub').textContent = 'Add the costs you want covered in the tracker.';
    } else {
      let cum = 0;
      let covered = 0;
      costs.forEach((y) => {
        cum += y / wr;
        if (nw >= cum) covered++;
      });
      const totalYearly = costs.reduce((s, y) => s + y, 0);
      $('d-costs').textContent = `${covered} of ${costs.length}`;
      $('d-costs-sub').textContent = `${fmt(totalYearly)} a year needs ${fmt(totalYearly / wr)} invested`;
    }

    /* ---------- Compound growth ---------- */
    const r = math.monthlyRate(v('c-return'));
    const years = Math.max(1, Math.min(70, Math.round(v('c-years'))));
    let cv = v('c-start');
    for (let m = 1; m <= years * 12; m++) cv = cv * (1 + r) + v('c-monthly');
    $('d-comp').textContent = fmt(cv);
    $('d-comp-sub').textContent = `In ${years} years, investing ${fmt(v('c-monthly'))} a month`;

    /* ---------- Net worth change ---------- */
    const shortDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const signed = (n) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
    if (history.length >= 2) {
      const first = history[0];
      const prev = history[history.length - 2];
      $('d-change').textContent = signed(nw - first.amount);
      $('d-change-sub').textContent =
        history.length > 2
          ? `Since ${shortDate(first.date)}. Latest change ${signed(nw - prev.amount)} since ${shortDate(prev.date)}.`
          : `Since ${shortDate(first.date)}`;
    } else {
      $('d-change').textContent = '–';
      $('d-change-sub').textContent = 'Save your net worth on two or more dates to see the change.';
    }

    /* ---------- Chart ---------- */
    const next = nextIdx === -1 ? null : steps[nextIdx];
    FI.lineChart($('d-chart'), [{ label: 'Net worth', points: history.map((e) => ({ x: Date.parse(e.date), y: e.amount })), fill: true, dots: true }], {
      xLabel: (x) => new Date(x).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      hLines: next && history.length >= 2 ? [{ y: next, label: `Next milestone ${FI.fmtCompact(next)}` }] : [],
      emptyText: 'Save your net worth on two or more dates in the tracker to see a chart',
    });

    $('d-example-note').hidden = !usedExample;
  }

  document.addEventListener('DOMContentLoaded', () => {
    render();
    document.addEventListener('currencychange', render);
    document.addEventListener('fi:synced', render);
  });
})();
