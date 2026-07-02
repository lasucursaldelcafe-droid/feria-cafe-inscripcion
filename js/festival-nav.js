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

    function setOpen(open) {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('nav-is-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(!menu.classList.contains('is-open'));
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        setOpen(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (!menu.classList.contains('is-open')) return;
      if (menu.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
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

    var visitante = feria.visitante || {};

    if (fest.slogan) setText('festivalSlogan', fest.slogan);
    var page = document.body.getAttribute('data-festival-page');
    if (page === 'evento' && fest.mensajeEvento) {
      setText('festivalMensaje', fest.mensajeEvento);
    } else if (fest.mensaje) {
      setText('festivalMensaje', fest.mensaje);
    }
    if (fest.heroLead) {
      setText('festivalLead', fest.heroLead);
    } else if (visitante.entradaSinCosto) {
      setText(
        'festivalLead',
        visitante.entradaSinCosto + ' ' + (visitante.registroOpcional || '')
      );
    } else if (feria.entrada) {
      setText('festivalLead', 'Productores, tostadores, cata y talleres en Cali. ' + feria.entrada);
    }
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
    var modalCfgEarly = fest.modal || {};
    if (modalDates && modalCfgEarly.texto) {
      modalDates.innerHTML = modalCfgEarly.texto;
    } else if (modalDates && feria.fecha && feria.sede) {
      modalDates.innerHTML =
        'Sé parte de la comunidad cafetera el <strong>' + feria.fecha + '</strong> en ' +
        '<strong>' + feria.sede + ', ' + (feria.ciudad || 'Cali') + '</strong>. ' +
        'Cata, talleres, exposiciones y competencias te esperan. ' +
        '<strong>' + (visitante.entradaSinCosto || 'La feria no tiene precio de ingreso.') + '</strong> ' +
        (visitante.registroOpcional || 'El registro como visitante es opcional.') + ' ' +
        (visitante.premiosRegistro || '');
    }

    var modalCfg = fest.modal || {};
    if (modalCfg.eyebrow) setText('feriaModalEyebrow', modalCfg.eyebrow);
    if (modalCfg.title) setText('feriaModalTitle', modalCfg.title);
    if (modalCfg.cta) {
      var modalCta = document.querySelector('[data-modal-cta]');
      if (modalCta) modalCta.textContent = modalCfg.cta;
    }
    if (modalCfg.note) {
      var modalNote = document.querySelector('.feria-modal__note');
      if (modalNote) {
        modalNote.innerHTML =
          modalCfg.note.indexOf('<') !== -1
            ? modalCfg.note
            : modalCfg.note +
              ' <a data-link="competencia" href="competencia.html">V60 Championship</a>.';
        if (global.SiteLinks && global.SiteLinks.apply) global.SiteLinks.apply(modalNote);
      }
    }
    if (modalCfg.dismiss) {
      var modalDismiss = document.querySelector('.feria-modal__dismiss');
      if (modalDismiss) modalDismiss.textContent = modalCfg.dismiss;
    }

    if (global.SiteChrome && global.SiteChrome.applyInstagramLink) {
      global.SiteChrome.applyInstagramLink();
    } else if (fest.instagramUrl) {
      var ig = document.getElementById('igLink');
      if (ig) {
        ig.href = fest.instagramUrl;
        ig.textContent = fest.instagram || '@lasucursal.delcafe';
        ig.setAttribute('target', '_blank');
        ig.setAttribute('rel', 'noopener noreferrer');
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

    var premios = feria.premiosVisitante || {};
    if (premios.titulo) setText('premiosVisitantesTitle', premios.titulo);
    if (premios.intro) setText('premiosVisitantesIntro', premios.intro);
    if (premios.nota) setText('premiosVisitantesNota', premios.nota);
    var premiosList = document.getElementById('premiosVisitantesLista');
    if (premiosList && premios.items && premios.items.length) {
      premiosList.innerHTML = '';
      premios.items.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        premiosList.appendChild(li);
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

  global.FestivalNav = { init: init, applyCopy: applyFestivalCopy };
})(window);
