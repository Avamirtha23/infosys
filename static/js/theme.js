/**
 * Industrial FacilityOps Theme Controller
 * Supports Dark Operations Console (default) and Technical Blueprint Light modes.
 */
(function () {
  const STORAGE_KEY = 'facilityops_theme';
  const savedTheme = localStorage.getItem(STORAGE_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  window.getFacilityOpsTheme = function () {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  };

  window.setFacilityOpsTheme = function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateThemeControls();

    // Re-apply Chart defaults and refresh if Chart is present
    if (typeof Chart !== 'undefined') {
      const isLight = theme === 'light';
      Chart.defaults.color = isLight ? '#64748B' : '#94A3B8';
      Chart.defaults.borderColor = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
      if (typeof refreshAll === 'function') {
        try { refreshAll(); } catch (e) { /* ignore */ }
      }
    }
  };

  window.toggleFacilityOpsTheme = function () {
    const current = window.getFacilityOpsTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    window.setFacilityOpsTheme(next);
  };

  function updateThemeControls() {
    const current = window.getFacilityOpsTheme();
    // Segmented buttons
    const segments = document.querySelectorAll('.theme-switch-btn');
    segments.forEach(btn => {
      const val = btn.getAttribute('data-theme-set');
      if (val === current) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Legacy buttons if present
    const isDark = current === 'dark';
    const btns = document.querySelectorAll('.theme-toggle-btn');
    btns.forEach(btn => {
      btn.innerHTML = isDark
        ? '<span class="toggle-icon">☀️</span> <span class="toggle-text">Blueprint Light</span>'
        : '<span class="toggle-icon">🌙</span> <span class="toggle-text">Dark Console</span>';
    });
  }

  document.addEventListener('DOMContentLoaded', updateThemeControls);
})();
