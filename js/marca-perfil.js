/**
 * Subpágina pública de marca / emprendimiento dentro del directorio /marcas.
 */
(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function driveImageUrl(url, size) {
    if (!url) return '';
    var m = String(url).match(/\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 800);
    return url;
  }

  function initials(name) {
    return String(name || '')
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0); })
      .join('')
      .toUpperCase();
  }

  function resolveMarcaId() {
    var params = new URLSearchParams(global.location.search);
    var fromQuery = params.get('id');
    if (fromQuery) return fromQuery.trim();

    var parts = global.location.pathname.split('/').filter(Boolean);
    var marcasIdx = parts.indexOf('marcas');
    if (marcasIdx >= 0 && parts[marcasIdx + 1]) {
      return decodeURIComponent(parts[marcasIdx + 1]);
    }
    return '';
  }

  function setStatus(msg) {
    var el = document.getElementById('marcaPerfilStatus');
    if (el) el.textContent = msg || '';
  }

  function showError(msg) {
    setStatus('');
    var box = document.getElementById('marcaPerfilError');
    var msgEl = document.getElementById('marcaPerfilErrorMsg');
    var article = document.getElementById('marcaPerfil');
    if (article) article.hidden = true;
    if (msgEl) msgEl.textContent = msg;
    if (box) box.hidden = false;
  }

  function primaryLogo(participante) {
    var logos = participante.logos || [];
    for (var i = 0; i < logos.length; i++) {
      if (logos[i].url) return logos[i];
    }
    return logos[0] || null;
  }

  function renderAvatar(participante) {
    var root = document.getElementById('marcaPerfilAvatar');
    if (!root) return;

    var logo = primaryLogo(participante);
    if (logo && logo.url) {
      root.innerHTML = '<img src="' + escapeHtml(driveImageUrl(logo.url, 400)) + '" alt="' +
        escapeHtml(participante.marca || 'Logo') + '" width="120" height="120" loading="eager">';
      return;
    }
    root.innerHTML = '<span class="marca-perfil-avatar-placeholder">' + escapeHtml(initials(participante.marca)) + '</span>';
  }

  function renderParticipante(p) {
    var perfil = p.perfil || {};
    document.title = (p.marca || 'Marca') + ' | La Sucursal del Café';

    var breadcrumb = document.getElementById('marcaPerfilBreadcrumb');
    if (breadcrumb) breadcrumb.textContent = p.marca || 'Perfil';

    var badge = document.getElementById('marcaPerfilBadge');
    if (badge) {
      badge.textContent = p.tipo || 'Marca';
      badge.className = 'festival-sponsor-card__badge festival-sponsor-card__badge--' +
        escapeHtml(String(p.tipo || 'marca').toLowerCase());
    }

    var title = document.getElementById('marcaPerfilTitle');
    if (title) title.textContent = p.marca || 'Marca';

    var tagline = document.getElementById('marcaPerfilTagline');
    if (tagline) {
      var tag = p.tagline || perfil.tagline || '';
      tagline.textContent = tag;
      tagline.hidden = !tag;
    }

    var standEl = document.getElementById('marcaPerfilStand');
    if (standEl) {
      standEl.textContent = p.standId ? 'Stand ' + p.standId : '';
      standEl.hidden = !p.standId;
    }

    var ciudadEl = document.getElementById('marcaPerfilCiudad');
    if (ciudadEl) {
      ciudadEl.textContent = p.ciudad || '';
      ciudadEl.hidden = !p.ciudad;
    }

    var social = document.getElementById('marcaPerfilSocial');
    if (social) {
      if (p.redUrl) {
        social.href = p.redUrl;
        social.textContent = p.redSocial || 'Ver red social';
        social.hidden = false;
      } else {
        social.hidden = true;
      }
    }

    renderAvatar(p);

    var descBlock = document.getElementById('marcaPerfilDescripcion');
    if (descBlock) {
      if (p.descripcion) {
        descBlock.innerHTML = '<h2 class="marca-perfil-block__title">Sobre nosotros</h2><p>' + escapeHtml(p.descripcion) + '</p>';
        descBlock.hidden = false;
      } else {
        descBlock.hidden = true;
      }
    }

    var historiaBlock = document.getElementById('marcaPerfilHistoria');
    if (historiaBlock) {
      if (perfil.historia) {
        historiaBlock.innerHTML = '<h2 class="marca-perfil-block__title">Nuestra historia</h2><p>' + escapeHtml(perfil.historia) + '</p>';
        historiaBlock.hidden = false;
      } else {
        historiaBlock.hidden = true;
      }
    }

    var galeriaSection = document.getElementById('marcaPerfilGaleria');
    var galeriaGrid = document.getElementById('marcaPerfilGaleriaGrid');
    var fotos = Array.isArray(perfil.fotos) ? perfil.fotos : [];
    if (galeriaSection && galeriaGrid) {
      if (fotos.length) {
        galeriaGrid.innerHTML = fotos.map(function (foto) {
          return '<figure class="marca-perfil-galeria__item">' +
            '<img src="' + escapeHtml(driveImageUrl(foto.url, 900)) + '" alt="' + escapeHtml(foto.caption || p.marca) + '" loading="lazy">' +
            (foto.caption ? '<figcaption>' + escapeHtml(foto.caption) + '</figcaption>' : '') +
            '</figure>';
        }).join('');
        galeriaSection.hidden = false;
      } else {
        galeriaSection.hidden = true;
      }
    }

    var productosSection = document.getElementById('marcaPerfilProductos');
    var productosGrid = document.getElementById('marcaPerfilProductosGrid');
    var productos = Array.isArray(perfil.productos) ? perfil.productos : [];
    if (productosSection && productosGrid) {
      if (productos.length) {
        productosGrid.innerHTML = productos.map(function (prod) {
          var img = prod.fotoUrl
            ? '<img class="marca-perfil-producto__img" src="' + escapeHtml(driveImageUrl(prod.fotoUrl, 600)) + '" alt="' + escapeHtml(prod.nombre) + '" loading="lazy">'
            : '<div class="marca-perfil-producto__img marca-perfil-producto__img--placeholder" aria-hidden="true">☕</div>';
          return '<article class="marca-perfil-producto">' + img +
            '<h3>' + escapeHtml(prod.nombre) + '</h3>' +
            (prod.precio ? '<p class="marca-perfil-producto__precio">' + escapeHtml(prod.precio) + '</p>' : '') +
            (prod.descripcion ? '<p>' + escapeHtml(prod.descripcion) + '</p>' : '') +
            '</article>';
        }).join('');
        productosSection.hidden = false;
      } else {
        productosSection.hidden = true;
      }
    }

    setStatus('');
    var article = document.getElementById('marcaPerfil');
    if (article) article.hidden = false;
  }

  function loadPerfil() {
    var id = resolveMarcaId();
    if (!id) {
      showError('No encontramos esta marca. El enlace puede estar incompleto.');
      return;
    }

    if (!global.FormSubmit || typeof global.FormSubmit.fetchParticipantePublico !== 'function') {
      showError('El directorio no está disponible en este momento.');
      return;
    }

    global.FormSubmit.fetchParticipantePublico(id).then(function (data) {
      if (!data || !data.ok || !data.participante) {
        showError((data && data.error) || 'No pudimos cargar el perfil de esta marca.');
        return;
      }
      renderParticipante(data.participante);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPerfil);
  } else {
    loadPerfil();
  }
})(window);
