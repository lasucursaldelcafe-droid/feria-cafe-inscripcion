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
        '<img class="festival-sponsor-card__avatar" src="' +
        escapeHtml(logo.url) +
        '" alt="' +
        alt +
        '" width="72" height="72" loading="lazy">';
    } else {
      avatar =
        '<span class="festival-sponsor-card__avatar festival-sponsor-card__avatar--placeholder" aria-hidden="true">' +
        escapeHtml(initials(participante.marca)) +
        '</span>';
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

    return (
      '<li class="festival-sponsor-card festival-sponsor-card--directory">' +
      '<article class="festival-sponsor-card__link">' +
      avatar +
      badge +
      '<span class="festival-sponsor-card__name">' +
      name +
      '</span>' +
      standHint +
      descBlock +
      socialBlock +
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
