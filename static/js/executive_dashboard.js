const facilitySelect = document.getElementById('facilitySelect') || { value: '', addEventListener: () => {} };
const downloadReportBtn = document.getElementById('downloadReportBtn') || { addEventListener: () => {} };

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text: isLight ? '#64748B' : '#94A3B8',
    grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
  };
}

const BREAKDOWN_COLORS = ['#00A3FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EAB308', '#64748B'];

let healthGauge, domainRadarChart, costDistChart, costTrendChart, rankingChart, complianceChart;

function chartJsReady() {
  return typeof Chart !== 'undefined' && !window.__chartJsUnavailable;
}

function qs() {
  return facilitySelect.value ? `facility_id=${facilitySelect.value}` : '';
}

function fmtMoney(n) {
  if (n === undefined || n === null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return sign + '₹' + (abs / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return sign + '₹' + (abs / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return sign + '₹' + (abs / 1e3).toFixed(1) + 'K';
  return sign + '₹' + abs.toLocaleString();
}

function healthColor(score) {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

async function loadSummary() {
  const res = await fetch(`/api/executive/summary?${qs()}`);
  const d = await res.json();

  document.getElementById('kpiCostReduction').innerHTML = `${d.cost_reduction_pct ?? 0}<span class="unit">%</span>`;
  document.getElementById('kpiRoi').innerHTML = `${d.roi_generated_pct ?? 0}<span class="unit">%</span>`;
  document.getElementById('kpiSavings').innerHTML = fmtMoney(d.potential_savings);
  document.getElementById('kpiOptimizations').textContent = d.optimizations_identified ?? 0;

  const health = d.facility_health_score ?? 0;
  document.getElementById('gaugeValue').textContent = `${health}`;

  const ctx = document.getElementById('healthGauge');
  if (chartJsReady()) {
    if (healthGauge) healthGauge.destroy();
    healthGauge = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [health, 100 - health],
          backgroundColor: [healthColor(health), 'rgba(255,255,255,0.12)'],
          borderWidth: 0,
        }],
      },
      options: {
        circumference: 180,
        rotation: 270,
        cutout: '75%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
      },
    });
  }

  // Cross-agent domain radar
  const radarCtx = document.getElementById('domainRadarChart');
  if (chartJsReady()) {
    if (domainRadarChart) domainRadarChart.destroy();
    const colors = getThemeColors();
    domainRadarChart = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Energy Efficiency', 'Asset Health', 'Physical Security', 'Space Occupancy'],
        datasets: [{
          label: 'Domain Index (0-100)',
          data: [d.energy_efficiency_score ?? 0, d.avg_asset_health ?? 0, d.security_score ?? 0, d.occupancy_score ?? 0],
          backgroundColor: 'rgba(0,163,255,0.18)',
          borderColor: '#00A3FF',
          pointBackgroundColor: '#00A3FF',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 100,
            angleLines: { color: colors.grid },
            grid: { color: colors.grid },
            pointLabels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } },
            ticks: { color: colors.text, backdropColor: 'transparent', font: { size: 9, family: "'IBM Plex Mono', monospace" } },
          },
        },
      },
    });
  }
}

async function loadCostDistribution() {
  const res = await fetch('/api/executive/cost-distribution');
  const d = await res.json();
  const entries = Object.entries(d).sort((a, b) => b[1] - a[1]);

  const ctx = document.getElementById('costDistChart');
  if (!entries.length) return;
  if (chartJsReady()) {
    if (costDistChart) costDistChart.destroy();
    const colors = getThemeColors();
    costDistChart = new Chart(ctx, {
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
        plugins: {
          legend: { position: 'bottom', labels: { color: colors.text, font: { size: 10.5, family: "'IBM Plex Sans', sans-serif" }, boxWidth: 10 } },
        },
      },
    });
  }
}

async function loadCostTrend() {
  const res = await fetch('/api/cost/trend?months=12');
  const d = await res.json();
  const ctx = document.getElementById('costTrendChart');
  if (!d.labels || !d.labels.length) return;
  if (chartJsReady()) {
    if (costTrendChart) costTrendChart.destroy();
    const colors = getThemeColors();
    costTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: d.labels,
        datasets: [
          { label: 'Operational Spend', data: d.operational_cost, borderColor: '#00A3FF', backgroundColor: 'rgba(0,163,255,0.12)', tension: 0.3, fill: true },
          { label: 'Budget Allocated', data: d.budget_allocated, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.06)', tension: 0.3, borderDash: [5, 4], fill: false },
          { label: 'Potential Savings', data: d.potential_savings, borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.08)', tension: 0.3, fill: true },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: colors.text, font: { size: 10.5, family: "'IBM Plex Sans', sans-serif" } } } },
        scales: {
          x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
          y: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" }, callback: v => fmtMoney(v) }, grid: { color: colors.grid } },
        },
      },
    });
  }
}

async function loadRanking() {
  const res = await fetch('/api/executive/ranking');
  const d = await res.json();

  const body = document.getElementById('rankingTable');
  if (!d.length) {
    body.innerHTML = '<tr><td colspan="4" class="loading-note">No data found.</td></tr>';
    return;
  }
  body.innerHTML = d.slice(0, 8).map(r => `
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--accent);">${r.facility_id}</td>
      <td><span class="f-type">${r.facility_type}</span></td>
      <td style="font-family:'IBM Plex Mono',monospace; font-weight:600;">${fmtMoney(r.potential_savings)}</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${r.avg_roi_pct}%</td>
    </tr>`).join('');

  const top8 = d.slice(0, 8);
  const ctx = document.getElementById('rankingChart');
  if (chartJsReady()) {
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
}

async function loadBudgetCompliance() {
  const res = await fetch('/api/cost/budget-compliance?months=12');
  const d = await res.json();
  if (!d.periods_within_budget && d.periods_within_budget !== 0) return;

  document.getElementById('complianceTag').textContent = `${d.compliance_pct}% COMPLIANT`;
  const ctx = document.getElementById('complianceChart');
  if (chartJsReady()) {
    if (complianceChart) complianceChart.destroy();
    const colors = getThemeColors();
    complianceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Within Budget', 'Over Budget'],
        datasets: [{
          data: [d.periods_within_budget, d.periods_over_budget],
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
}

async function loadRecommendations() {
  const res = await fetch(`/api/executive/recommendations?${qs()}`);
  const d = await res.json();
  document.getElementById('recCountTag').textContent = `${d.length} DIRECTIVES`;
  document.getElementById('recommendations').innerHTML = d.map(r => `
    <div class="rec">
      <div class="rec-head">
        <span class="rec-title">${r.title}</span>
        <span class="badge ${r.priority}">${r.priority}</span>
      </div>
      <div class="rec-detail"><strong>${r.agent}:</strong> ${r.detail}</div>
    </div>`).join('') || '<p class="loading-note">No active directives at this time.</p>';
}

function refreshAll() {
  loadSummary();
  loadCostDistribution();
  loadCostTrend();
  loadRanking();
  loadBudgetCompliance();
  loadRecommendations();
}

downloadReportBtn.addEventListener('click', () => {
  const url = `/api/executive/report${qs() ? '?' + qs() : ''}`;
  window.location.href = url;
});

facilitySelect.addEventListener('change', refreshAll);
refreshAll();
setInterval(refreshAll, 60000);
