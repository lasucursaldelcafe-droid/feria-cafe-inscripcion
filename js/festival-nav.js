/**
 * Navegación del festival: menú móvil, página activa y enlaces de contacto.
 */
(function (global) {
  'use strict';

  function waUrl(phone, text) {
    var p = String(phone || '').replace(/\D/g, '');
    if (!p) return 'mailto:' + (global.EVENT_CONFIG && global.EVENT_CONFIG.contact && global.EVENT_CONFIG.contact.email || '');
    return 'https://wa.me/' + p + '?text=' + encodeURIComponent(text);
  }

  function initNavToggle() {
    var toggle = document.getElementById('navToggle');
    var menu = document.getElementById('navMenu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function markActiveNav() {
    var page = document.body.getAttribute('data-festival-page');
    if (!page) return;
    document.querySelectorAll('.festival-nav__menu a[data-nav]').forEach(function (link) {
      if (link.getAttribute('data-nav') === page) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function applyFestivalCopy() {
    var cfg = global.EVENT_CONFIG || {};
    var feria = cfg.feria || {};
    var fest = cfg.festival || {};
    var contact = cfg.contact || {};

    function setText(id, text) {
      var el = document.getElementById(id);
      if (el && text) el.textContent = text;
    }

    if (fest.slogan) setText('festivalSlogan', fest.slogan);
    if (fest.mensaje) setText('festivalMensaje', fest.mensaje);
    if (fest.lema) setText('statLema', fest.lema);
    if (feria.fechaCorta) setText('statFecha', feria.fechaCorta);
    if (feria.ciudad) setText('statCiudad', feria.ciudad + ', Valle del Cauca');
    if (feria.fecha || feria.fechaCorta) {
      var b = document.getElementById('badgeFestivalFecha');
      if (b) {
        b.textContent = '📅 ' + (feria.fechaCorta || feria.fecha);
      }
    }
    if (feria.sede && feria.ciudad) {
      var bs = document.getElementById('badgeFestivalSede');
      if (bs) {
        bs.textContent = '📍 ' + feria.sede + ', ' + feria.ciudad;
      }
    }

    var modalDates = document.getElementById('feriaModalDates');
    if (modalDates && feria.fecha && feria.sede) {
      modalDates.innerHTML =
        'Sé parte de la comunidad cafetera el <strong>' + feria.fecha + '</strong> en ' +
        '<strong>' + feria.sede + ', ' + (feria.ciudad || 'Cali') + '</strong>. ' +
        'Cata, talleres, exposiciones y competencias te esperan. La inscripción es <strong>gratuita</strong>, pero los cupos son limitados.';
    }

    var modalCfg = fest.modal || {};
    if (modalCfg.eyebrow) setText('feriaModalEyebrow', modalCfg.eyebrow);
    if (modalCfg.title) setText('feriaModalTitle', modalCfg.title);
    if (modalCfg.cta) {
      var modalCta = document.querySelector('[data-modal-cta]');
      if (modalCta) modalCta.textContent = modalCfg.cta;
    }
    if (modalCfg.dismiss) {
      var modalDismiss = document.querySelector('.feria-modal__dismiss');
      if (modalDismiss) modalDismiss.textContent = modalCfg.dismiss;
    }

    if (fest.instagramUrl) {
      var ig = document.getElementById('igLink');
      if (ig) {
        ig.href = fest.instagramUrl;
        ig.textContent = fest.instagram || ig.textContent;
      }
    }

    var phone = contact.whatsapp;
    var waContact = document.getElementById('waContact');
    if (waContact) {
      waContact.href = waUrl(phone, 'Hola, me interesa La Sucursal del Café — feria o alianzas.');
    }
    var waPatrocinador = document.getElementById('waPatrocinador');
    if (waPatrocinador) {
      waPatrocinador.href = waUrl(
        phone,
        'Hola, quiero ser patrocinador o aliado de La Sucursal del Café 2026. Me interesa conocer los planes Zona Origen, Zona Gran Reserva o Aliado Patrocinador.'
      );
    }
    if (contact.email) {
      ['emailContact', 'emailPatrocinador'].forEach(function (id) {
        var em = document.getElementById(id);
        if (em) em.href = 'mailto:' + contact.email;
      });
    }
  }

  function init() {
    initNavToggle();
    markActiveNav();
    applyFestivalCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.FestivalNav = { init: init };
})(window);
