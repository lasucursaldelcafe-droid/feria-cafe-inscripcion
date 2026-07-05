/**
 * Formulario de inscripción en línea por torneo (white-label).
 * URL: /competencia/torneo?evt=slug-del-torneo
 */
(function () {
  'use strict';

  var tenantSlug = '';
  var formConfig = null;

  function $(id) {
    return document.getElementById(id);
  }

  function initTenantFromUrl() {
    try {
      var raw = String(new URLSearchParams(window.location.search).get('evt') || '').trim().toLowerCase();
      if (raw && /^[a-z0-9][a-z0-9-]{0,48}$/.test(raw)) tenantSlug = raw;
    } catch (e) { tenantSlug = ''; }
  }

  function webAppUrl() {
    return String((window.SHEETS_CONFIG || {}).WEB_APP_URL || '').trim();
  }

  function sheetsGet(action, params) {
    var url = new URL(webAppUrl());
    url.searchParams.set('action', action);
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] != null && params[k] !== '') url.searchParams.set(k, params[k]);
    });
    return fetch(url.toString(), { cache: 'no-store', redirect: 'follow' }).then(function (r) { return r.json(); });
  }

  function sheetsPost(body) {
    var url = webAppUrl();
    if (!url) return Promise.reject(new Error('Backend no configurado.'));
    return fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (r) { return r.json(); });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function applyBranding(cfg) {
    if (!cfg || !cfg.evento) return;
    var ev = cfg.evento;
    if (ev.nombre) {
      $('headerTitle').textContent = ev.nombre;
      document.title = ev.nombre + ' — Inscripción';
    }
    if (ev.subtitulo) $('headerSubtitle').textContent = ev.subtitulo;
    if (ev.organizador) $('headerKicker').textContent = ev.organizador;
    if (ev.logoUrl) $('headerLogo').src = ev.logoUrl;
    if (ev.accentColor) document.documentElement.style.setProperty('--jurado-accent', ev.accentColor);
    if (ev.primaryColor) document.documentElement.style.setProperty('--jurado-primary', ev.primaryColor);
  }

  function renderMeta(cfg) {
    var reg = cfg.registration || {};
    var badges = $('torneoBadges');
    if (badges) {
      var items = [];
      if (reg.fecha) items.push('📅 ' + reg.fecha);
      if (reg.hora) items.push('🕠 ' + reg.hora);
      if (reg.lugar) items.push('📍 ' + reg.lugar);
      if (reg.fee) items.push(reg.fee);
      badges.innerHTML = items.map(function (t) {
        return '<span class="jurado-hub-tag">' + escapeHtml(t) + '</span>';
      }).join('');
    }
    var cupoMsg = $('torneoCupoMsg');
    if (cupoMsg) {
      cupoMsg.textContent = reg.completo
        ? 'Cupo completo (' + reg.inscritos + '/' + reg.cupo + ').'
        : 'Cupo: ' + (reg.disponibles != null ? reg.disponibles : '—') + ' disponible(s) de ' + reg.cupo;
    }
    $('torneoMeta').hidden = false;
  }

  function renderFields(fields) {
    var root = $('torneoFieldsRoot');
    if (!root) return;
    root.innerHTML = fields.map(function (f) {
      var id = 'field_' + f.key;
      var req = f.required ? ' required' : '';
      var ph = f.placeholder ? ' placeholder="' + escapeHtml(f.placeholder) + '"' : '';
      var label = escapeHtml(f.label) + (f.required ? ' *' : '');
      if (f.type === 'textarea') {
        return '<div class="jurado-field"><label for="' + id + '">' + label + '</label>' +
          '<textarea id="' + id + '" name="' + escapeHtml(f.key) + '" rows="3"' + req + ph + '></textarea></div>';
      }
      var inputType = f.type === 'email' || f.type === 'tel' || f.type === 'number' ? f.type : 'text';
      return '<div class="jurado-field"><label for="' + id + '">' + label + '</label>' +
        '<input type="' + inputType + '" id="' + id + '" name="' + escapeHtml(f.key) + '"' + req + ph + '></div>';
    }).join('');
  }

  function showForm(cfg) {
    formConfig = cfg;
    applyBranding(cfg);
    renderMeta(cfg);
    var reg = cfg.registration || {};
    if ($('formTitle')) $('formTitle').textContent = reg.title || 'Datos del competidor';
    var regWrap = $('reglamentoLinkWrap');
    if (regWrap && reg.reglamentoUrl) {
      regWrap.innerHTML = '(<a href="' + escapeHtml(reg.reglamentoUrl) + '" target="_blank" rel="noopener">ver reglamento</a>)';
    }
    renderFields(cfg.formFields || []);
    $('loadingMsg').hidden = true;
    if (reg.completo) {
      $('torneoFormSection').hidden = true;
      $('torneoErrorSection').hidden = false;
      $('torneoLoadError').textContent = 'El cupo de este torneo está completo.';
      return;
    }
    $('torneoFormSection').hidden = false;
  }

  function showLoadError(msg) {
    $('loadingMsg').hidden = true;
    $('torneoFormSection').hidden = true;
    $('torneoErrorSection').hidden = false;
    $('torneoLoadError').textContent = msg || 'No se pudo cargar el formulario.';
  }

  function collectFormData() {
    var data = {};
    (formConfig.formFields || []).forEach(function (f) {
      var el = document.querySelector('[name="' + f.key + '"]');
      data[f.key] = el ? el.value.trim() : '';
    });
    return data;
  }

  function bindForm() {
    var form = $('torneoInscripcionForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('torneoFormError');
      if (err) err.hidden = true;
      var btn = $('torneoSubmitBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
      sheetsPost({
        action: 'competencia_torneo_inscripcion',
        evt: tenantSlug,
        acepta_datos: $('aceptaDatos') && $('aceptaDatos').checked,
        acepta_reglas: $('aceptaReglas') && $('aceptaReglas').checked,
        data: collectFormData()
      }).then(function (res) {
        if (!res || res.ok === false) throw new Error((res && res.error) || 'No se pudo enviar.');
        $('torneoFormSection').hidden = true;
        $('torneoMeta').hidden = true;
        $('torneoSuccessSection').hidden = false;
        $('torneoSuccessMsg').textContent = 'Gracias, ' + (res.nombre || '') + '. Tu inscripción fue registrada. ID: ' + (res.id || '—');
      }).catch(function (ex) {
        if (err) { err.textContent = ex.message || 'Error al enviar.'; err.hidden = false; }
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar inscripción'; }
      });
    });
  }

  function init() {
    initTenantFromUrl();
    bindForm();
    if (!tenantSlug) {
      showLoadError('Falta el identificador del torneo (?evt=…). Usa el enlace que te compartió el organizador.');
      return;
    }
    sheetsGet('competencia_torneo_form', { evt: tenantSlug }).then(function (data) {
      if (!data || data.ok === false) throw new Error((data && data.error) || 'Torneo no encontrado.');
      showForm(data);
    }).catch(function (ex) {
      showLoadError(ex.message);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
