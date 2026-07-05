/**
 * Listado de stands — selección, ocupación y logos.
 */
(function (global) {
  'use strict';

  var PLANS_WITH_STAND = ['Zona Origen', 'Zona Gran Reserva'];
  var PLAN_ALIADO_PATROCINADOR = 'Aliado Patrocinador';

  function getMapConfig() {
    var cfg = global.EVENT_CONFIG || {};
    var stands = cfg.stands || {};
    return stands.map || { positions: [] };
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeStandId(id) {
    return String(id || '').trim().toUpperCase();
  }

  function planRequiresStand(plan) {
    return PLANS_WITH_STAND.indexOf(plan) !== -1;
  }

  function planIsAliadoPatrocinador(plan) {
    return String(plan || '').trim() === PLAN_ALIADO_PATROCINADOR;
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
    this.onOccupiedClick = options.onOccupiedClick || null;
    this.onZoneMismatch = options.onZoneMismatch || null;
  }

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
    var hadList = !!(self.root && self.root.querySelector('.stands-list'));
    if (self.statusEl && hadList) {
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
    var relevant = this.positionsForPlan();
    var total = relevant.length;
    var occCount = relevant.filter(function (pos) {
      return !!this.occupied[normalizeStandId(pos.id)];
    }, this).length;
    var avail = Math.max(0, total - occCount);
    this.legendEl.innerHTML =
      '<span class="stands-list-legend__count">' + avail + ' de ' + total + ' disponibles en tu plan</span>';
  };

  StandsMap.prototype.positionsForPlan = function () {
    var self = this;
    if (!planRequiresStand(this.currentPlan) || !this.currentPlan) {
      return this.positions.slice();
    }
    return this.positions.filter(function (pos) {
      return pos.zone === self.currentPlan;
    });
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
      this.statusEl.textContent = 'Elige un plan arriba para ver los stands disponibles.';
      return;
    }
    this.statusEl.textContent = 'Selecciona un stand disponible de «' + this.currentPlan + '».';
  };

  StandsMap.prototype.listItemStatus = function (pos, sid, occupied, zoneMatch) {
    if (occupied) {
      var occ = this.occupied[sid];
      var marcas = buildLogosFromOccupiedItem(occ).map(function (logo) {
        return logo.marca;
      }).filter(Boolean);
      return 'Ocupado' + (marcas.length ? ' · ' + marcas.join(' · ') : (occ && occ.marca ? ' · ' + occ.marca : ''));
    }
    if (!zoneMatch && planRequiresStand(this.currentPlan)) {
      return 'No corresponde a tu plan';
    }
    if (sid === this.getSelectedStandId()) {
      return 'Seleccionado';
    }
    return 'Disponible';
  };

  StandsMap.prototype.renderSpots = function () {
    if (!this.root) return;
    var self = this;
    var showAll = !planRequiresStand(self.currentPlan) || !self.currentPlan;
    self.root.querySelectorAll('.stands-list__item').forEach(function (el) {
      var sid = normalizeStandId(el.getAttribute('data-stand-id'));
      var pos = self.positions.find(function (p) {
        return normalizeStandId(p.id) === sid;
      });
      if (!pos) return;
      var occupied = !!self.occupied[sid];
      var selected = sid === self.getSelectedStandId();
      var zoneMatch = showAll || pos.zone === self.currentPlan;
      var disabled = occupied || !zoneMatch;
      var hidden = !showAll && pos.zone !== self.currentPlan;

      el.hidden = hidden;
      el.classList.toggle('stands-list__item--occupied', occupied);
      el.classList.toggle('stands-list__item--selected', selected && !occupied);
      el.classList.toggle('stands-list__item--disabled', disabled && !occupied);

      var btn = el.querySelector('.stands-list__btn');
      if (btn) {
        btn.disabled = occupied;
        btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
      }
      var statusEl = el.querySelector('.stands-list__status');
      if (statusEl) {
        statusEl.textContent = self.listItemStatus(pos, sid, occupied, zoneMatch);
      }
    });
  };

  StandsMap.prototype.buildDom = function () {
    if (!this.root) return;
    var self = this;

    this.root.innerHTML = '<ul class="stands-list" role="listbox" aria-label="Listado de stands"></ul>';
    var list = this.root.querySelector('.stands-list');

    this.positions.forEach(function (pos) {
      var li = document.createElement('li');
      li.className = 'stands-list__item';
      li.setAttribute('data-stand-id', pos.id);
      li.setAttribute('role', 'presentation');
      li.innerHTML =
        '<button type="button" class="stands-list__btn" data-stand-id="' + escapeHtml(pos.id) + '">' +
        '<span class="stands-list__id">' + escapeHtml(pos.label) + '</span>' +
        '<span class="stands-list__zone">' + escapeHtml(pos.zone) + '</span>' +
        '<span class="stands-list__status">Disponible</span>' +
        '</button>';

      var btn = li.querySelector('.stands-list__btn');
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
        self.selectStand(sid === self.getSelectedStandId() ? '' : sid);
      });
      list.appendChild(li);
    });
  };

  StandsMap.prototype.render = function () {
    if (!this.root.querySelector('.stands-list')) {
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
    if (!sid) return 'Selecciona un stand de la lista.';
    var pos = this.positions.find(function (p) {
      return normalizeStandId(p.id) === sid;
    });
    if (!pos) return 'Stand seleccionado no válido.';
    if (pos.zone !== plan) return 'El stand ' + sid + ' no corresponde al plan ' + plan + '.';
    if (this.occupied[sid]) return 'El stand ' + sid + ' ya está ocupado. Elige otro stand disponible.';
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
    planIsAliadoPatrocinador: planIsAliadoPatrocinador,
    normalizeStandId: normalizeStandId,
    compressImageFile: compressImageFile
  };
})(window);
