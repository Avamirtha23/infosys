/**
 * Resilient Chart.js loader with Industrial Theme Integration.
 */
(function () {
  var CDN_SOURCES = [
    '/static/js/vendor/chart.umd.min.js',                                          // bundled locally — no network dependency
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js',       // fallback if the local file is ever missing
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
    'https://unpkg.com/chart.js@4.4.4/dist/chart.umd.min.js',
  ];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = function () {
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(el);
    });
  }

  function tryLoadChart(index) {
    if (index >= CDN_SOURCES.length) {
      return Promise.reject(new Error('All Chart.js sources failed'));
    }
    return loadScript(CDN_SOURCES[index]).catch(function () {
      return tryLoadChart(index + 1);
    });
  }

  function showLoadErrorBanner() {
    var banner = document.createElement('div');
    banner.style.cssText =
      'background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#EF4444;' +
      'padding:12px 18px;border-radius:6px;margin-bottom:20px;font-family:"IBM Plex Sans",sans-serif;font-size:13.5px;';
    banner.textContent =
      'Charts could not load — chart library source was blocked. ' +
      'The telemetry numbers and tables above remain live; only graphical visualizers are affected.';
    var main = document.querySelector('main.main');
    if (main) main.insertBefore(banner, main.firstChild);
  }

  function configureChartDefaults() {
    if (typeof Chart === 'undefined') return;
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var textColor = isLight ? '#64748B' : '#94A3B8';
    var gridColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";

    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = isLight ? '#0F172A' : '#141D2D';
      Chart.defaults.plugins.tooltip.titleColor = '#F1F5F9';
      Chart.defaults.plugins.tooltip.bodyColor = '#CBD5E1';
      Chart.defaults.plugins.tooltip.borderColor = isLight ? '#334155' : '#24354D';
      Chart.defaults.plugins.tooltip.borderWidth = 1;
      Chart.defaults.plugins.tooltip.padding = 10;
      Chart.defaults.plugins.tooltip.cornerRadius = 6;
      Chart.defaults.plugins.tooltip.titleFont = { family: "'IBM Plex Mono', monospace", size: 12, weight: '600' };
      Chart.defaults.plugins.tooltip.bodyFont = { family: "'IBM Plex Sans', sans-serif", size: 11.5 };
    }
  }

  window.loadDashboardScriptAfterChart = function (dashboardScriptSrc) {
    tryLoadChart(0)
      .catch(function (err) {
        console.error(err);
        window.__chartJsUnavailable = true;
        showLoadErrorBanner();
      })
      .then(function () {
        configureChartDefaults();
        return loadScript(dashboardScriptSrc);
      });
  };
})();
