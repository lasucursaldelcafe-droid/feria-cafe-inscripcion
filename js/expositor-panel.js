/**
 * Panel expositor — login con correo + código de acceso (sin OAuth).
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'feria_expositor_session';

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function driveThumb(url) {
    if (!url) return '';
    var m = String(url).match(/\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400';
    return url;
  }

  function getSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function showLogin() {
    $('expositorLogin').hidden = false;
    $('expositorPanel').hidden = true;
  }

  function showPanel() {
    $('expositorLogin').hidden = true;
    $('expositorPanel').hidden = false;
  }

  function setLoginError(msg) {
    var el = $('loginError');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('visible', !!msg);
  }

  function renderStand(stand) {
    var grid = $('standDetails');
    if (!grid || !stand) return;

    var logoHtml = '';
    if (stand.logoEnlace) {
      logoHtml =
        '<div class="expositor-logo-preview"><img src="' +
        escapeHtml(driveThumb(stand.logoEnlace)) +
        '" alt="Logo ' +
        escapeHtml(stand.marca) +
        '" loading="lazy" referrerpolicy="no-referrer"></div>';
    }

    var rows = [
      ['Referencia', stand.id || '—'],
      ['Marca', stand.marca || '—'],
      ['Stand', stand.standId || 'Sin stand asignado en mapa'],
      ['Plan', stand.plan || '—'],
      ['Estado', '<span class="expositor-status">' + escapeHtml(stand.estado || 'Solicitud recibida') + '</span>'],
      ['Contacto', stand.contacto || '—'],
      ['Ciudad', stand.ciudad || '—'],
      ['Descripción', stand.descripcion || '—']
    ];

    grid.innerHTML =
      '<dl class="expositor-stand-grid">' +
      rows.map(function (pair) {
        return (
          '<div class="expositor-stand-row"><dt>' +
          escapeHtml(pair[0]) +
          '</dt><dd>' +
          pair[1] +
          '</dd></div>'
        );
      }).join('') +
      '</dl>' +
      logoHtml;
  }

  function renderFeed(items) {
    var root = $('feedList');
    if (!root) return;

    if (!items || !items.length) {
      root.innerHTML = '<p class="expositor-feed-empty">Aún no hay novedades publicadas. Vuelve pronto.</p>';
      return;
    }

    root.innerHTML =
      '<div class="expositor-feed">' +
      items
        .map(function (item) {
          return (
            '<article class="expositor-feed-item">' +
            '<h3>' +
            escapeHtml(item.titulo || 'Actualización') +
            '</h3>' +
            '<time datetime="' +
            escapeHtml(item.timestamp) +
            '">' +
            escapeHtml(formatDate(item.timestamp)) +
            '</time>' +
            '<p>' +
            escapeHtml(item.cuerpo || '') +
            '</p>' +
            '</article>'
          );
        })
        .join('') +
      '</div>';
  }

  function loadFeed() {
    var feedStatus = $('feedStatus');
    if (feedStatus) feedStatus.textContent = 'Cargando novedades…';

    if (!global.FormSubmit || !FormSubmit.fetchExpositorFeed) {
      renderFeed([]);
      if (feedStatus) feedStatus.textContent = '';
      return;
    }

    FormSubmit.fetchExpositorFeed().then(function (data) {
      if (feedStatus) feedStatus.textContent = '';
      if (data && data.ok && Array.isArray(data.items)) {
        renderFeed(data.items);
      } else {
        renderFeed([]);
      }
    });
  }

  function enterPanel(session) {
    var emailEl = $('sessionEmail');
    if (emailEl) emailEl.textContent = session.email || '';
    renderStand(session.stand);
    showPanel();
    loadFeed();
  }

  function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginError('');

    var emailInput = $('loginEmail');
    var codeInput = $('loginAccessCode');
    var btn = $('loginSubmit');
    var email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    var code = codeInput ? codeInput.value.trim() : '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setLoginError('Ingresa un correo electrónico válido.');
      if (emailInput) emailInput.setAttribute('aria-invalid', 'true');
      return;
    }
    if (emailInput) emailInput.setAttribute('aria-invalid', 'false');

    if (!code || code.length < 6) {
      setLoginError('Ingresa el código de acceso de 8 caracteres que recibiste por correo.');
      if (codeInput) codeInput.setAttribute('aria-invalid', 'true');
      return;
    }
    if (codeInput) codeInput.setAttribute('aria-invalid', 'false');

    if (!FormSubmit || !FormSubmit.isConfigured || !FormSubmit.isConfigured()) {
      setLoginError('El panel no está conectado al servidor. Intenta más tarde.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verificando…';
    }

    FormSubmit.expositorLogin(email, code).then(function (result) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Entrar a mi panel';
      }
      if (!result || !result.ok || !result.stand) {
        setLoginError((result && result.error) || 'No pudimos verificar tus datos. Revisa correo y código.');
        return;
      }
      var session = { email: email, stand: result.stand, loggedAt: new Date().toISOString() };
      saveSession(session);
      enterPanel(session);
    });
  }

  function initContact() {
    var cfg = global.EVENT_CONFIG || {};
    var contact = cfg.contact || {};
    var wa = $('expWaContact');
    var mail = $('expEmailContact');
    if (wa && contact.whatsapp) {
      wa.href = 'https://wa.me/' + String(contact.whatsapp).replace(/\D/g, '');
    }
    if (mail && contact.email) {
      mail.href = 'mailto:' + contact.email;
      mail.textContent = contact.email;
    }
  }

  function prefillFromQuery() {
    var params = new URLSearchParams(global.location.search);
    var email = params.get('email');
    var code = params.get('code');
    var emailInput = $('loginEmail');
    var codeInput = $('loginAccessCode');
    if (email && emailInput) emailInput.value = decodeURIComponent(email);
    if (code && codeInput) codeInput.value = decodeURIComponent(code);
  }

  function bindEvents() {
    var form = $('expositorLoginForm');
    if (form) form.addEventListener('submit', handleLoginSubmit);

    var logoutBtn = $('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        clearSession();
        showLogin();
        setLoginError('');
      });
    }

    var refreshBtn = $('refreshFeedBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadFeed);
  }

  function init() {
    initContact();
    prefillFromQuery();
    bindEvents();

    var session = getSession();
    if (session && session.stand) {
      enterPanel(session);
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
