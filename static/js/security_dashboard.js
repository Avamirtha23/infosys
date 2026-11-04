const facilitySelect = document.getElementById('facilitySelect') || { value: '', addEventListener: () => {} };
const daysSelect = document.getElementById('daysSelect') || { value: '14', addEventListener: () => {} };

let severityDonut, zoneRiskChart, unauthorizedTrendChart, eventTypeChart;

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

function severityColor(sev) {
  return { Critical: '#EF4444', High: '#F59E0B', Medium: '#0EA5E9', Low: '#10B981' }[sev] || '#0EA5E9';
}

async function loadSummary() {
  const res = await fetch(`/api/security/summary?${qs()}`);
  const d = await res.json();
  document.getElementById('kpiEvents').textContent = d.total_events ?? 0;
  document.getElementById('kpiUnauthorized').textContent = d.unauthorized_access_count ?? 0;
  document.getElementById('kpiCritical').textContent = d.critical_events ?? 0;
  document.getElementById('kpiZonesFlagged').textContent = d.zones_flagged ?? 0;
}

async function loadSeverityDistribution() {
  const res = await fetch(`/api/security/severity-distribution?${qs()}`);
  const d = await res.json();
  const container = document.getElementById('severityDistribution');
  const entries = Object.entries(d);
  container.innerHTML = entries.map(([label, pct]) => `
    <div class="bar-row">
      <div class="bar-label"><span>${label}</span><span>${pct}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:${severityColor(label)};"></div></div>
    </div>`).join('');

  const ctx = document.getElementById('severityDonut');
  if (!chartJsReady()) return;
  if (severityDonut) severityDonut.destroy();
  const colors = getThemeColors();
  severityDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: entries.map(e => severityColor(e[0])),
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

async function loadZoneRisk() {
  const res = await fetch(`/api/security/zone-risk?${qs()}`);
  const d = await res.json();
  document.getElementById('zoneRiskTag').textContent = `${d.length} MONITORED ZONES`;

  const ctx = document.getElementById('zoneRiskChart');
  if (!chartJsReady()) return;
  if (zoneRiskChart) zoneRiskChart.destroy();
  const colors = getThemeColors();
  zoneRiskChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: d.map(z => z.zone),
      datasets: [
        { label: 'Critical', data: d.map(z => z.critical), backgroundColor: '#EF4444', stack: 's' },
        { label: 'High', data: d.map(z => z.high), backgroundColor: '#F59E0B', stack: 's' },
        { label: 'Other', data: d.map(z => z.events - z.critical - z.high), backgroundColor: '#00A3FF', stack: 's' },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } } },
      scales: {
        x: { stacked: true, ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { stacked: true, ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { display: false } },
      },
    },
  });
}

async function loadUnauthorizedTrend() {
  const res = await fetch(`/api/security/unauthorized-trend?${qs()}`);
  const d = await res.json();
  const ctx = document.getElementById('unauthorizedTrendChart');
  if (!chartJsReady()) return;
  if (unauthorizedTrendChart) unauthorizedTrendChart.destroy();
  const colors = getThemeColors();
  unauthorizedTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [{
        label: 'Unauthorized-Access Incidents',
        data: d.counts,
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239,68,68,0.12)',
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: colors.text, font: { size: 11, family: "'IBM Plex Sans', sans-serif" } } } },
      scales: {
        x: { ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { beginAtZero: true, ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
      },
    },
  });
}

async function loadEventTypes() {
  const res = await fetch(`/api/security/event-types?${qs()}`);
  const d = await res.json();
  const entries = Object.entries(d);
  const ctx = document.getElementById('eventTypeChart');
  if (!chartJsReady() || !entries.length) return;
  if (eventTypeChart) eventTypeChart.destroy();
  const colors = getThemeColors();
  eventTypeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        label: 'Events',
        data: entries.map(e => e[1]),
        backgroundColor: '#00A3FF',
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: colors.text, font: { size: 9.5, family: "'IBM Plex Mono', monospace" } }, grid: { color: colors.grid } },
        y: { ticks: { color: colors.text, font: { size: 10, family: "'IBM Plex Sans', sans-serif" } }, grid: { display: false } },
      },
    },
  });
}

async function loadEvents() {
  const res = await fetch(`/api/security/events?${qs()}`);
  const d = await res.json();
  const body = document.getElementById('eventTable');
  if (!d.length) {
    body.innerHTML = '<tr><td colspan="6" class="loading-note">No security events logged in this window.</td></tr>';
    return;
  }
  body.innerHTML = d.map(e => `
    <tr>
      <td style="font-family:'IBM Plex Mono',monospace;">${e.timestamp}</td>
      <td style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--accent);">FAC-0${e.facility_id}</td>
      <td style="font-weight:600;">${e.zone ?? '—'}</td>
      <td>${e.event_type}</td>
      <td><span class="badge ${e.severity}">${e.severity}</span></td>
      <td style="color:var(--text-muted); font-size:12px;">${e.details ?? 'Automatic sensor trip'}</td>
    </tr>`).join('');
}

async function loadAlerts() {
  const res = await fetch(`/api/security/alerts?${qs()}`);
  const d = await res.json();
  document.getElementById('alerts').innerHTML = d.map(a => `
    <div class="rec">
      <div class="rec-head">
        <span class="rec-title">${a.title}</span>
        <span class="badge ${a.priority}">${a.priority}</span>
      </div>
      <div class="rec-detail">${a.detail}</div>
    </div>`).join('');
}

function refreshAll() {
  loadSummary();
  loadSeverityDistribution();
  loadZoneRisk();
  loadUnauthorizedTrend();
  loadEventTypes();
  loadEvents();
  loadAlerts();
}

facilitySelect.addEventListener('change', refreshAll);
daysSelect.addEventListener('change', refreshAll);
refreshAll();
setInterval(refreshAll, 60000);
