/**
 * Panel expositor — login con correo + código de acceso (sin OAuth).
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'feria_expositor_session';
  var REMEMBER_KEY = 'feria_expositor_remember';
  var ONBOARDING_KEY = 'feria_expositor_onboarding_dismissed';
  var MAX_FOTOS = 12;
  var MAX_PRODUCTOS = 24;

  var profileState = {
    fotosEliminar: [],
    fotosNuevas: [],
    productos: [],
    logoNuevo: null
  };

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

  function shouldRememberDevice() {
    try {
      var pref = localStorage.getItem(REMEMBER_KEY);
      if (pref === '0') return false;
      if (pref === '1') return true;
    } catch (e) { /* ignore */ }
    var checkbox = $('loginRemember');
    return !checkbox || checkbox.checked;
  }

  function getSessionStorage() {
    if (shouldRememberDevice()) {
      try {
        return localStorage;
      } catch (e) {
        return sessionStorage;
      }
    }
    return sessionStorage;
  }

  function getSession() {
    try {
      var storages = shouldRememberDevice()
        ? [localStorage, sessionStorage]
        : [sessionStorage, localStorage];
      for (var i = 0; i < storages.length; i++) {
        var raw = storages[i].getItem(SESSION_KEY);
        if (raw) return JSON.parse(raw);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(session, remember) {
    var rememberDevice = remember !== undefined ? !!remember : shouldRememberDevice();
    try {
      if (rememberDevice) {
        localStorage.setItem(REMEMBER_KEY, '1');
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        localStorage.setItem(REMEMBER_KEY, '0');
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setProfileError(msg) {
    var el = $('profileSaveError');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('visible', !!msg);
  }

  function setProfileStatus(msg) {
    var el = $('profileSaveStatus');
    if (el) el.textContent = msg || '';
  }

  function renderProfileFotos(fotos) {
    var grid = $('profileFotosGrid');
    if (!grid) return;

    var existentes = (fotos || []).filter(function (f) {
      return profileState.fotosEliminar.indexOf(f.id) === -1;
    });

    var html = existentes.map(function (foto) {
      return (
        '<figure class="expositor-media-item">' +
        '<img src="' + escapeHtml(driveThumb(foto.url)) + '" alt="">' +
        '<button type="button" class="expositor-media-remove" data-foto-id="' + escapeHtml(foto.id) + '">Quitar</button>' +
        '</figure>'
      );
    }).join('');

    html += profileState.fotosNuevas.map(function (foto, idx) {
      return (
        '<figure class="expositor-media-item expositor-media-item--new">' +
        '<img src="' + escapeHtml(foto.preview) + '" alt="Nueva foto">' +
        '<button type="button" class="expositor-media-remove" data-foto-nueva="' + idx + '">Quitar</button>' +
        '</figure>'
      );
    }).join('');

    grid.innerHTML = html || '<p class="expositor-hint">Aún no hay fotos. Sube imágenes de tu emprendimiento.</p>';

    grid.querySelectorAll('[data-foto-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-foto-id');
        if (id && profileState.fotosEliminar.indexOf(id) === -1) {
          profileState.fotosEliminar.push(id);
        }
        renderProfileFotos(fotos);
      });
    });

    grid.querySelectorAll('[data-foto-nueva]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-foto-nueva'), 10);
        profileState.fotosNuevas.splice(idx, 1);
        renderProfileFotos(fotos);
      });
    });
  }

  function renderProductosEditor() {
    var root = $('profileProductosList');
    if (!root) return;

    if (!profileState.productos.length) {
      root.innerHTML = '<p class="expositor-hint">Agrega los productos que quieres mostrar en tu página pública.</p>';
      return;
    }

    root.innerHTML = profileState.productos.map(function (prod, idx) {
      return (
        '<div class="expositor-producto-edit" data-producto-idx="' + idx + '">' +
        '<div class="expositor-field-row">' +
        '<div class="expositor-field"><label>Nombre</label><input type="text" data-field="nombre" value="' + escapeHtml(prod.nombre) + '" maxlength="80"></div>' +
        '<div class="expositor-field"><label>Precio</label><input type="text" data-field="precio" value="' + escapeHtml(prod.precio) + '" maxlength="40" placeholder="Ej. $25.000"></div>' +
        '</div>' +
        '<div class="expositor-field"><label>Descripción</label><textarea data-field="descripcion" rows="2" maxlength="300">' + escapeHtml(prod.descripcion) + '</textarea></div>' +
        '<div class="expositor-field"><label>Foto del producto</label><input type="file" data-field="foto" accept="image/*">' +
        (prod.fotoUrl ? '<img class="expositor-producto-thumb" src="' + escapeHtml(driveThumb(prod.fotoUrl)) + '" alt="">' : '') +
        '</div>' +
        '<button type="button" class="expositor-btn expositor-btn--secondary expositor-producto-remove" data-remove-idx="' + idx + '">Eliminar producto</button>' +
        '</div>'
      );
    }).join('');

    root.querySelectorAll('.expositor-producto-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
        profileState.productos.splice(idx, 1);
        renderProductosEditor();
      });
    });
  }

  function syncProductosFromDom() {
    var root = $('profileProductosList');
    if (!root) return;

    root.querySelectorAll('.expositor-producto-edit').forEach(function (block, idx) {
      if (!profileState.productos[idx]) return;
      var nombre = block.querySelector('[data-field="nombre"]');
      var precio = block.querySelector('[data-field="precio"]');
      var descripcion = block.querySelector('[data-field="descripcion"]');
      if (nombre) profileState.productos[idx].nombre = nombre.value.trim();
      if (precio) profileState.productos[idx].precio = precio.value.trim();
      if (descripcion) profileState.productos[idx].descripcion = descripcion.value.trim();
    });
  }

  function fillProfileForm(stand) {
    var perfil = (stand && stand.perfil) || {};
    profileState.fotosEliminar = [];
    profileState.fotosNuevas = [];
    profileState.logoNuevo = null;
    profileState.productos = Array.isArray(perfil.productos)
      ? perfil.productos.map(function (p) {
        return {
          id: p.id || '',
          nombre: p.nombre || '',
          descripcion: p.descripcion || '',
          precio: p.precio || '',
          fotoUrl: p.fotoUrl || ''
        };
      })
      : [];

    var tagline = $('profileTagline');
    var descripcion = $('profileDescripcion');
    var historia = $('profileHistoria');
    var redSocial = $('profileRedSocial');
    var redUrl = $('profileRedUrl');
    var publicado = $('profilePublicado');
    var viewBtn = $('viewPublicProfileBtn');

    if (tagline) tagline.value = perfil.tagline || '';
    if (descripcion) descripcion.value = stand.descripcion || '';
    if (historia) historia.value = perfil.historia || '';
    if (redSocial) redSocial.value = stand.redSocial || '';
    if (redUrl) redUrl.value = stand.redUrl || '';
    if (publicado) publicado.checked = perfil.publicado !== false;

    if (viewBtn && stand.perfilUrl) {
      viewBtn.href = stand.perfilUrl;
      viewBtn.hidden = false;
    }

    renderProfileFotos(perfil.fotos || []);
    renderProductosEditor();
    setProfileError('');
    setProfileStatus('');
  }

  function handleFotosInput(event) {
    var files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (profileState.fotosNuevas.length + files.length > MAX_FOTOS) {
      setProfileError('Máximo ' + MAX_FOTOS + ' fotos nuevas por guardado.');
      return;
    }

    Promise.all(files.map(function (file) {
      return readFileAsDataUrl(file).then(function (dataUrl) {
        profileState.fotosNuevas.push({
          preview: driveThumb(dataUrl) || dataUrl,
          nombreArchivo: file.name,
          tipoArchivo: file.type,
          base64: dataUrl
        });
      });
    })).then(function () {
      var stand = getSession();
      renderProfileFotos((stand && stand.stand && stand.stand.perfil && stand.stand.perfil.fotos) || []);
      event.target.value = '';
    });
  }

  function handleLogoInput(event) {
    var file = (event.target.files || [])[0];
    if (!file) return;
    readFileAsDataUrl(file).then(function (dataUrl) {
      profileState.logoNuevo = {
        nombreArchivo: file.name,
        tipoArchivo: file.type,
        base64: dataUrl
      };
      setProfileStatus('Logo listo para subir al guardar.');
    });
  }

  function handleAddProducto() {
    if (profileState.productos.length >= MAX_PRODUCTOS) {
      setProfileError('Máximo ' + MAX_PRODUCTOS + ' productos.');
      return;
    }
    syncProductosFromDom();
    profileState.productos.push({
      id: 'p-local-' + Date.now(),
      nombre: '',
      descripcion: '',
      precio: '',
      fotoUrl: ''
    });
    renderProductosEditor();
  }

  function collectProductosPayload() {
    syncProductosFromDom();
    var root = $('profileProductosList');
    var promises = profileState.productos.map(function (prod, idx) {
      var block = root ? root.querySelector('[data-producto-idx="' + idx + '"]') : null;
      var fileInput = block ? block.querySelector('[data-field="foto"]') : null;
      var file = fileInput && fileInput.files && fileInput.files[0];

      var payload = {
        id: prod.id || ('p-' + idx),
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        precio: prod.precio,
        fotoUrl: prod.fotoUrl || ''
      };

      if (!file) return Promise.resolve(payload);

      return readFileAsDataUrl(file).then(function (dataUrl) {
        payload.fotoNueva = {
          nombreArchivo: file.name,
          tipoArchivo: file.type,
          base64: dataUrl
        };
        return payload;
      });
    });

    return Promise.all(promises);
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    setProfileError('');
    setProfileStatus('');

    var session = getSession();
    if (!session || !session.email) {
      setProfileError('Sesión expirada. Vuelve a ingresar.');
      return;
    }

    var accessCodeInput = $('loginAccessCode');
    var accessCode = accessCodeInput && accessCodeInput.value.trim()
      ? accessCodeInput.value.trim()
      : (session.accessCode || '');

    if (!FormSubmit || !FormSubmit.expositorUpdateProfile) {
      setProfileError('El servidor no está configurado.');
      return;
    }

    var btn = $('profileSaveBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    }

    collectProductosPayload().then(function (productos) {
      var profile = {
        tagline: ($('profileTagline') && $('profileTagline').value.trim()) || '',
        historia: ($('profileHistoria') && $('profileHistoria').value.trim()) || '',
        descripcion: ($('profileDescripcion') && $('profileDescripcion').value.trim()) || '',
        redSocial: ($('profileRedSocial') && $('profileRedSocial').value) || '',
        redUrl: ($('profileRedUrl') && $('profileRedUrl').value.trim()) || '',
        publicado: $('profilePublicado') ? $('profilePublicado').checked : true,
        fotosEliminar: profileState.fotosEliminar.slice(),
        fotosNuevas: profileState.fotosNuevas.map(function (f) {
          return {
            nombreArchivo: f.nombreArchivo,
            tipoArchivo: f.tipoArchivo,
            base64: f.base64
          };
        }),
        productos: productos
      };

      if (profileState.logoNuevo) {
        profile.logoNuevo = profileState.logoNuevo;
      }

      return FormSubmit.expositorUpdateProfile(session.email, accessCode, profile);
    }).then(function (result) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar y publicar perfil';
      }
      if (!result || !result.ok || !result.stand) {
        setProfileError((result && result.error) || 'No se pudo guardar el perfil.');
        return;
      }
      session.stand = result.stand;
      if (result.stand.perfilUrl) session.stand.perfilUrl = result.stand.perfilUrl;
      saveSession(session);
      fillProfileForm(result.stand);
      setProfileStatus('Perfil publicado. Ya está visible en /marcas.');
    }).catch(function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar y publicar perfil';
      }
      setProfileError('Error al guardar. Intenta de nuevo.');
    });
  }

  function bindProfileForm() {
    var form = $('expositorProfileForm');
    if (form) form.addEventListener('submit', handleProfileSubmit);

    var fotosInput = $('profileFotosInput');
    if (fotosInput) fotosInput.addEventListener('change', handleFotosInput);

    var logoInput = $('profileLogo');
    if (logoInput) logoInput.addEventListener('change', handleLogoInput);

    var addProd = $('addProductoBtn');
    if (addProd) addProd.addEventListener('click', handleAddProducto);
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
    var logos = Array.isArray(stand.logos) && stand.logos.length
      ? stand.logos
      : (stand.logoEnlace ? [{ marca: stand.marca, logoEnlace: stand.logoEnlace }] : []);
    if (logos.length) {
      logoHtml =
        '<div class="expositor-logos-grid' + (logos.length > 1 ? ' expositor-logos-grid--multi' : '') + '">' +
        logos.map(function (logo) {
          var src = logo.logoEnlace ? driveThumb(logo.logoEnlace) : '';
          if (!src) return '';
          return (
            '<figure class="expositor-logo-preview">' +
            '<img src="' + escapeHtml(src) + '" alt="Logo ' + escapeHtml(logo.marca || stand.marca) + '" loading="lazy" referrerpolicy="no-referrer">' +
            (logo.marca ? '<figcaption>' + escapeHtml(logo.marca) + '</figcaption>' : '') +
            '</figure>'
          );
        }).join('') +
        '</div>';
    }

    var marcasExtraHtml = '';
    if (stand.comparteStand === 'Sí' && Array.isArray(stand.marcasAdicionales) && stand.marcasAdicionales.length) {
      marcasExtraHtml =
        '<p class="expositor-shared-brands"><strong>Marcas que comparten el stand:</strong> ' +
        escapeHtml(stand.marcasAdicionales.map(function (m) { return m.nombre; }).join(', ')) +
        '</p>';
    }

    var rows = [
      ['Referencia', stand.id || '—'],
      ['Marca principal', stand.marca || '—'],
      ['Stand', stand.standId || 'Sin stand asignado en mapa'],
      ['Plan', stand.plan || '—'],
      ['Comparte stand', stand.comparteStand || 'No'],
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
      marcasExtraHtml +
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
    fillProfileForm(session.stand);
    showOnboarding(session.stand);
    showInstallBanner();
    showPanel();
    loadFeed();
  }

  function showOnboarding(stand) {
    var card = $('expositorOnboarding');
    if (!card) return;
    try {
      if (localStorage.getItem(ONBOARDING_KEY) === '1') {
        card.hidden = true;
        return;
      }
    } catch (e) { /* ignore */ }
    card.hidden = false;
    var linkBtn = $('onboardingPublicLink');
    if (linkBtn && stand && stand.perfilUrl) {
      linkBtn.href = stand.perfilUrl;
      linkBtn.hidden = false;
    }
  }

  function dismissOnboarding() {
    var card = $('expositorOnboarding');
    if (card) card.hidden = true;
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch (e) { /* ignore */ }
  }

  function esIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function esStandalone() {
    return global.matchMedia('(display-mode: standalone)').matches ||
      global.navigator.standalone === true;
  }

  function showInstallBanner() {
    if (esStandalone()) return;
    var el = $('expositorInstallBanner');
    if (!el) return;
    var html = '';
    if (esIos()) {
      html = '<div class="expositor-install">' +
        '<strong>Guarda tu panel en el celular</strong>' +
        '<p>Toca <span aria-hidden="true">Compartir</span> ↗ y luego <strong>Añadir a pantalla de inicio</strong>. Así vuelves a tu stand sin volver a escribir el código.</p>' +
        '</div>';
    } else {
      html = '<div class="expositor-install">' +
        '<strong>Guarda tu panel en el celular</strong>' +
        '<p>Menú del navegador (⋮) → <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>. Marca «Recordar en este dispositivo» al entrar.</p>' +
        '</div>';
    }
    el.innerHTML = html;
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
      var session = { email: email, accessCode: code, stand: result.stand, loggedAt: new Date().toISOString() };
      var rememberCheckbox = $('loginRemember');
      var remember = rememberCheckbox ? rememberCheckbox.checked : true;
      saveSession(session, remember);
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

  function syncRememberCheckbox() {
    var checkbox = $('loginRemember');
    if (!checkbox) return;
    try {
      var pref = localStorage.getItem(REMEMBER_KEY);
      if (pref === '0') checkbox.checked = false;
      else checkbox.checked = true;
    } catch (e) {
      checkbox.checked = true;
    }
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

    var dismissBtn = $('dismissOnboardingBtn');
    if (dismissBtn) dismissBtn.addEventListener('click', dismissOnboarding);

    bindProfileForm();
  }

  function init() {
    initContact();
    syncRememberCheckbox();
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
