/**
 * Mapa interactivo de stands — selección, ocupación y logos.
 */
(function (global) {
  'use strict';

  var PLANS_WITH_STAND = ['Zona Origen', 'Zona Gran Reserva', 'Aliado Patrocinador'];
  var MAP_FALLBACK = '/assets/stands-map-placeholder.svg';
  var MAP_REAL = '/assets/stands-map.jpg';
  /** SVG embebido — último recurso si fallan todos los assets externos. */
  var MAP_INLINE =
    'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" role="img" aria-label="Plano de stands">' +
      '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#F5EDE4"/><stop offset="100%" stop-color="#E8D9C8"/></linearGradient></defs>' +
      '<rect width="800" height="500" fill="url(#bg)"/>' +
      '<rect x="280" y="52" width="240" height="70" rx="6" fill="#BB5E3C" opacity="0.18" stroke="#BB5E3C" stroke-width="2"/>' +
      '<text x="400" y="72" text-anchor="middle" fill="#4B352A" font-family="Inter,sans-serif" font-size="11" font-weight="700">ALIADO PATROCINADOR</text>' +
      '<rect x="24" y="130" width="340" height="340" rx="8" fill="#8B6914" opacity="0.12" stroke="#8B6914" stroke-width="2"/>' +
      '<text x="194" y="155" text-anchor="middle" fill="#4B352A" font-family="Inter,sans-serif" font-size="12" font-weight="700">ZONA ORIGEN</text>' +
      '<rect x="400" y="130" width="376" height="340" rx="8" fill="#4B352A" opacity="0.10" stroke="#4B352A" stroke-width="2"/>' +
      '<text x="588" y="155" text-anchor="middle" fill="#4B352A" font-family="Inter,sans-serif" font-size="12" font-weight="700">ZONA GRAN RESERVA</text>' +
      '<text x="400" y="488" text-anchor="middle" fill="#6B5344" font-family="Inter,sans-serif" font-size="11">Plano guía · Palmetto Plaza</text>' +
      '</svg>'
    );

  function getAssetBase() {
    if (typeof document !== 'undefined' && document.body) {
      var dataBase = document.body.getAttribute('data-asset-base');
      if (dataBase) return dataBase.replace(/\/?$/, '/');
    }
    return '/';
  }

  /** Rutas desde la raíz del sitio — válidas en /stands, /stands/ y stands.html. */
  function resolveAssetUrl(path) {
    if (!path) return MAP_FALLBACK;
    var s = String(path).trim();
    if (/^https?:\/\//i.test(s) || s.indexOf('data:') === 0) return s;
    if (s.charAt(0) === '/') return s;
    return getAssetBase() + s.replace(/^\.\//, '');
  }

  function setupMapImage(img, configuredPath, stage) {
    if (!img) return;
    var seen = {};
    var candidates = [];
    function add(url) {
      if (!url || seen[url]) return;
      seen[url] = true;
      candidates.push(url);
    }
    add(resolveAssetUrl(configuredPath));
    if (resolveAssetUrl(configuredPath) !== MAP_REAL) add(MAP_REAL);
    add(MAP_FALLBACK);
    add(MAP_INLINE);

    var idx = 0;
    img.removeAttribute('loading');
    img.setAttribute('decoding', 'async');
    img.setAttribute('width', '800');
    img.setAttribute('height', '500');

    function markReady() {
      if (stage) stage.classList.add('stands-map-stage--ready');
    }

    img.onerror = function () {
      idx += 1;
      if (idx < candidates.length) {
        img.src = candidates[idx];
        return;
      }
      markReady();
    };
    img.onload = markReady;
    img.src = candidates[0];
  }

  function getMapConfig() {
    var cfg = global.EVENT_CONFIG || {};
    var stands = cfg.stands || {};
    return stands.map || { positions: [], image: '' };
  }

  function normalizeStandId(id) {
    return String(id || '').trim().toUpperCase();
  }

  function planRequiresStand(plan) {
    return PLANS_WITH_STAND.indexOf(plan) !== -1;
  }

  function compressImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1200;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var width = Math.max(1, Math.round(img.width * scale));
          var height = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(function (blob) {
            if (!blob) {
              reject(new Error('No se pudo comprimir la imagen.'));
              return;
            }
            var outReader = new FileReader();
            outReader.onload = function () {
              var baseName = (file.name || 'logo').replace(/\.[^.]+$/, '');
              resolve({
                nombreArchivo: baseName + '.jpg',
                tipoArchivo: 'image/jpeg',
                tamanoBytes: blob.size,
                base64: outReader.result
              });
            };
            outReader.onerror = function () {
              reject(new Error('No se pudo procesar la imagen.'));
            };
            outReader.readAsDataURL(blob);
          }, 'image/jpeg', quality);
        };
        img.onerror = function () {
          reject(new Error('No se pudo cargar la imagen.'));
        };
        img.src = reader.result;
      };
      reader.onerror = function () {
        reject(new Error('No se pudo leer la imagen.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function StandsMap(options) {
    options = options || {};
    this.storageKey = options.storageKey || 'feria_cafe_stands';
    this.mapConfig = getMapConfig();
    this.positions = this.mapConfig.positions || [];
    this.occupied = {};
    this.selectedId = '';
    this.currentPlan = '';
    this.fetchError = false;

    this.root = document.getElementById(options.containerId || 'standsMapRoot');
    this.statusEl = document.getElementById(options.statusId || 'standsMapStatus');
    this.selectionEl = document.getElementById(options.selectionId || 'standSelectionLabel');
    this.hiddenInput = document.getElementById(options.hiddenInputId || 'standId');
    this.legendEl = document.getElementById(options.legendId || 'standsMapLegend');
    this.tooltipEl = document.getElementById(options.tooltipId || 'standsMapTooltip');
    this.onOccupiedClick = options.onOccupiedClick || null;
    this.onZoneMismatch = options.onZoneMismatch || null;
  }

  StandsMap.prototype.showTooltip = function (el, text) {
    if (!this.tooltipEl || !el) return;
    this.tooltipEl.textContent = text;
    this.tooltipEl.hidden = false;
    var rect = el.getBoundingClientRect();
    var rootRect = this.root.getBoundingClientRect();
    var top = rect.top - rootRect.top - 8;
    var left = rect.left - rootRect.left + rect.width / 2;
    this.tooltipEl.style.left = left + 'px';
    this.tooltipEl.style.top = top + 'px';
    this.tooltipEl.style.transform = 'translate(-50%, -100%)';
  };

  StandsMap.prototype.hideTooltip = function () {
    if (!this.tooltipEl) return;
    this.tooltipEl.hidden = true;
    this.tooltipEl.textContent = '';
  };

  StandsMap.prototype.spotTooltipText = function (pos, sid, occupied, zoneMatch) {
    if (occupied) {
      var occ = this.occupied[sid];
      return 'Stand ' + pos.label + ' · ' + pos.zone + ' — Ocupado' +
        (occ && occ.marca ? ' (' + occ.marca + ')' : '');
    }
    if (!zoneMatch && planRequiresStand(this.currentPlan)) {
      return 'Stand ' + pos.label + ' · ' + pos.zone + ' — No corresponde a tu plan';
    }
    if (sid === this.getSelectedStandId()) {
      return 'Stand ' + pos.label + ' · ' + pos.zone + ' — Seleccionado';
    }
    return 'Stand ' + pos.label + ' · ' + pos.zone + ' — Disponible (toca para elegir)';
  };

  StandsMap.prototype.clearFeedback = function () {
    var fb = document.getElementById('standsMapFeedback');
    if (fb) fb.textContent = '';
  };

  StandsMap.prototype.driveImageUrl = function (url) {
    if (!url) return '';
    var m = String(url).match(/\/file\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w200';
    return url;
  };

  StandsMap.prototype.getLocalOccupied = function () {
    try {
      var list = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      var map = {};
      list.forEach(function (entry) {
        var sid = normalizeStandId(entry.standId);
        if (!sid) return;
        map[sid] = {
          standId: sid,
          marca: entry.marca || '',
          logoEnlace: entry.logoEnlace || (entry.logoStand && entry.logoStand.base64) || ''
        };
      });
      return map;
    } catch (e) {
      return {};
    }
  };

  StandsMap.prototype.mergeOccupied = function (items) {
    var map = {};
    (items || []).forEach(function (item) {
      var sid = normalizeStandId(item.standId);
      if (!sid) return;
      map[sid] = {
        standId: sid,
        marca: item.marca || '',
        logoEnlace: item.logoEnlace || ''
      };
    });
    return map;
  };

  StandsMap.prototype.refresh = function () {
    var self = this;
    var hadMap = !!(self.root && self.root.querySelector('.stands-map-stage'));
    if (self.statusEl && hadMap) {
      self.statusEl.textContent = 'Consultando disponibilidad…';
    }

    var configured = global.FormSubmit && FormSubmit.isConfigured && FormSubmit.isConfigured();
    if (configured && FormSubmit.fetchStandsMap) {
      return FormSubmit.fetchStandsMap().then(function (data) {
        if (data && data.ok && Array.isArray(data.occupied)) {
          self.fetchError = false;
          self.occupied = self.mergeOccupied(data.occupied);
        } else {
          self.fetchError = true;
          self.occupied = self.getLocalOccupied();
        }
        self.renderSpots();
        self.renderLegend();
        self.renderStatus();
        self.updateSelectionLabel();
        return self.occupied;
      }).catch(function () {
        self.fetchError = true;
        self.occupied = self.getLocalOccupied();
        self.renderSpots();
        self.renderLegend();
        self.renderStatus();
        self.updateSelectionLabel();
        return self.occupied;
      });
    }

    self.fetchError = false;
    self.occupied = self.getLocalOccupied();
    self.renderSpots();
    self.renderLegend();
    self.renderStatus();
    self.updateSelectionLabel();
    return Promise.resolve(self.occupied);
  };

  StandsMap.prototype.verifyAvailable = function (standId) {
    var sid = normalizeStandId(standId);
    if (!sid) return Promise.resolve(true);
    return this.refresh().then(function (occupied) {
      return !occupied[sid];
    });
  };

  StandsMap.prototype.setPlan = function (plan) {
    this.currentPlan = plan || '';
    if (this.selectedId) {
      var pos = this.positions.find(function (p) {
        return normalizeStandId(p.id) === normalizeStandId(this.selectedId);
      }, this);
      if (pos && planRequiresStand(plan) && pos.zone !== plan) {
        this.selectStand('');
      }
    }
    this.renderSpots();
    this.updateSelectionLabel();
  };

  StandsMap.prototype.selectStand = function (standId) {
    var sid = normalizeStandId(standId);
    if (sid && this.occupied[sid]) return;
    this.selectedId = sid;
    if (this.hiddenInput) this.hiddenInput.value = sid;
    this.clearFeedback();
    this.renderSpots();
    this.updateSelectionLabel();
  };

  StandsMap.prototype.getSelectedStandId = function () {
    return normalizeStandId(this.selectedId || (this.hiddenInput && this.hiddenInput.value));
  };

  StandsMap.prototype.updateSelectionLabel = function () {
    if (!this.selectionEl) return;
    var sid = this.getSelectedStandId();
    if (!sid) {
      this.selectionEl.textContent = planRequiresStand(this.currentPlan)
        ? 'Ningún stand seleccionado'
        : 'Selecciona un plan con stand para elegir posición';
      return;
    }
    var pos = this.positions.find(function (p) {
      return normalizeStandId(p.id) === sid;
    });
    this.selectionEl.textContent = sid + (pos ? ' · ' + pos.zone : '');
  };

  StandsMap.prototype.renderLegend = function () {
    if (!this.legendEl) return;
    var total = this.positions.length;
    var occCount = Object.keys(this.occupied).length;
    var avail = Math.max(0, total - occCount);
    var hint = this.mapConfig.replaceHint || '';
    this.legendEl.innerHTML =
      '<span class="stands-map-legend__item stands-map-legend__item--free">Disponible (verde)</span>' +
      '<span class="stands-map-legend__item stands-map-legend__item--selected">Seleccionado</span>' +
      '<span class="stands-map-legend__item stands-map-legend__item--occupied">Ocupado</span>' +
      '<span class="stands-map-legend__count">' + avail + ' de ' + total + ' disponibles</span>' +
      (hint ? '<p class="hint stands-map-replace-hint">' + hint + '</p>' : '');
  };

  StandsMap.prototype.renderStatus = function () {
    if (!this.statusEl) return;
    if (this.fetchError) {
      this.statusEl.textContent = 'No se pudo consultar ocupación en línea. Mostrando datos locales.';
      this.statusEl.classList.add('stands-map-status--warn');
      return;
    }
    this.statusEl.classList.remove('stands-map-status--warn');
    if (!planRequiresStand(this.currentPlan) || !this.currentPlan) {
      this.statusEl.textContent = 'Elige un plan arriba para ver los stands disponibles en el mapa.';
      return;
    }
    this.statusEl.textContent = 'Toca un stand verde de «' + this.currentPlan + '» para reservarlo.';
  };

  StandsMap.prototype.renderSpots = function () {
    if (!this.root) return;
    var self = this;
    var spots = this.root.querySelectorAll('.stands-map-spot');
    spots.forEach(function (el) {
      var sid = normalizeStandId(el.getAttribute('data-stand-id'));
      var pos = self.positions.find(function (p) {
        return normalizeStandId(p.id) === sid;
      });
      var occupied = !!self.occupied[sid];
      var selected = sid === self.getSelectedStandId();
      var zoneMatch = !planRequiresStand(self.currentPlan) || !self.currentPlan || (pos && pos.zone === self.currentPlan);
      var disabled = occupied || !zoneMatch;

      el.classList.toggle('stands-map-spot--occupied', occupied);
      el.classList.toggle('stands-map-spot--selected', selected && !occupied);
      el.classList.toggle('stands-map-spot--disabled', disabled && !occupied);
      el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      el.setAttribute('aria-pressed', selected ? 'true' : 'false');

      var logoWrap = el.querySelector('.stands-map-spot__logo');
      if (logoWrap) {
        var occ = self.occupied[sid];
        var logoSrc = occ && (occ.logoEnlace ? self.driveImageUrl(occ.logoEnlace) : occ.logoEnlace);
        if (logoSrc && String(logoSrc).indexOf('data:') === 0) {
          logoWrap.innerHTML = '<img src="' + logoSrc + '" alt="Logo ' + (occ.marca || sid) + '">';
          logoWrap.hidden = false;
        } else if (logoSrc) {
          logoWrap.innerHTML = '<img src="' + logoSrc + '" alt="Logo ' + (occ.marca || sid) + '" loading="lazy" referrerpolicy="no-referrer">';
          logoWrap.hidden = false;
        } else if (occupied && occ && occ.marca) {
          logoWrap.innerHTML = '<span class="stands-map-spot__initial" title="' + occ.marca + '">' + occ.marca.charAt(0).toUpperCase() + '</span>';
          logoWrap.hidden = false;
        } else {
          logoWrap.innerHTML = '';
          logoWrap.hidden = true;
        }
      }
    });
  };

  StandsMap.prototype.buildDom = function () {
    if (!this.root) return;
    var self = this;

    this.root.innerHTML =
      '<div class="stands-map-stage">' +
      '<img class="stands-map-image" alt="Plano de stands en Palmetto Plaza">' +
      '<div class="stands-map-overlay" role="group" aria-label="Selección de stand"></div>' +
      '</div>';

    var stage = this.root.querySelector('.stands-map-stage');
    setupMapImage(this.root.querySelector('.stands-map-image'), this.mapConfig.image, stage);

    var overlay = this.root.querySelector('.stands-map-overlay');
    this.positions.forEach(function (pos) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stands-map-spot';
      btn.setAttribute('data-stand-id', pos.id);
      btn.setAttribute('aria-label', 'Stand ' + pos.label + ', ' + pos.zone);
      btn.style.left = pos.left + '%';
      btn.style.top = pos.top + '%';
      btn.style.width = pos.width + '%';
      btn.style.height = pos.height + '%';
      btn.innerHTML =
        '<span class="stands-map-spot__label">' + pos.label + '</span>' +
        '<span class="stands-map-spot__logo" hidden></span>';
      btn.addEventListener('click', function () {
        var sid = normalizeStandId(pos.id);
        if (self.occupied[sid]) {
          if (self.onOccupiedClick) {
            self.onOccupiedClick({
              id: sid,
              label: pos.label,
              zone: pos.zone,
              marca: (self.occupied[sid] && self.occupied[sid].marca) || ''
            });
          }
          return;
        }
        if (planRequiresStand(self.currentPlan) && pos.zone !== self.currentPlan) {
          if (self.onZoneMismatch) {
            self.onZoneMismatch({ id: sid, label: pos.label, zone: pos.zone });
          }
          return;
        }
        self.hideTooltip();
        self.selectStand(sid === self.getSelectedStandId() ? '' : sid);
      });
      btn.addEventListener('mouseenter', function () {
        var sid = normalizeStandId(pos.id);
        var occupied = !!self.occupied[sid];
        var zoneMatch = !planRequiresStand(self.currentPlan) || !self.currentPlan || pos.zone === self.currentPlan;
        self.showTooltip(btn, self.spotTooltipText(pos, sid, occupied, zoneMatch));
      });
      btn.addEventListener('mouseleave', function () {
        self.hideTooltip();
      });
      btn.addEventListener('focus', function () {
        var sid = normalizeStandId(pos.id);
        var occupied = !!self.occupied[sid];
        var zoneMatch = !planRequiresStand(self.currentPlan) || !self.currentPlan || pos.zone === self.currentPlan;
        self.showTooltip(btn, self.spotTooltipText(pos, sid, occupied, zoneMatch));
      });
      btn.addEventListener('blur', function () {
        self.hideTooltip();
      });
      overlay.appendChild(btn);
    });
  };

  StandsMap.prototype.render = function () {
    if (!this.root.querySelector('.stands-map-stage')) {
      this.buildDom();
    }
    this.renderLegend();
    this.renderStatus();
    this.renderSpots();
    this.updateSelectionLabel();
  };

  StandsMap.prototype.init = function () {
    this.buildDom();
    this.renderLegend();
    this.renderStatus();
    this.renderSpots();
    this.updateSelectionLabel();
    return this.refresh();
  };

  StandsMap.prototype.validateSelection = function (plan) {
    if (!planRequiresStand(plan)) return '';
    var sid = this.getSelectedStandId();
    if (!sid) return 'Selecciona un stand en el mapa.';
    var pos = this.positions.find(function (p) {
      return normalizeStandId(p.id) === sid;
    });
    if (!pos) return 'Stand seleccionado no válido.';
    if (pos.zone !== plan) return 'El stand ' + sid + ' no corresponde al plan ' + plan + '.';
    if (this.occupied[sid]) return 'El stand ' + sid + ' ya está ocupado. Elige otro stand disponible (verde) en el mapa.';
    return '';
  };

  function LogoUpload(options) {
    options = options || {};
    this.mapConfig = getMapConfig();
    this.input = document.getElementById(options.inputId || 'logoStand');
    this.preview = document.getElementById(options.previewId || 'logoPreview');
    this.errorEl = document.getElementById(options.errorId || 'logo-error');
    this.data = null;
    this.bindEvents();
  }

  LogoUpload.prototype.showError = function (msg) {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg || '';
    this.errorEl.classList.toggle('visible', !!msg);
    if (this.input) this.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  LogoUpload.prototype.clear = function (clearInput) {
    this.data = null;
    if (clearInput && this.input) this.input.value = '';
    if (this.preview) {
      this.preview.classList.remove('visible');
      this.preview.innerHTML = '';
    }
    this.showError('');
  };

  LogoUpload.prototype.renderPreview = function (data) {
    if (!this.preview || !data) return;
    this.preview.innerHTML =
      '<img src="' + data.base64 + '" alt="Vista previa del logo">' +
      '<div class="meta"><strong>' + data.nombreArchivo + '</strong>' +
      data.tipoArchivo + ' · ' + this.formatSize(data.tamanoBytes) + '</div>' +
      '<button type="button" class="btn-clear-file" data-clear-logo>Quitar</button>';
    this.preview.classList.add('visible');
    var btn = this.preview.querySelector('[data-clear-logo]');
    var self = this;
    if (btn) btn.addEventListener('click', function () { self.clear(true); });
  };

  LogoUpload.prototype.formatSize = function (bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  LogoUpload.prototype.validateFile = function (file, required) {
    if (!file) {
      return required ? 'El logo de tu negocio es obligatorio.' : '';
    }
    var types = this.mapConfig.logoTypes || ['image/jpeg', 'image/png', 'image/webp'];
    if (types.indexOf(file.type) === -1) {
      return 'Formato no permitido. Usa JPG, PNG o WebP.';
    }
    var max = this.mapConfig.logoMaxBytes || 5 * 1024 * 1024;
    if (file.size > max) {
      return 'El logo supera 5 MB. Elige una imagen más pequeña.';
    }
    return '';
  };

  LogoUpload.prototype.validate = function (plan) {
    var required = planRequiresStand(plan);
    if (this.data && this.data.base64) {
      this.showError('');
      return true;
    }
    if (required) {
      this.showError('El logo de tu negocio es obligatorio.');
      return false;
    }
    this.showError('');
    return true;
  };

  LogoUpload.prototype.getPayload = function () {
    if (!this.data || !this.data.base64) return null;
    return {
      nombreArchivo: this.data.nombreArchivo,
      tipoArchivo: this.data.tipoArchivo,
      tamanoBytes: this.data.tamanoBytes,
      base64: this.data.base64
    };
  };

  LogoUpload.prototype.bindEvents = function () {
    var self = this;
    if (!this.input) return;
    this.input.addEventListener('change', function () {
      var file = self.input.files && self.input.files[0];
      self.clear(false);
      if (!file) return;
      var msg = self.validateFile(file, false);
      if (msg) {
        self.showError(msg);
        self.clear(true);
        return;
      }
      if (self.preview) {
        self.preview.innerHTML = '<p class="hint">Procesando logo…</p>';
        self.preview.classList.add('visible');
      }
      compressImageFile(file).then(function (payload) {
        self.data = payload;
        self.renderPreview(payload);
        self.showError('');
      }).catch(function () {
        self.showError('No se pudo cargar el logo. Intenta con otra imagen.');
        self.clear(true);
      });
    });
  };

  global.StandsMap = StandsMap;
  global.StandsLogoUpload = LogoUpload;
  global.StandsMapUtils = {
    planRequiresStand: planRequiresStand,
    normalizeStandId: normalizeStandId,
    compressImageFile: compressImageFile,
    resolveAssetUrl: resolveAssetUrl
  };
})(window);
