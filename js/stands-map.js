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

  function buildLogosFromOccupiedItem(item) {
    if (!item) return [];
    if (Array.isArray(item.logos) && item.logos.length) {
      return item.logos.filter(function (logo) {
        return logo && (logo.logoEnlace || logo.marca);
      });
    }
    var mainLogo = item.logoEnlace || '';
    var mainMarca = item.marca || '';
    if (!mainLogo && !mainMarca) return [];
    return [{ marca: mainMarca, logoEnlace: mainLogo }];
  }

  function buildLogosFromLocalEntry(entry) {
    if (!entry) return [];
    if (entry.logos && Array.isArray(entry.logos) && entry.logos.length) {
      return entry.logos;
    }
    var logos = buildLogosFromOccupiedItem({
      marca: entry.marca,
      logoEnlace: entry.logoEnlace || (entry.logoStand && entry.logoStand.base64) || ''
    });
    if (entry.comparteStand && Array.isArray(entry.marcasAdicionales)) {
      entry.marcasAdicionales.forEach(function (extra) {
        var nombre = String((extra && extra.nombre) || '').trim();
        if (!nombre) return;
        var extraLogo = (extra.logo && extra.logo.base64) ||
          extra.logoEnlace ||
          (extra.logo && extra.logoEnlace) ||
          '';
        logos.push({ marca: nombre, logoEnlace: extraLogo });
      });
    }
    return logos;
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
      var marcas = buildLogosFromOccupiedItem(occ).map(function (logo) {
        return logo.marca;
      }).filter(Boolean);
      var marcasText = marcas.length ? marcas.join(' · ') : (occ && occ.marca) || '';
      return 'Stand ' + pos.label + ' · ' + pos.zone + ' — Ocupado' +
        (marcasText ? ' (' + marcasText + ')' : '');
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
        var logos = buildLogosFromLocalEntry(entry);
        map[sid] = {
          standId: sid,
          marca: entry.marca || '',
          logoEnlace: entry.logoEnlace || (entry.logoStand && entry.logoStand.base64) || '',
          logos: logos
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
      var logos = buildLogosFromOccupiedItem(item);
      map[sid] = {
        standId: sid,
        marca: item.marca || '',
        logoEnlace: item.logoEnlace || (logos[0] && logos[0].logoEnlace) || '',
        logos: logos
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

  StandsMap.prototype.renderSpotLogos = function (logoWrap, occ) {
    if (!logoWrap) return;
    var self = this;
    var logos = buildLogosFromOccupiedItem(occ);
    if (!logos.length) {
      logoWrap.innerHTML = '';
      logoWrap.hidden = true;
      return;
    }

    var multi = logos.length > 1;
    logoWrap.className = 'stands-map-spot__logos' + (multi ? ' stands-map-spot__logos--multi' : '');
    logoWrap.innerHTML = logos.map(function (logo) {
      var src = logo.logoEnlace ? self.driveImageUrl(logo.logoEnlace) : logo.logoEnlace;
      var alt = 'Logo ' + (logo.marca || '');
      if (src && String(src).indexOf('data:') === 0) {
        return '<img src="' + src + '" alt="' + alt + '">';
      }
      if (src) {
        return '<img src="' + src + '" alt="' + alt + '" loading="lazy" referrerpolicy="no-referrer">';
      }
      if (logo.marca) {
        return '<span class="stands-map-spot__initial" title="' + logo.marca + '">' +
          logo.marca.charAt(0).toUpperCase() + '</span>';
      }
      return '';
    }).join('');
    logoWrap.hidden = !logoWrap.innerHTML;
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
      el.disabled = occupied;
      el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      el.setAttribute('aria-pressed', selected ? 'true' : 'false');

      var logoWrap = el.querySelector('.stands-map-spot__logos') ||
        el.querySelector('.stands-map-spot__logo');
      if (logoWrap && occupied) {
        self.renderSpotLogos(logoWrap, self.occupied[sid]);
      } else if (logoWrap) {
        logoWrap.innerHTML = '';
        logoWrap.hidden = true;
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
        '<span class="stands-map-spot__logos" hidden></span>';
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
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

  StandsMap.prototype.applyOptimisticOccupied = function (entry) {
    var sid = normalizeStandId(entry && entry.standId);
    if (!sid) return;
    var logos = buildLogosFromLocalEntry(entry);
    if (entry.logos && Array.isArray(entry.logos) && entry.logos.length) {
      logos = entry.logos;
    }
    this.occupied[sid] = {
      standId: sid,
      marca: entry.marca || '',
      logoEnlace: entry.logoEnlace || (logos[0] && logos[0].logoEnlace) || '',
      logos: logos
    };
    if (this.getSelectedStandId() === sid) {
      this.selectStand('');
    }
    this.renderSpots();
    this.renderLegend();
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

  function MarcasCompartidasUpload(options) {
    options = options || {};
    this.mapConfig = getMapConfig();
    this.checkbox = document.getElementById(options.checkboxId || 'comparteStand');
    this.wrap = document.getElementById(options.wrapId || 'marcasCompartidasWrap');
    this.slotsRoot = document.getElementById(options.slotsId || 'marcasCompartidasSlots');
    this.addBtn = document.getElementById(options.addBtnId || 'btnAddMarcaCompartida');
    this.errorEl = document.getElementById(options.errorId || 'marcasCompartidas-error');
    this.maxMarcas = options.maxMarcas || 3;
    this.slots = [];
    this.bindEvents();
    this.syncVisibility();
  }

  MarcasCompartidasUpload.prototype.showError = function (msg) {
    if (!this.errorEl) return;
    this.errorEl.textContent = msg || '';
    this.errorEl.classList.toggle('visible', !!msg);
  };

  MarcasCompartidasUpload.prototype.syncVisibility = function () {
    var active = !!(this.checkbox && this.checkbox.checked);
    if (this.wrap) this.wrap.hidden = !active;
    if (this.checkbox) {
      this.checkbox.setAttribute('aria-expanded', active ? 'true' : 'false');
    }
    if (active && !this.slots.length) {
      this.addSlot();
    }
    if (!active) {
      this.showError('');
    }
  };

  MarcasCompartidasUpload.prototype.createSlotElement = function (index) {
    var slotId = 'marcaCompartida' + (index + 1);
    var row = document.createElement('div');
    row.className = 'marca-compartida-row field';
    row.setAttribute('data-slot-index', String(index));
    row.innerHTML =
      '<div class="marca-compartida-row__header">' +
      '<strong>Marca adicional ' + (index + 1) + '</strong>' +
      (index > 0 ? '<button type="button" class="btn-clear-file marca-compartida-row__remove">Quitar</button>' : '') +
      '</div>' +
      '<label for="' + slotId + 'Nombre">Nombre de la marca <span class="required" aria-hidden="true">*</span></label>' +
      '<input type="text" id="' + slotId + 'Nombre" name="' + slotId + 'Nombre" maxlength="120" ' +
      'placeholder="Ej. Tostadora del Valle" autocomplete="organization">' +
      '<label for="' + slotId + 'Logo">Logo (opcional)</label>' +
      '<input type="file" id="' + slotId + 'Logo" name="' + slotId + 'Logo" accept="image/jpeg,image/png,image/webp" ' +
      'aria-describedby="' + slotId + 'Preview">' +
      '<div id="' + slotId + 'Preview" class="comprobante-preview marca-compartida-preview" aria-live="polite"></div>';
    return row;
  };

  MarcasCompartidasUpload.prototype.addSlot = function () {
    if (this.slots.length >= this.maxMarcas) return;
    var index = this.slots.length;
    var row = this.createSlotElement(index);
    if (!this.slotsRoot) return;
    this.slotsRoot.appendChild(row);

    var slot = {
      row: row,
      nombreInput: row.querySelector('input[type="text"]'),
      logoInput: row.querySelector('input[type="file"]'),
      preview: row.querySelector('.marca-compartida-preview'),
      logoData: null
    };
    this.slots.push(slot);
    this.bindSlotEvents(slot);
    this.updateAddButton();
  };

  MarcasCompartidasUpload.prototype.removeSlot = function (index) {
    if (index <= 0 || index >= this.slots.length) return;
    var slot = this.slots[index];
    if (slot.row && slot.row.parentNode) {
      slot.row.parentNode.removeChild(slot.row);
    }
    this.slots.splice(index, 1);
    this.reindexSlots();
    this.updateAddButton();
    if (this.errorEl && this.errorEl.classList.contains('visible')) {
      this.validate();
    }
  };

  MarcasCompartidasUpload.prototype.reindexSlots = function () {
    var self = this;
    this.slots.forEach(function (slot, idx) {
      slot.row.setAttribute('data-slot-index', String(idx));
      var header = slot.row.querySelector('.marca-compartida-row__header strong');
      if (header) header.textContent = 'Marca adicional ' + (idx + 1);
      var removeBtn = slot.row.querySelector('.marca-compartida-row__remove');
      if (removeBtn) removeBtn.hidden = idx === 0;
    });
    this.updateAddButton();
  };

  MarcasCompartidasUpload.prototype.updateAddButton = function () {
    if (!this.addBtn) return;
    var canAdd = this.slots.length < this.maxMarcas;
    this.addBtn.hidden = !canAdd;
    this.addBtn.disabled = !canAdd;
  };

  MarcasCompartidasUpload.prototype.bindSlotEvents = function (slot) {
    var self = this;
    var removeBtn = slot.row.querySelector('.marca-compartida-row__remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        var idx = parseInt(slot.row.getAttribute('data-slot-index'), 10);
        self.removeSlot(idx);
      });
    }
    if (slot.nombreInput) {
      slot.nombreInput.addEventListener('input', function () {
        if (self.errorEl && self.errorEl.classList.contains('visible')) {
          self.validate();
        }
      });
    }
    if (slot.logoInput) {
      slot.logoInput.addEventListener('change', function () {
        var file = slot.logoInput.files && slot.logoInput.files[0];
        slot.logoData = null;
        if (slot.preview) {
          slot.preview.classList.remove('visible');
          slot.preview.innerHTML = '';
        }
        if (!file) return;
        var types = self.mapConfig.logoTypes || ['image/jpeg', 'image/png', 'image/webp'];
        if (types.indexOf(file.type) === -1) {
          self.showError('Formato no permitido en logo adicional. Usa JPG, PNG o WebP.');
          slot.logoInput.value = '';
          return;
        }
        var max = self.mapConfig.logoMaxBytes || 5 * 1024 * 1024;
        if (file.size > max) {
          self.showError('Un logo adicional supera 5 MB.');
          slot.logoInput.value = '';
          return;
        }
        if (slot.preview) {
          slot.preview.innerHTML = '<p class="hint">Procesando logo…</p>';
          slot.preview.classList.add('visible');
        }
        compressImageFile(file).then(function (payload) {
          slot.logoData = payload;
          if (slot.preview) {
            slot.preview.innerHTML =
              '<img src="' + payload.base64 + '" alt="Vista previa logo marca adicional">' +
              '<div class="meta">' + payload.nombreArchivo + '</div>';
            slot.preview.classList.add('visible');
          }
          self.showError('');
        }).catch(function () {
          self.showError('No se pudo cargar un logo adicional.');
          slot.logoInput.value = '';
        });
      });
    }
  };

  MarcasCompartidasUpload.prototype.bindEvents = function () {
    var self = this;
    if (this.checkbox) {
      this.checkbox.addEventListener('change', function () {
        self.syncVisibility();
        if (self.errorEl && self.errorEl.classList.contains('visible')) {
          self.validate();
        }
      });
    }
    if (this.addBtn) {
      this.addBtn.addEventListener('click', function () {
        self.addSlot();
      });
    }
  };

  MarcasCompartidasUpload.prototype.validate = function () {
    if (!this.checkbox || !this.checkbox.checked) {
      this.showError('');
      return true;
    }
    var filled = this.slots.filter(function (slot) {
      return slot.nombreInput && slot.nombreInput.value.trim().length >= 2;
    });
    if (!filled.length) {
      this.showError('Indica al menos una marca adicional (mínimo 2 caracteres).');
      return false;
    }
    this.showError('');
    return true;
  };

  MarcasCompartidasUpload.prototype.getPayload = function () {
    var comparte = !!(this.checkbox && this.checkbox.checked);
    if (!comparte) {
      return { comparteStand: false, marcasAdicionales: [] };
    }
    var marcas = [];
    this.slots.forEach(function (slot) {
      var nombre = slot.nombreInput ? slot.nombreInput.value.trim() : '';
      if (nombre.length < 2) return;
      var item = { nombre: nombre };
      if (slot.logoData && slot.logoData.base64) {
        item.logo = {
          nombreArchivo: slot.logoData.nombreArchivo,
          tipoArchivo: slot.logoData.tipoArchivo,
          tamanoBytes: slot.logoData.tamanoBytes,
          base64: slot.logoData.base64
        };
      }
      marcas.push(item);
    });
    return { comparteStand: true, marcasAdicionales: marcas };
  };

  MarcasCompartidasUpload.prototype.clear = function () {
    if (this.checkbox) this.checkbox.checked = false;
    this.slots = [];
    if (this.slotsRoot) this.slotsRoot.innerHTML = '';
    this.syncVisibility();
    this.showError('');
  };

  global.StandsMap = StandsMap;
  global.StandsLogoUpload = LogoUpload;
  global.StandsMarcasCompartidas = MarcasCompartidasUpload;
  global.StandsMapUtils = {
    planRequiresStand: planRequiresStand,
    normalizeStandId: normalizeStandId,
    compressImageFile: compressImageFile,
    resolveAssetUrl: resolveAssetUrl
  };
})(window);
