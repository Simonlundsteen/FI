/* Personal FI tracker: milestones, the 4% rule and costs covered. */
(() => {
  const $ = (id) => document.getElementById(id);
  const { fmt, fmtPct, store } = FI;
  const KEY = 'fi.tracker';

  /* ---------- Milestone ladder (in DKK-sized units, scaled for other currencies) ----------
     Close together at the start, then further apart:
     10k, 25k, 50k, 75k, 100k → every 50k to 1M → every 250k to 2M → every 500k to 5M → every 1M to 10M */
  const BASE_LADDER = FI.math.BASE_LADDER;

  const GROUPS = [
    { upTo: 100e3, title: 'Getting started' },
    { upTo: 1e6, title: 'Building momentum' },
    { upTo: 5e6, title: 'Serious freedom' },
    { upTo: 10e6, title: 'Financially independent territory' },
  ];



  const defaults = () => ({ history: [], labels: {}, costs: [], rate: 4 });
  let data = Object.assign(defaults(), store.get(KEY, {}));
  const save = () => store.set(KEY, data);

  const scale = () => FI.currencyInfo().scale;
  const ladder = () => BASE_LADDER.map((v) => v * scale());
  const rate = () => Math.max(0.1, data.rate) / 100;
  // Local date (not UTC), so entries saved just after midnight get today's date
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function sortedHistory() {
    return [...data.history].sort((a, b) => a.date.localeCompare(b.date));
  }
  function netWorth() {
    const h = sortedHistory();
    return h.length ? h[h.length - 1].amount : 0;
  }
  const labelFor = (i) => FI.math.milestoneLabel(data.labels, i);

  /* ---------- Milestone ladder DOM (built once, then updated in place) ---------- */
  let rows = [];
  function buildLadder() {
    const root = $('t-ladder');
    root.innerHTML = '';
    rows = [];
    let g = -1;
    BASE_LADDER.forEach((base, i) => {
      const groupIdx = GROUPS.findIndex((gr) => base <= gr.upTo);
      if (groupIdx !== g) {
        g = groupIdx;
        const t = document.createElement('div');
        t.className = 'ladder-group-title';
        t.textContent = GROUPS[g].title;
        root.appendChild(t);
      }
      const row = document.createElement('div');
      row.className = 'milestone';

      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = i + 1;

      const amount = document.createElement('div');
      amount.className = 'amount';

      const pays = document.createElement('div');
      pays.className = 'pays';

      const labelCell = document.createElement('div');
      labelCell.className = 'label-cell';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 80;
      input.placeholder = 'What will this pay for?';
      input.value = labelFor(i);
      input.setAttribute('aria-label', `What milestone ${i + 1} pays for`);
      let t;
      input.addEventListener('input', () => {
        data.labels[i] = input.value;
        clearTimeout(t);
        t = setTimeout(save, 300); // debounce storage writes while typing
      });
      labelCell.appendChild(input);

      const mini = document.createElement('div');
      mini.className = 'mini-progress';
      const miniBar = document.createElement('div');
      mini.appendChild(miniBar);
      pays.appendChild(document.createElement('span'));
      pays.appendChild(mini);

      row.append(badge, amount, pays, labelCell);
      root.appendChild(row);
      rows.push({ row, badge, amount, paysText: pays.firstChild, mini, miniBar, input });
    });
  }

  function updateLadder() {
    const nw = netWorth();
    const r = rate();
    const steps = ladder();
    const nextIdx = steps.findIndex((v) => nw < v);
    steps.forEach((v, i) => {
      const el = rows[i];
      const reached = nw >= v;
      const isNext = i === nextIdx;
      el.row.classList.toggle('reached', reached);
      el.row.classList.toggle('next', isNext);
      el.badge.textContent = reached ? '✓' : i + 1;
      el.amount.textContent = fmt(v);
      el.paysText.innerHTML = '';
      const strong = document.createElement('strong');
      strong.textContent = fmt(v * r);
      el.paysText.append('Pays ', strong, ` / year · ${fmt((v * r) / 12)} / month`);
      el.mini.style.display = isNext ? '' : 'none';
      if (isNext) {
        const prev = i ? steps[i - 1] : 0;
        el.miniBar.style.width = `${Math.max(0, Math.min(100, ((nw - prev) / (v - prev)) * 100))}%`;
      }
    });
  }

  /* ---------- Top status ---------- */
  function updateStatus() {
    const nw = netWorth();
    const r = rate();
    const steps = ladder();
    const yearly = Math.max(0, nw) * r; // debt pays for nothing
    const reachedCount = steps.filter((v) => nw >= v).length;
    const nextIdx = steps.findIndex((v) => nw < v);

    $('t-sustain').textContent = `${fmt(yearly)} / year`;
    $('t-sustain-line').innerHTML = '';
    const s1 = document.createElement('strong');
    s1.textContent = fmt(yearly / 12);
    const s2 = document.createElement('strong');
    s2.textContent = fmt(yearly / 365, yearly / 365 < 100 ? 2 : 0);
    $('t-sustain-line').append(
      `Net worth ${fmt(nw)} at ${fmtPct(r, 1)}. That's `, s1, ' a month, or ', s2, ' a day, for life.'
    );

    if (nextIdx === -1) {
      $('t-next-title').textContent = 'All milestones reached 🎉';
      $('t-next-pct').textContent = '100%';
      $('t-next-bar').style.width = '100%';
      $('t-next-left').textContent = 'You made it to the top of the list.';
    } else {
      const next = steps[nextIdx];
      const prev = nextIdx ? steps[nextIdx - 1] : 0;
      const pct = Math.max(0, Math.min(1, (nw - prev) / (next - prev)));
      const label = labelFor(nextIdx);
      $('t-next-title').textContent = `Next milestone: ${fmt(next)}${label ? ` · ${label}` : ''}`;
      $('t-next-pct').textContent = fmtPct(pct, 0);
      $('t-next-bar').style.width = `${pct * 100}%`;
      $('t-next-left').textContent = `${fmt(next - nw)} to go. Unlocks ${fmt(next * r)} / year`;
    }
    $('t-reached-count').textContent = `${reachedCount} of ${steps.length} milestones reached`;
    const top = steps[steps.length - 1];
    const totalPct = Math.max(0, Math.min(1, nw / top));
    $('t-total-pct').textContent = fmtPct(totalPct, 1);
    $('t-total-bar').style.width = `${totalPct * 100}%`;
  }

  /* ---------- Costs ---------- */
  function yearlyCost(c) {
    return c.period === 'month' ? c.amount * 12 : c.amount;
  }

  function updateCosts() {
    const nw = netWorth();
    const r = rate();
    const tbody = $('cost-table').querySelector('tbody');
    tbody.innerHTML = '';
    const costs = [...data.costs].sort((a, b) => yearlyCost(a) - yearlyCost(b));
    $('cost-empty').style.display = costs.length ? 'none' : '';
    $('cost-table').style.display = costs.length ? '' : 'none';

    let cumulative = 0;
    let coveredCount = 0;
    costs.forEach((c) => {
      const y = yearlyCost(c);
      const need = y / r;
      cumulative += need;
      const covered = nw >= cumulative;
      if (covered) coveredCount++;

      const tr = document.createElement('tr');
      const cells = [
        c.name,
        fmt(y),
        fmt(need),
        fmt(cumulative),
        covered ? '✓ Covered' : `${fmt(cumulative - nw)} to go`,
      ];
      cells.forEach((text, idx) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (idx >= 1 && idx <= 3) td.className = 'num';
        if (idx === 4) td.className = covered ? 'covered' : 'not-covered';
        tr.appendChild(td);
      });
      const td = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'icon-btn';
      del.title = 'Remove';
      del.setAttribute('aria-label', `Remove ${c.name}`);
      del.textContent = '×';
      del.addEventListener('click', () => {
        data.costs = data.costs.filter((x) => x.id !== c.id);
        save();
        updateCosts();
      });
      td.appendChild(del);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });

    const summary = $('cost-summary');
    if (!costs.length) {
      summary.style.display = 'none';
      return;
    }
    summary.style.display = '';
    const totalYearly = costs.reduce((s, c) => s + yearlyCost(c), 0);
    const target = totalYearly / r;
    summary.innerHTML = '';
    const b = document.createElement('strong');
    b.textContent = `${coveredCount} of ${costs.length} costs covered.`;
    summary.append(
      b,
      ` Together your costs are ${fmt(totalYearly)} a year, so covering all of them takes ${fmt(target)} invested. You're ${fmtPct(Math.max(0, Math.min(1, nw / target)), 1)} of the way there.`
    );
  }

  /* ---------- History ---------- */
  function updateHistory() {
    const h = sortedHistory();
    const r = rate();
    const tbody = $('hist-table').querySelector('tbody');
    tbody.innerHTML = '';
    $('hist-empty').style.display = h.length ? 'none' : '';
    $('hist-table').style.display = h.length ? '' : 'none';

    [...h].reverse().forEach((e) => {
      const tr = document.createElement('tr');
      [e.date, fmt(e.amount), fmt(Math.max(0, e.amount) * r)].forEach((text, idx) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (idx) td.className = 'num';
        tr.appendChild(td);
      });
      const td = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'icon-btn';
      del.textContent = '×';
      del.title = 'Remove entry';
      del.setAttribute('aria-label', `Remove entry ${e.date}`);
      del.addEventListener('click', () => {
        data.history = data.history.filter((x) => x.date !== e.date);
        save();
        renderAll();
      });
      td.appendChild(del);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });

    const points = h.map((e) => ({ x: Date.parse(e.date), y: e.amount }));
    const steps = ladder();
    const next = steps.find((v) => netWorth() < v);
    FI.lineChart($('t-chart'), [{ label: 'Net worth', points, fill: true, dots: true }], {
      xLabel: (x) => new Date(x).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      hLines: next && h.length >= 2 ? [{ y: next, label: `Next milestone ${FI.fmtCompact(next)}` }] : [],
      emptyText: 'Save your net worth on two or more dates to see a chart',
    });
  }

  function renderAll() {
    updateStatus();
    updateLadder();
    updateCosts();
    updateHistory();
  }

  /* ---------- Events ---------- */
  const shortDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  /** Save an amount for the chosen date and tell the user what changed. */
  function record(amount) {
    const date = $('t-date').value || today();
    const steps = ladder();
    const before = steps.filter((v) => netWorth() >= v).length;
    data.history = data.history.filter((e) => e.date !== date);
    data.history.push({ date, amount });
    save();
    const after = steps.filter((v) => netWorth() >= v).length;
    $('t-networth').value = netWorth();
    renderAll();

    const latest = sortedHistory()[data.history.length - 1];
    if (latest.date !== date) {
      FI.toast(`Saved for ${shortDate(date)}. Your current net worth is still your newest entry (${shortDate(latest.date)}).`);
    } else if (after > before) {
      const i = after - 1;
      const label = labelFor(i);
      FI.toast(`🎉 Milestone ${fmt(steps[i])} reached. You can now pay for ${fmt(steps[i] * rate())} a year${label ? `: ${label}` : ''}`);
    } else if (after < before) {
      FI.toast(`Saved. You're now below the ${fmt(steps[before - 1])} milestone. It'll come back!`);
    } else {
      FI.toast('Saved');
    }
  }

  function saveNetWorth() {
    const raw = $('t-networth').value;
    const amount = parseFloat(raw);
    if (raw === '' || !Number.isFinite(amount)) {
      $('t-networth').focus();
      FI.toast('Enter your net worth as a number first');
      return;
    }
    record(amount);
  }

  function adjust(sign) {
    const raw = $('t-adjust').value;
    const delta = Math.abs(parseFloat(raw));
    if (raw === '' || !Number.isFinite(delta) || delta === 0) {
      $('t-adjust').focus();
      FI.toast(`Enter an amount to ${sign > 0 ? 'add' : 'subtract'} first`);
      return;
    }
    record(netWorth() + sign * delta);
    $('t-adjust').value = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('t-date').value = today();
    $('t-rate').value = data.rate;
    if (data.history.length) $('t-networth').value = netWorth();

    buildLadder();
    renderAll();

    $('t-save').addEventListener('click', saveNetWorth);
    $('t-add').addEventListener('click', () => adjust(1));
    $('t-subtract').addEventListener('click', () => adjust(-1));
    $('t-networth').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveNetWorth();
    });

    let rateFrame = null;
    $('t-rate').addEventListener('input', () => {
      const v = parseFloat($('t-rate').value);
      if (!Number.isFinite(v) || v <= 0) return;
      data.rate = v;
      save();
      if (rateFrame) return;
      rateFrame = requestAnimationFrame(() => {
        rateFrame = null;
        renderAll();
      });
    });

    $('cost-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('cost-name').value.trim();
      const amount = parseFloat($('cost-amount').value);
      if (!name || !Number.isFinite(amount) || amount <= 0) return;
      data.costs.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, amount, period: $('cost-period').value });
      save();
      $('cost-form').reset();
      $('cost-name').focus();
      updateCosts();
    });

    document.addEventListener('currencychange', renderAll);

    // Numbers arrived from your account after logging in (or were cleared on sign-out)
    document.addEventListener('fi:synced', () => {
      data = Object.assign(defaults(), store.get(KEY, {}));
      $('t-rate').value = data.rate;
      $('t-networth').value = data.history.length ? netWorth() : '';
      buildLadder();
      renderAll();
    });

    $('t-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ ...data, currency: FI.getCurrency() }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fi-tracker-${today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    $('t-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed.history) || !Array.isArray(parsed.costs)) throw new Error('bad file');
        data = Object.assign(defaults(), {
          history: parsed.history.filter((h) => typeof h.date === 'string' && Number.isFinite(h.amount)),
          costs: parsed.costs.filter((c) => typeof c.name === 'string' && Number.isFinite(c.amount)),
          labels: typeof parsed.labels === 'object' && parsed.labels ? parsed.labels : {},
          rate: Number.isFinite(parsed.rate) ? parsed.rate : 4,
        });
        save();
        if (parsed.currency) FI.setCurrency(parsed.currency);
        $('t-rate').value = data.rate;
        $('t-networth').value = data.history.length ? netWorth() : '';
        buildLadder();
        renderAll();
        FI.toast('Backup imported');
      } catch {
        FI.toast('That file could not be read as a tracker backup');
      }
      e.target.value = '';
    });

    $('t-reset').addEventListener('click', () => {
      if (!confirm('Delete all your tracker data in this browser? This cannot be undone.')) return;
      data = defaults();
      save();
      $('t-rate').value = 4;
      $('t-networth').value = '';
      buildLadder();
      renderAll();
    });
  });
})();
