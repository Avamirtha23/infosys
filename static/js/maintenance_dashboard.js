const facilitySelect = document.getElementById('facilitySelect') || { value: '', addEventListener: () => {} };
let healthDonut, assetHealthChart, fleetTrendChart, assetTypeChart;
let allAssetsData = [];
let currentAssetFilter = 'all';

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    text: isLight ? '#64748B' : '#94A3B8',
    grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)',
  };
}

function chartJsReady() {
  return typeof Chart !== 'undefined' && !window.__chartJsUnavailable;
}

function qs() {
  return `facility_id=${facilitySelect.value}`;
}

function colorFor(label) {
  return {
    Excellent: '#10B981',
    Good: '#0EA5E9',
    Warning: '#F59E0B',
    Critical: '#F43F5E',
  }[label] || '#0EA5E9';
}

async function loadSummary() {
  const res = await fetch(`/api/maintenance/summary?${qs()}`);
  const d = await res.json();
  document.getElementById('kpiAssets').textContent = d.assets_monitored ?? 0;
  document.getElementById('kpiHealth').innerHTML = `${d.avg_health_score ?? '—'}<span class="unit">/100</span>`;
  document.getElementById('kpiFailures').textContent = d.predicted_failures ?? 0;
  document.getElementById('kpiDowntime').innerHTML = `${d.downtime_reduction_pct ?? 0}<span class="unit">%</span>`;

  // Update center donut metric if present
  const donutCenterVal = document.getElementById('donutAvgHealth');
  if (donutCenterVal) {
    donutCenterVal.textContent = d.avg_health_score ? `${d.avg_health_score}%` : '—';
  }

  if (d.health_distribution) {
    const dist = d.health_distribution;
    document.getElementById('healthDistribution').innerHTML = Object.entries(dist).map(([label, pct]) => `
      <div class="bar-row">
        <div class="bar-label">
          <span style="display:flex; align-items:center; gap:6px;">
            <span style="width:7px; height:7px; border-radius:50%; background:${colorFor(label)}; display:inline-block;"></span>
            ${label}
          </span>
          <span>${pct}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${colorFor(label)};"></div></div>
      </div>`).join('');

    const ctx = document.getElementById('healthDonut');
    if (!chartJsReady()) return;
    if (healthDonut) healthDonut.destroy();
    const colors = getThemeColors();
    healthDonut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(dist),
        datasets: [{
          data: Object.values(dist),
          backgroundColor: ['#10B981', '#0EA5E9', '#F59E0B', '#F43F5E'],
          borderWidth: 0,
          borderRadius: 4,
          spacing: 3,
        }],
      },
      options: {
        cutout: '74%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.text,
              font: { size: 10.5, family: "'IBM Plex Sans', sans-serif" },
              boxWidth: 8,
              padding: 12,
            },
          },
        },
      },
    });
  }
}

async function loadAssets() {
  const res = await fetch(`/api/maintenance/assets?${qs()}`);
  allAssetsData = await res.json();
  document.getElementById('assetCountTag').textContent = `${allAssetsData.length} MONITORED ASSETS`;
  renderAssetTable();
  renderAssetChart();
}

function renderAssetTable() {
  const body = document.getElementById('assetTable');
  if (!allAssetsData.length) {
    body.innerHTML = '<tr><td colspan="6" class="loading-note">No assets found for selected filter.</td></tr>';
    return;
  }
  body.innerHTML = allAssetsData.map(a => `
    <tr>
      <td><span style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--text);">${a.name}</span></td>
      <td><span style="color:var(--text-muted); font-size:12px;">${a.type}</span></td>
      <td>
        <div class="inline-health-wrap">
          <span class="inline-health-score" style="color:${colorFor(a.risk_band)};">${a.health_score ?? '—'}</span>
          <div class="inline-health-bar">
            <div class="inline-health-fill" style="width:${a.health_score ?? 0}%; background:${colorFor(a.risk_band)};"></div>
          </div>
        </div>
      </td>
      <td><span style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${trendIcon(a.trend)} ${a.trend}</span></td>
      <td><span class="badge ${a.risk_band}">${a.risk_band}</span></td>
      <td style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${a.days_to_critical ? a.days_to_critical + ' days' : 'Nominal'}</td>
    </tr>`).join('');
}

function renderAssetChart() {
  let filtered = [...allAssetsData];
  if (currentAssetFilter === 'risk') {
    filtered = filtered.filter(a => a.risk_band === 'Warning' || a.risk_band === 'Critical');
  } else if (currentAssetFilter === 'nominal') {
    filtered = filtered.filter(a => a.risk_band === 'Excellent' || a.risk_band === 'Good');
  }
  filtered.sort((a, b) => (a.health_score ?? 0) - (b.health_score ?? 0));

  const ctx = document.getElementById('assetHealthChart');
  if (!chartJsReady()) return;
  if (assetHealthChart) assetHealthChart.destroy();
  const colors = getThemeColors();

  // Create subtle gradient for bars
  const chartCanvas = ctx.getContext('2d');
  const barColors = filtered.map(a => {
    const c = colorFor(a.risk_band);
    return c;
  });

  assetHealthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: filtered.map(a => a.name),
      datasets: [{
        label: 'Health Score',
        data: filtered.map(a => a.health_score ?? 0),
        backgroundColor: barColors,
        borderRadius: { topRight: 4, bottomRight: 4, topLeft: 0, bottomLeft: 0 },
        barPercentage: 0.75,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Health Index: ${ctx.parsed.x}/100`,
          },
        },
      },
      scales: {
        x: {
          min: 0, max: 100,
          ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } },
          grid: { color: colors.grid },
        },
        y: {
          ticks: { color: colors.text, font: { size: 10.5, family: "'IBM Plex Mono', monospace" } },
          grid: { display: false },
        },
      },
    },
  });

  // Assets by type — fleet composition doughnut
  const typeCounts = {};
  allAssetsData.forEach(a => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1; });
  const typeCtx = document.getElementById('assetTypeChart');
  if (chartJsReady() && Object.keys(typeCounts).length) {
    if (assetTypeChart) assetTypeChart.destroy();
    assetTypeChart = new Chart(typeCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(typeCounts),
        datasets: [{
          data: Object.values(typeCounts),
          backgroundColor: ['#00A3FF', '#10B981', '#06B6D4', '#F59E0B', '#8B5CF6', '#F43F5E', '#EAB308'],
          borderWidth: 0,
          borderRadius: 4,
          spacing: 3,
        }],
      },
      options: {
        cutout: '72%',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.text, font: { size: 10.5, family: "'IBM Plex Sans', sans-serif" }, boxWidth: 8, padding: 10 },
          },
        },
      },
    });
  }
}

async function loadFleetTrend() {
  const res = await fetch(`/api/maintenance/fleet-trend?${qs()}`);
  const d = await res.json();
  const canvas = document.getElementById('fleetTrendChart');
  if (!chartJsReady() || !d.labels || !d.labels.length) return;
  if (fleetTrendChart) fleetTrendChart.destroy();

  const ctx = canvas.getContext('2d');
  const colors = getThemeColors();

  // Create subtle luminous gradients for lines
  const gradVib = ctx.createLinearGradient(0, 0, 0, 240);
  gradVib.addColorStop(0, 'rgba(244, 63, 94, 0.28)');
  gradVib.addColorStop(1, 'rgba(244, 63, 94, 0.00)');

  const gradTemp = ctx.createLinearGradient(0, 0, 0, 240);
  gradTemp.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
  gradTemp.addColorStop(1, 'rgba(6, 182, 212, 0.00)');

  fleetTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        {
          label: 'Avg Vibration (mm/s)',
          data: d.avg_vibration,
          borderColor: '#F43F5E',
          backgroundColor: gradVib,
          tension: 0.38,
          borderWidth: 2.2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#F43F5E',
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Avg Temperature (°C)',
          data: d.avg_temperature,
          borderColor: '#06B6D4',
          backgroundColor: gradTemp,
          tension: 0.38,
          borderWidth: 2.2,
          pointRadius: 2.5,
          pointHoverRadius: 5,
          pointBackgroundColor: '#06B6D4',
          fill: true,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: colors.text,
            font: { size: 11, family: "'IBM Plex Sans', sans-serif" },
            boxWidth: 10,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } },
          grid: { color: colors.grid },
        },
        y: {
          position: 'left',
          ticks: { color: '#F43F5E', font: { size: 10, family: "'IBM Plex Mono', monospace" } },
          grid: { color: colors.grid },
          title: { display: true, text: 'Vibration (mm/s)', color: colors.text, font: { size: 10 } },
        },
        y1: {
          position: 'right',
          ticks: { color: '#06B6D4', font: { size: 10, family: "'IBM Plex Mono', monospace" } },
          grid: { display: false },
          title: { display: true, text: 'Temp (°C)', color: colors.text, font: { size: 10 } },
        },
      },
    },
  });
}

function trendIcon(trend) {
  if (trend === 'worsening') return '↗';
  if (trend === 'improving') return '↘';
  return '→';
}

async function loadWorkOrders() {
  const res = await fetch(`/api/maintenance/work-orders?${qs()}`);
  const d = await res.json();
  document.getElementById('workOrderCountTag').textContent = `${d.length} DISPATCH DIRECTIVES`;
  const body = document.getElementById('workOrderTable');
  if (!d.length) {
    body.innerHTML = '<tr><td colspan="5" class="loading-note">No open work orders — all plant assets within nominal thresholds.</td></tr>';
    return;
  }
  body.innerHTML = d.map(o => `
    <tr>
      <td><span class="badge ${o.priority}">${o.priority}</span></td>
      <td style="font-family:'IBM Plex Mono',monospace; font-weight:600;">${o.asset_name}</td>
      <td style="color:var(--text-muted); font-size:12px;">${o.asset_type}</td>
      <td>${o.reason}</td>
      <td style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--text-muted);">${o.due}</td>
    </tr>`).join('');
}

function setupFilterChips() {
  const chips = document.querySelectorAll('#assetFilterChips .chart-chip-btn');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentAssetFilter = chip.getAttribute('data-filter') || 'all';
      renderAssetChart();
    });
  });
}

function refreshAll() {
  loadSummary();
  loadAssets();
  loadFleetTrend();
  loadWorkOrders();
}

facilitySelect.addEventListener('change', refreshAll);
setupFilterChips();
refreshAll();
setInterval(refreshAll, 60000);
