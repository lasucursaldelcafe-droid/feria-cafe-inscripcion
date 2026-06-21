/**
 * Registro ligero de visitas en hoja Analytics vía Apps Script.
 * No rastrea rutas /admin.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'lsc_analytics_sid';
  var TRACKED_KEY = 'lsc_pv_tracked';

  function getWebAppUrl() {
    var cfg = global.SHEETS_CONFIG || {};
    return (cfg.WEB_APP_URL || '').trim();
  }

  function isAdminPath() {
    var path = (global.location.pathname || '').toLowerCase();
    return path.indexOf('admin') !== -1;
  }

  function getSessionId() {
    try {
      var sid = sessionStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch (e) {
      return 's_fallback';
    }
  }

  function trackPageview() {
    if (isAdminPath()) return;

    var url = getWebAppUrl();
    if (!url || url.indexOf('TU_ID_DE_DEPLOYMENT') !== -1) return;

    var path = global.location.pathname + (global.location.search || '');
    var dedupeKey = path + '|' + global.location.hostname;
    try {
      if (sessionStorage.getItem(TRACKED_KEY) === dedupeKey) return;
      sessionStorage.setItem(TRACKED_KEY, dedupeKey);
    } catch (e) { /* continuar */ }

    var payload = {
      action: 'pageview',
      path: path,
      title: document.title || '',
      timestamp: new Date().toISOString(),
      referrer: document.referrer || '',
      sessionId: getSessionId(),
      userAgent: (navigator.userAgent || '').substring(0, 120)
    };

    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () { /* silencioso */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageview);
  } else {
    trackPageview();
  }
})(window);
