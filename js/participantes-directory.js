/**
 * Directorio público de marcas (expositores, patrocinadores, aliados).
 * GET ?action=participantes_publico
 */
(function (global) {
  'use strict';

  var TIPO_LABELS = {
    expositor: 'Expositor',
    patrocinador: 'Patrocinador',
    aliado: 'Aliado'
  };

  var SOCIAL_LABELS = {
    Instagram: 'Instagram',
    Facebook: 'Facebook',
    TikTok: 'TikTok',
    Web: 'Sitio web',
    WhatsApp: 'WhatsApp',
    Otro: 'Enlace'
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0);
      })
      .join('')
      .toUpperCase();
  }

  function driveImageUrl(url, size) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    var match =
      raw.match(/\/file\/d\/([^/]+)/) ||
      raw.match(/[?&]id=([^&]+)/) ||
      raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return (
        'https://drive.google.com/thumbnail?id=' +
        encodeURIComponent(match[1]) +
        '&sz=w' +
        (size || 400)
      );
    }
    if (/^https?:\/\//i.test(raw)) return raw;
    return raw;
  }

  function resolveLogoUrl(logo) {
    if (!logo || !logo.url) return '';
    return driveImageUrl(logo.url, 320);
  }

  function tipoLabel(tipo) {
    var key = String(tipo || '').trim().toLowerCase();
    return TIPO_LABELS[key] || (tipo ? escapeHtml(tipo) : 'Marca');
  }

  function socialLabel(redSocial) {
    return SOCIAL_LABELS[String(redSocial || '').trim()] || 'Red social';
  }

  function primaryLogo(participante) {
    var logos = participante.logos || [];
    if (logos.length && logos[0].url) return logos[0];
    for (var i = 0; i < logos.length; i++) {
      if (logos[i].url) return logos[i];
    }
    return logos[0] || null;
  }

  function renderCard(participante) {
    var name = escapeHtml(participante.marca || '');
    var tipo = tipoLabel(participante.tipo);
    var desc = escapeHtml(participante.descripcion || '');
    var redUrl = participante.redUrl || '';
    var redSocial = participante.redSocial || '';
    var logo = primaryLogo(participante);
    var alt = escapeHtml((logo && logo.marca) || participante.marca || 'Marca en la feria');
    var avatar;

    if (logo && logo.url) {
      avatar =
        '<div class="festival-sponsor-card__logo-wrap">' +
        '<img class="festival-sponsor-card__avatar festival-sponsor-card__avatar--logo" src="' +
        escapeHtml(resolveLogoUrl(logo)) +
        '" alt="' +
        alt +
        '" width="128" height="88" loading="lazy" decoding="async">' +
        '</div>';
    } else {
      avatar =
        '<div class="festival-sponsor-card__logo-wrap">' +
        '<span class="festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder" aria-hidden="true">' +
        escapeHtml(initials(participante.marca)) +
        '</span></div>';
    }

    var badge =
      '<span class="festival-sponsor-card__badge festival-sponsor-card__badge--' +
      escapeHtml(String(participante.tipo || 'marca').toLowerCase()) +
      '">' +
      tipo +
      '</span>';

    var descBlock = desc
      ? '<p class="festival-sponsor-card__desc">' + desc + '</p>'
      : '';

    var socialBlock = '';
    if (redUrl) {
      socialBlock =
        '<a class="festival-sponsor-card__social" href="' +
        escapeHtml(redUrl) +
        '" target="_blank" rel="noopener noreferrer" aria-label="' +
        escapeHtml(socialLabel(redSocial) + ' de ' + (participante.marca || 'marca')) +
        '">' +
        escapeHtml(socialLabel(redSocial)) +
        '</a>';
    }

    var standHint = participante.standId
      ? '<span class="festival-sponsor-card__stand">Stand ' + escapeHtml(participante.standId) + '</span>'
      : '';

    var perfilLink = participante.perfilUrl || (participante.id && global.SiteLinks
      ? global.SiteLinks.absUrl('marcas') + '/' + encodeURIComponent(participante.id)
      : '');
    var taglineBlock = participante.tagline
      ? '<p class="festival-sponsor-card__tagline">' + escapeHtml(participante.tagline) + '</p>'
      : '';
    var verPerfil = perfilLink
      ? '<a class="festival-sponsor-card__profile-link" href="' + escapeHtml(perfilLink) + '">Ver perfil' +
        (participante.tienePerfil ? ' completo' : '') + ' →</a>'
      : '';

    return (
      '<li class="festival-sponsor-card festival-sponsor-card--directory">' +
      '<article class="festival-sponsor-card__link">' +
      avatar +
      badge +
      '<span class="festival-sponsor-card__name">' +
      name +
      '</span>' +
      standHint +
      taglineBlock +
      descBlock +
      socialBlock +
      verPerfil +
      '</article></li>'
    );
  }

  function setStatus(message) {
    var el = document.getElementById('marcasDirectoryStatus');
    if (el) el.textContent = message || '';
  }

  function setEmptyVisible(show) {
    var el = document.getElementById('marcasDirectoryEmpty');
    if (el) el.hidden = !show;
  }

  function bindAvatarFallbacks(root) {
    if (!root) return;
    root.querySelectorAll('img.festival-sponsor-card__avatar--logo').forEach(function (img) {
      img.addEventListener('error', function onAvatarError() {
        img.removeEventListener('error', onAvatarError);
        var span = document.createElement('span');
        span.className =
          'festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = initials(img.getAttribute('alt') || '');
        img.replaceWith(span);
      });
    });
  }

  function renderList(participantes) {
    var grid = document.querySelector('[data-participantes-grid]');
    if (!grid) return;

    if (!participantes.length) {
      grid.innerHTML = '';
      setEmptyVisible(true);
      setStatus('');
      return;
    }

    setEmptyVisible(false);
    grid.innerHTML = participantes.map(renderCard).join('');
    bindAvatarFallbacks(grid);
    setStatus(participantes.length + ' marca' + (participantes.length === 1 ? '' : 's') + ' en el directorio.');
  }

  function loadDirectory() {
    setStatus('Cargando marcas…');
    setEmptyVisible(false);

    if (!global.FormSubmit || typeof global.FormSubmit.fetchParticipantesPublico !== 'function') {
      setStatus('');
      setEmptyVisible(true);
      return;
    }

    global.FormSubmit.fetchParticipantesPublico().then(function (data) {
      if (!data.ok) {
        setStatus(data.reason === 'no_url'
          ? 'Directorio no disponible en modo local. Configura Apps Script para ver marcas confirmadas.'
          : (data.error || 'No se pudo cargar el directorio.'));
        setEmptyVisible(true);
        return;
      }
      renderList(data.participantes || []);
    });
  }

  function init() {
    loadDirectory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.ParticipantesDirectory = {
    reload: loadDirectory,
    renderList: renderList
  };
})(window);
