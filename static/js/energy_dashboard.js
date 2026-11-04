const facilitySelect = document.getElementById('facilitySelect') || { value: '', addEventListener: () => {} };
const daysSelect = document.getElementById('daysSelect') || { value: '14', addEventListener: () => {} };

let consumptionChart, forecastChart, loadDistChart, anomalyChart, loadCompositionChart;

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text: isLight ? '#64748B' : '#94A3B8',
    grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
  };
}

function chartJsReady() {
  return typeof Chart !== 'undefined' && !window.__chartJsUnavailable;
}

function qs() {
  const fid = facilitySelect.value;
  const days = daysSelect.value;
  return `facility_id=${fid}&days=${days}`;
}

async function loadSummary() {
  const res = await fetch(`/api/energy/summary?${qs()}`);
  const d = await res.json();
  document.getElementById('kpiTotalEnergy').innerHTML = `${d.total_kwh.toLocaleString()} <span class="unit">kWh</span>`;
  document.getElementById('kpiCost').innerHTML = `₹${d.estimated_cost.toLocaleString()}`;
  document.getElementById('kpiEfficiency').innerHTML = `${d.efficiency_score}<span class="unit">%</span>`;
  document.getElementById('kpiCarbon').innerHTML = `${d.carbon_kg_est.toLocaleString()} <span class="unit">kg CO2</span>`;
}

async function loadConsumption() {
  const res = await fetch(`/api/energy/timeseries?${qs()}`);
  const d = await res.json();
  const ctx = document.getElementById('consumptionChart');
  if (!chartJsReady()) return;
  if (consumptionChart) consumptionChart.destroy();
  const colors = getThemeColors();
  consumptionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Electricity (kWh)', data: d.electricity_kwh, borderColor: '#00A3FF', backgroundColor: 'rgba(0,163,255,0.12)', tension: 0.3, fill: true, yAxisID: 'y' },
        { label: 'Water (L)', data: d.water_liters, borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.08)', tension: 0.3, fill: true, yAxisID: 'y1' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { position: 'left', ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y1: { position: 'right', ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
      },
    },
  });
}

async function loadLoadDistribution() {
  const res = await fetch(`/api/energy/load-distribution?${qs()}`);
  const d = await res.json();
  const rows = [
    ['HVAC', d.hvac_pct],
    ['Lighting', d.lighting_pct],
    ['Equipment', d.equipment_pct],
    ['Other', d.other_pct],
  ];

  const colors = getThemeColors();
  const pal = ['#00A3FF', '#10B981', '#F59E0B', '#8B5CF6'];
  document.getElementById('loadDistribution').innerHTML = rows.map((r, i) => `
    <div class="bar-row">
      <div class="bar-label"><span>${r[0]}</span><span>${r[1]}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${r[1]}%; background:${pal[i]};"></div></div>
    </div>`).join('');

  const ctx = document.getElementById('loadDistChart');
  if (!chartJsReady()) return;
  if (loadDistChart) loadDistChart.destroy();
  loadDistChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r[0]),
      datasets: [{
        data: rows.map(r => r[1]),
        backgroundColor: pal,
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

async function loadAnomalies() {
  const [tsRes, res] = await Promise.all([
    fetch(`/api/energy/timeseries?${qs()}`),
    fetch(`/api/energy/anomalies?${qs()}`),
  ]);
  const ts = await tsRes.json();
  const d = await res.json();

  document.getElementById('anomalyAccuracyTag').textContent = `${d.accuracy_estimate}% DETECTION ACCURACY`;

  const body = document.getElementById('anomalyTable');
  if (!d.anomalies.length) {
    body.innerHTML = '<tr><td colspan="4" class="loading-note">No anomalies detected in selected window.</td></tr>';
  } else {
    body.innerHTML = d.anomalies.map(a => `
      <tr>
        <td style="font-family:'IBM Plex Mono',monospace;">${a.timestamp}</td>
        <td style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--accent);">FAC-0${a.facility_id}</td>
        <td style="font-family:'IBM Plex Mono',monospace; font-weight:600;">${a.electricity_usage.toFixed(1)} kWh</td>
        <td><span class="badge ${Math.abs(a.z_score) > 3 ? 'Critical' : 'High'}">Z: ${a.z_score}</span></td>
      </tr>`).join('');
  }

  const anomalyByDay = {};
  d.anomalies.forEach(a => {
    const day = a.timestamp.slice(0, 10);
    anomalyByDay[day] = Math.max(anomalyByDay[day] || 0, a.electricity_usage);
  });

  const pointColors = ts.labels.map(day => anomalyByDay[day] ? '#EF4444' : '#00A3FF');
  const pointRadii = ts.labels.map(day => anomalyByDay[day] ? 6 : 2);

  const ctx = document.getElementById('anomalyChart');
  if (!chartJsReady()) return;
  if (anomalyChart) anomalyChart.destroy();
  const colors = getThemeColors();
  anomalyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ts.labels,
      datasets: [{
        label: 'Daily Usage (kWh) — red flags indicate z-score anomalies',
        data: ts.electricity_kwh,
        borderColor: '#00A3FF',
        backgroundColor: 'rgba(0,163,255,0.08)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: pointRadii,
        pointHoverRadius: pointRadii.map(r => r + 2),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
      },
    },
  });
}

async function loadForecast() {
  const res = await fetch(`/api/energy/forecast?facility_id=${facilitySelect.value}`);
  const d = await res.json();
  const ctx = document.getElementById('forecastChart');
  if (!chartJsReady()) return;
  if (forecastChart) forecastChart.destroy();
  const colors = getThemeColors();
  forecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.map(r => r.date),
      datasets: [{ label: 'Forecast kWh', data: d.map(r => r.forecast_kwh), backgroundColor: '#00A3FF', borderRadius: 3 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
        y: { ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
      },
    },
  });
}

async function loadRecommendations() {
  const res = await fetch(`/api/energy/recommendations?${qs()}`);
  const d = await res.json();
  document.getElementById('recommendations').innerHTML = d.map(r => `
    <div class="rec">
      <div class="rec-head">
        <span class="rec-title">${r.title}</span>
        <span class="badge ${r.priority}">${r.priority}</span>
      </div>
      <div class="rec-detail">${r.detail}</div>
      ${r.est_savings_pct > 0 ? `<div class="rec-savings"><span>⚡ Projected Energy Conservation:</span> <strong>${r.est_savings_pct}%</strong></div>` : ''}
    </div>`).join('');
}

async function loadLoadComposition() {
  const res = await fetch(`/api/energy/load-timeseries?${qs()}`);
  const d = await res.json();
  const ctx = document.getElementById('loadCompositionChart');
  if (!chartJsReady() || !d.labels || !d.labels.length) return;
  if (loadCompositionChart) loadCompositionChart.destroy();
  const colors = getThemeColors();
  loadCompositionChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'HVAC', data: d.hvac_pct, borderColor: '#00A3FF', backgroundColor: 'rgba(0,163,255,0.3)', fill: true, stack: 'load', tension: 0.25, pointRadius: 0 },
        { label: 'Lighting', data: d.lighting_pct, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.3)', fill: true, stack: 'load', tension: 0.25, pointRadius: 0 },
        { label: 'Equipment', data: d.equipment_pct, borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.3)', fill: true, stack: 'load', tension: 0.25, pointRadius: 0 },
        { label: 'Other', data: d.other_pct, borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.3)', fill: true, stack: 'load', tension: 0.25, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { stacked: true, max: 100, ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
      },
    },
  });
}

function refreshAll() {
  loadSummary();
  loadConsumption();
  loadLoadDistribution();
  loadLoadComposition();
  loadAnomalies();
  loadForecast();
  loadRecommendations();
}

facilitySelect.addEventListener('change', refreshAll);
daysSelect.addEventListener('change', refreshAll);
refreshAll();
setInterval(refreshAll, 60000);
