const facilitySelect = document.getElementById('facilitySelect') || { value: '', addEventListener: () => {} };
const monthsSelect = document.getElementById('monthsSelect') || { value: '12', addEventListener: () => {} };
let trendChart, breakdownChart, rankingChart, complianceChart;

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text: isLight ? '#64748B' : '#94A3B8',
    grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
  };
}

const BREAKDOWN_COLORS = ['#00A3FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EAB308', '#64748B'];

function chartJsReady() {
  return typeof Chart !== 'undefined' && !window.__chartJsUnavailable;
}

function qs() {
  const params = new URLSearchParams();
  if (facilitySelect.value) params.set('facility_id', facilitySelect.value);
  params.set('months', monthsSelect.value);
  return params.toString();
}

function fmtMoney(n) {
  if (n === undefined || n === null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return (n / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

async function loadSummary() {
  const res = await fetch(`/api/cost/summary?${qs()}`);
  const d = await res.json();
  document.getElementById('kpiCost').textContent = fmtMoney(d.total_operational_cost);
  document.getElementById('kpiSavings').textContent = fmtMoney(d.potential_savings);
  document.getElementById('kpiReduction').innerHTML = `${d.cost_reduction_pct ?? 0}<span class="unit">%</span>`;
  document.getElementById('kpiRoi').innerHTML = `${d.roi_generated_pct ?? 0}<span class="unit">%</span>`;
}

async function loadTrend() {
  const res = await fetch(`/api/cost/trend?${qs()}`);
  const d = await res.json();
  const ctx = document.getElementById('trendChart');
  if (!chartJsReady()) return;
  if (trendChart) trendChart.destroy();
  const colors = getThemeColors();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels || [],
      datasets: [
        { label: 'Operational Spend', data: d.operational_cost || [], borderColor: '#00A3FF', backgroundColor: 'rgba(0,163,255,0.12)', tension: 0.3, fill: true },
        { label: 'Allocated Budget', data: d.budget_allocated || [], borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.06)', tension: 0.3, fill: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
        y: { ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
      },
    },
  });
}

async function loadBreakdown() {
  const res = await fetch(`/api/cost/breakdown?${qs()}`);
  const d = await res.json();
  const entries = Object.entries(d).sort((a, b) => b[1] - a[1]);
  document.getElementById('costBreakdown').innerHTML = entries.map(([label, pct], i) => `
    <div class="bar-row">
      <div class="bar-label"><span>${label}</span><span>${pct}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]};"></div></div>
    </div>`).join('') || '<p class="loading-note">No data.</p>';

  const ctx = document.getElementById('breakdownChart');
  if (!chartJsReady() || !entries.length) return;
  if (breakdownChart) breakdownChart.destroy();
  const colors = getThemeColors();
  breakdownChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: BREAKDOWN_COLORS,
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '58%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: colors.text, font: { size: 10.5, family: "'IBM Plex Sans', sans-serif" }, boxWidth: 10 } } },
    },
  });
}

async function loadRanking() {
  const res = await fetch(`/api/cost/ranking?months=${monthsSelect.value}`);
  const d = await res.json();
  const body = document.getElementById('rankingTable');
  if (!d.length) {
    body.innerHTML = '<tr><td colspan="5" class="loading-note">No data.</td></tr>';
    return;
  }
  body.innerHTML = d.map(r => `
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--accent);">${r.facility_id}</td>
      <td><span class="f-type">${r.facility_type}</span></td>
      <td style="font-family:'IBM Plex Mono',monospace; font-weight:600;">₹${fmtMoney(r.potential_savings)}</td>
      <td><span class="badge ${r.over_budget ? 'High' : 'Low'}">${fmtMoney(r.cost_variance)}</span></td>
      <td style="font-family:'IBM Plex Mono',monospace;">${r.avg_roi_pct}%</td>
    </tr>`).join('');

  const top8 = d.slice(0, 8);
  const ctx = document.getElementById('rankingChart');
  if (!chartJsReady() || !top8.length) return;
  if (rankingChart) rankingChart.destroy();
  const colors = getThemeColors();
  rankingChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top8.map(r => r.facility_id),
      datasets: [{
        label: 'Potential Savings',
        data: top8.map(r => r.potential_savings),
        backgroundColor: top8.map(r => r.over_budget ? '#EF4444' : '#00A3FF'),
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" }, callback: v => fmtMoney(v) }, grid: { color: colors.grid } },
        y: { ticks: { color: colors.text, font: { size: 10.5, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
      },
    },
  });
}

async function loadVendor() {
  const res = await fetch(`/api/cost/vendor?${qs()}`);
  const d = await res.json();
  if (!d || Object.keys(d).length === 0) {
    document.getElementById('vendorPanel').innerHTML = '<p class="loading-note">No data.</p>';
    return;
  }
  document.getElementById('vendorPanel').innerHTML = `
    <div class="bar-row"><div class="bar-label"><span>Total Contractor Spend</span><span>₹${fmtMoney(d.total_vendor_cost)}</span></div></div>
    <div class="bar-row"><div class="bar-label"><span>Active Maintenance Vendors</span><span>${d.avg_active_vendors}</span></div></div>
    <div class="bar-row"><div class="bar-label"><span>Average Cost per Contractor</span><span>₹${fmtMoney(d.avg_cost_per_vendor)}</span></div></div>
    <div class="bar-row"><div class="bar-label"><span>Consolidation Opportunities Identified</span><span>${d.consolidation_opportunities}</span></div></div>
  `;
}

async function loadBudgetCompliance() {
  const res = await fetch(`/api/cost/budget-compliance?${qs()}`);
  const d = await res.json();
  document.getElementById('complianceTag').textContent = `${d.compliance_pct ?? 0}% COMPLIANT`;

  const ctx = document.getElementById('complianceChart');
  if (!chartJsReady() || d.periods_within_budget === undefined) return;
  if (complianceChart) complianceChart.destroy();
  const colors = getThemeColors();
  complianceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Within Budget', 'Over Budget'],
      datasets: [{
        data: [d.periods_within_budget ?? 0, d.periods_over_budget ?? 0],
        backgroundColor: ['#10B981', '#EF4444'],
        borderWidth: 0,
      }],
    },
    options: {
      cutout: '62%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" }, boxWidth: 10 } } },
    },
  });
}

async function loadRecommendations() {
  const res = await fetch(`/api/cost/recommendations?${qs()}`);
  const d = await res.json();
  document.getElementById('recommendations').innerHTML = d.map(r => `
    <div class="rec">
      <div class="rec-head">
        <span class="rec-title">${r.title}</span>
        <span class="badge ${r.priority}">${r.priority}</span>
      </div>
      <div class="rec-detail">${r.detail}</div>
      <div class="rec-savings"><span>Flagged ${r.occurrences}x</span> · <strong>Estimated Savings: ₹${fmtMoney(r.est_savings)}</strong></div>
    </div>`).join('') || '<p class="loading-note">No recommendations for this selection.</p>';
}

function refreshAll() {
  loadSummary();
  loadTrend();
  loadBreakdown();
  loadRanking();
  loadVendor();
  loadBudgetCompliance();
  loadRecommendations();
}

facilitySelect.addEventListener('change', refreshAll);
monthsSelect.addEventListener('change', refreshAll);
refreshAll();
setInterval(refreshAll, 60000);
