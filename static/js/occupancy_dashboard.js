const facilitySelect = document.getElementById('facilitySelect') || { value: '', addEventListener: () => {} };
const daysSelect = document.getElementById('daysSelect') || { value: '14', addEventListener: () => {} };

let zoneUtilChart, forecastChart, occupancyTrendChart, zoneShareChart;

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

function statusColor(status) {
  return { Overcrowded: '#EF4444', Underused: '#F59E0B', Balanced: '#10B981' }[status] || '#0EA5E9';
}

async function loadSummary() {
  const res = await fetch(`/api/occupancy/summary?${qs()}`);
  const d = await res.json();
  document.getElementById('kpiRate').innerHTML = `${d.occupancy_rate_pct ?? '—'}<span class="unit">%</span>`;
  document.getElementById('kpiVisitors').textContent = (d.active_visitors ?? 0).toLocaleString();
  document.getElementById('kpiOvercrowd').textContent = d.overcrowding_events ?? 0;
  document.getElementById('kpiBusiest').textContent = d.busiest_zone ?? '—';
}

async function loadZones() {
  const res = await fetch(`/api/occupancy/zones?${qs()}`);
  const d = await res.json();
  document.getElementById('zoneCountTag').textContent = `${d.length} MONITORED ZONES`;

  const body = document.getElementById('zoneTable');
  if (!d.length) {
    body.innerHTML = '<tr><td colspan="6" class="loading-note">No zones found.</td></tr>';
  } else {
    body.innerHTML = d.map(z => `
      <tr>
        <td style="font-family:'IBM Plex Mono',monospace; font-weight:600;">${z.zone}</td>
        <td style="font-family:'IBM Plex Mono',monospace;">${z.avg_utilization_pct}%</td>
        <td style="font-family:'IBM Plex Mono',monospace;">${z.peak_utilization_pct}%</td>
        <td style="font-family:'IBM Plex Mono',monospace;">${z.capacity}</td>
        <td style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--text);">${z.current_occupancy}</td>
        <td><span class="badge ${z.status === 'Overcrowded' ? 'Critical' : z.status === 'Underused' ? 'Warning' : 'Low'}">${z.status}</span></td>
      </tr>`).join('');
  }

  const ctx = document.getElementById('zoneUtilChart');
  if (!chartJsReady()) return;
  if (zoneUtilChart) zoneUtilChart.destroy();
  const colors = getThemeColors();
  zoneUtilChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.map(z => z.zone),
      datasets: [{
        label: 'Avg Utilization %',
        data: d.map(z => z.avg_utilization_pct),
        backgroundColor: d.map(z => statusColor(z.status)),
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { min: 0, max: 100, ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
      },
    },
  });

  // Current occupancy share by zone
  const shareCtx = document.getElementById('zoneShareChart');
  if (chartJsReady() && d.length) {
    if (zoneShareChart) zoneShareChart.destroy();
    zoneShareChart = new Chart(shareCtx, {
      type: 'doughnut',
      data: {
        labels: d.map(z => z.zone),
        datasets: [{
          data: d.map(z => z.current_occupancy),
          backgroundColor: ['#00A3FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
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
}

async function loadOccupancyTrend() {
  const res = await fetch(`/api/occupancy/trend?${qs()}`);
  const d = await res.json();
  const ctx = document.getElementById('occupancyTrendChart');
  if (!chartJsReady() || !d.labels || !d.labels.length) return;
  if (occupancyTrendChart) occupancyTrendChart.destroy();
  const colors = getThemeColors();
  occupancyTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [{
        label: 'Occupancy Rate %',
        data: d.occupancy_rate_pct,
        borderColor: '#00A3FF',
        backgroundColor: 'rgba(0,163,255,0.12)',
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { min: 0, ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
      },
    },
  });
}

async function loadOvercrowding() {
  const res = await fetch(`/api/occupancy/overcrowding?${qs()}`);
  const d = await res.json();
  document.getElementById('overcrowdCountTag').textContent = `${d.length} SURGE INCIDENTS`;
  const body = document.getElementById('overcrowdTable');
  if (!d.length) {
    body.innerHTML = '<tr><td colspan="5" class="loading-note">No overcrowding detected in this window.</td></tr>';
    return;
  }
  body.innerHTML = d.map(e => `
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace;">${e.timestamp}</td>
      <td style="font-weight:600;">${e.zone}</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${e.occupancy_count}</td>
      <td style="font-family:'IBM Plex Mono',monospace;">${e.capacity}</td>
      <td><span class="badge Critical">${e.utilization_pct}%</span></td>
    </tr>`).join('');
}

async function loadHeatmap() {
  const res = await fetch(`/api/occupancy/heatmap?${qs()}`);
  const d = await res.json();
  const container = document.getElementById('heatmap');
  if (!d.hours || !d.hours.length) {
    container.innerHTML = '<p class="loading-note">No data.</p>';
    return;
  }

  function colorFor(pct) {
    if (pct >= 85) return 'rgba(239,68,68,0.85)';
    if (pct >= 65) return 'rgba(245,158,11,0.80)';
    if (pct >= 35) return 'rgba(0,163,255,0.6)';
    if (pct > 0) return 'rgba(0,163,255,0.22)';
    return 'rgba(255,255,255,0.05)';
  }

  let html = '<div style="overflow-x:auto;"><table style="min-width:520px;"><thead><tr><th></th>';
  d.hours.forEach(h => { html += `<th style="text-align:center;">${h}</th>`; });
  html += '</tr></thead><tbody>';
  d.weekdays.forEach((wd, i) => {
    html += `<tr><td style="font-weight:600; font-family:'IBM Plex Mono',monospace;">${wd}</td>`;
    d.matrix[i].forEach(val => {
      html += `<td style="text-align:center; padding:6px;">
        <div style="background:${colorFor(val)}; border-radius:4px; padding:8px 4px; font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600; color:${val >= 65 ? '#fff' : 'var(--text)'};">${val}%</div>
      </td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

async function loadForecast() {
  const res = await fetch(`/api/occupancy/forecast?facility_id=${facilitySelect.value}`);
  const d = await res.json();
  const ctx = document.getElementById('forecastChart');
  if (!chartJsReady()) return;
  if (forecastChart) forecastChart.destroy();
  const colors = getThemeColors();
  forecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.map(r => r.date),
      datasets: [{ label: 'Forecast Occupancy', data: d.map(r => r.forecast_occupancy), backgroundColor: '#00A3FF', borderRadius: 3 }],
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
  const res = await fetch(`/api/occupancy/recommendations?${qs()}`);
  const d = await res.json();
  document.getElementById('recommendations').innerHTML = d.map(r => `
    <div class="rec">
      <div class="rec-head">
        <span class="rec-title">${r.title}</span>
        <span class="badge ${r.priority}">${r.priority}</span>
      </div>
      <div class="rec-detail">${r.detail}</div>
    </div>`).join('');
}

function refreshAll() {
  loadSummary();
  loadZones();
  loadOccupancyTrend();
  loadOvercrowding();
  loadHeatmap();
  loadForecast();
  loadRecommendations();
}

facilitySelect.addEventListener('change', refreshAll);
daysSelect.addEventListener('change', refreshAll);
refreshAll();
setInterval(refreshAll, 60000);
