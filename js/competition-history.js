/**
 * Historial de competencias del circuito V60.
 * Combina EVENT_CONFIG + datasets archivados (Preliminar 1, etc.).
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

  function estadoClass(estado) {
    if (estado === 'realizada') return 'jurado-history-edition--done';
    if (estado === 'activa') return 'jurado-history-edition--live';
    return 'jurado-history-edition--upcoming';
  }

  function estadoLabel(estado) {
    if (estado === 'realizada') return 'Realizada';
    if (estado === 'activa') return 'En curso';
    if (estado === 'proxima') return 'Próxima';
    return estado || '—';
  }

  function getPreliminar1Edition() {
    if (!global.Preliminar1Results) return null;
    var kit = global.Preliminar1Results.exportKit();
    var ranking = kit.ranking || [];
    return {
      id: 'preliminar-1',
      slug: 'preliminar-1',
      nombre: kit.event.nombre,
      estado: 'realizada',
      fecha: '4 de julio de 2026',
      sede: 'Plaza Marbella, Centro Comercial Curis',
      ciudad: 'Cali',
      disciplina: kit.event.disciplina || 'filtrado',
      jueces: kit.event.jueces || 3,
      competidores: ranking.length,
      tandas: (kit.rawRows || []).length,
      podio: ranking.slice(0, 3).map(function (r) {
        return {
          posicion: r.posicion,
          nombre: r.nombreInscrito || r.participante,
          total: r.total,
          id: r.competidorId
        };
      }),
      ranking: ranking,
      rawRows: kit.rawRows || [],
      inscritos: kit.inscritos || [],
      criteria: kit.criteria || [],
      hasResults: true,
      hasKit: true,
      source: 'preliminar-1-results'
    };
  }

  function editionFromEventConfig(ev, key, defaults) {
    if (!ev) return null;
    defaults = defaults || {};
    return {
      id: key,
      slug: key,
      nombre: ev.nombre || ev.eventoId || key,
      estado: ev.estado === 'realizada' ? 'realizada' : (ev.estado === 'activa' ? 'activa' : 'proxima'),
      fecha: ev.fecha || ev.fechaCorta || defaults.fecha || 'Por confirmar',
      sede: ev.sede || defaults.sede || '—',
      ciudad: ev.ciudad || 'Cali',
      disciplina: 'filtrado',
      jueces: 3,
      competidores: null,
      tandas: null,
      podio: [],
      ranking: [],
      hasResults: false,
      hasKit: false,
      source: 'event-config'
    };
  }

  function getEditions() {
    var root = global.EVENT_CONFIG || {};
    var list = [];

    var p1 = getPreliminar1Edition();
    if (p1) list.push(p1);
    else {
      var ev1 = editionFromEventConfig(root.evento1, 'preliminar-1', {
        fecha: 'Realizada',
        sede: 'Plaza Marbella, Curis'
      });
      if (ev1) list.push(ev1);
    }

    var ev2 = editionFromEventConfig(root.evento2, 'preliminar-2', {
      fecha: '8 de agosto de 2026',
      sede: 'Mas Café'
    });
    if (ev2) list.push(ev2);

    var finalEv = (root.proximosEventos || []).find(function (e) {
      return /principal|final/i.test(String(e.label || ''));
    });
    if (finalEv) {
      list.push({
        id: 'final',
        slug: 'final',
        nombre: 'V60 Championship — Competencia principal',
        estado: 'proxima',
        fecha: finalEv.fecha || '29 y 30 de agosto de 2026',
        sede: finalEv.sede || 'Palmetto Plaza, Cali',
        ciudad: 'Cali',
        disciplina: 'filtrado',
        jueces: 3,
        competidores: null,
        tandas: null,
        podio: [],
        ranking: [],
        hasResults: false,
        hasKit: false,
        source: 'event-config'
      });
    }

    return list;
  }

  function getEdition(id) {
    var slug = String(id || '').trim();
    return getEditions().find(function (e) { return e.id === slug || e.slug === slug; }) || null;
  }

  function renderEditionSummaryCard(edition, opts) {
    opts = opts || {};
    var detailUrl = opts.detailBaseUrl
      ? opts.detailBaseUrl + (opts.detailBaseUrl.indexOf('?') >= 0 ? '&' : '?') + 'edicion=' + encodeURIComponent(edition.id)
      : '';
    var tag = estadoLabel(edition.estado);
    var stats = [];
    if (edition.competidores != null) stats.push(edition.competidores + ' competidores');
    if (edition.tandas != null) stats.push(edition.tandas + ' tandas');
    if (edition.jueces) stats.push(edition.jueces + ' jueces');

    var podioHtml = '';
    if (edition.podio && edition.podio.length) {
      podioHtml = '<ol class="jurado-history-podio">' +
        edition.podio.map(function (p) {
          return '<li><span class="jurado-history-podio-pos">' + p.posicion + '°</span> ' +
            escapeHtml(p.nombre) + ' <strong>' + p.total + '</strong></li>';
        }).join('') +
        '</ol>';
    }

    var inner =
      '<article class="jurado-history-edition ' + estadoClass(edition.estado) + '">' +
      '<header class="jurado-history-edition-head">' +
      '<span class="jurado-history-edition-badge">' + escapeHtml(tag) + '</span>' +
      '<h3>' + escapeHtml(edition.nombre) + '</h3>' +
      '<p class="jurado-history-edition-meta">' +
      escapeHtml(edition.fecha) + ' · ' + escapeHtml(edition.sede) +
      (stats.length ? ' · ' + escapeHtml(stats.join(' · ')) : '') +
      '</p>' +
      '</header>' +
      (podioHtml || '<p class="jurado-hint">Sin resultados publicados aún.</p>') +
      (opts.showActions !== false ? (
        '<div class="jurado-history-edition-actions">' +
        (detailUrl ? '<a class="jurado-btn jurado-btn--secondary jurado-btn--small" href="' + escapeHtml(detailUrl) + '">Ver detalle</a>' : '') +
        (edition.hasKit ? '<button type="button" class="jurado-btn jurado-btn--small" data-history-download="' + escapeHtml(edition.id) + '">Descargar JSON</button>' : '') +
        '</div>'
      ) : '') +
      '</article>';

    return inner;
  }

  function renderEditionsList(editions, opts) {
    if (!editions.length) {
      return '<p class="jurado-hint">Aún no hay ediciones en el historial.</p>';
    }
    return '<div class="jurado-history-grid">' +
      editions.map(function (e) { return renderEditionSummaryCard(e, opts); }).join('') +
      '</div>';
  }

  function renderEditionDetail(edition) {
    if (!edition) return '<p class="jurado-hint">Edición no encontrada.</p>';

    var html =
      '<div class="jurado-history-detail">' +
      '<header class="jurado-history-detail-head">' +
      '<span class="jurado-history-edition-badge">' + escapeHtml(estadoLabel(edition.estado)) + '</span>' +
      '<h2>' + escapeHtml(edition.nombre) + '</h2>' +
      '<p class="jurado-hint">' + escapeHtml(edition.fecha) + ' · ' + escapeHtml(edition.sede) + ' · ' +
      escapeHtml(edition.ciudad) + '</p>' +
      '</header>';

    if (!edition.hasResults || !edition.ranking || !edition.ranking.length) {
      html += '<p class="jurado-hint">Los resultados de esta edición aún no están disponibles en el archivo.</p></div>';
      return html;
    }

    var rows = edition.ranking.map(function (row) {
      return '<tr>' +
        '<td class="jurado-preliminar-rank">' + row.posicion + '</td>' +
        '<td><code class="jurado-preliminar-id">' + escapeHtml(row.competidorId) + '</code></td>' +
        '<td><strong>' + escapeHtml(row.nombreInscrito || row.participante) + '</strong></td>' +
        '<td class="jurado-preliminar-num">T' + row.entrada + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j1 + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j2 + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j3 + '</td>' +
        '<td class="jurado-preliminar-total"><strong>' + row.total + '</strong></td>' +
        '</tr>';
    }).join('');

    html +=
      '<div class="jurado-preliminar-table-wrap">' +
      '<table class="jurado-preliminar-table">' +
      '<thead><tr><th>#</th><th>ID</th><th>Competidor</th><th>Tanda</th><th>J1</th><th>J2</th><th>J3</th><th>Total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';

    if (edition.rawRows && edition.rawRows.length > edition.ranking.length) {
      html += '<details class="jurado-history-all-rounds"><summary>Ver las ' + edition.rawRows.length + ' tandas de la planilla</summary>';
      html += '<div class="jurado-preliminar-table-wrap"><table class="jurado-preliminar-table"><thead><tr>' +
        '<th>Competidor</th><th>Tanda</th><th>J1</th><th>J2</th><th>J3</th><th>Total</th></tr></thead><tbody>';
      edition.rawRows.forEach(function (row) {
        html += '<tr><td>' + escapeHtml(row.nombreInscrito || row.participante) + '</td>' +
          '<td class="jurado-preliminar-num">T' + row.entrada + '</td>' +
          '<td class="jurado-preliminar-num">' + row.j1 + '</td>' +
          '<td class="jurado-preliminar-num">' + row.j2 + '</td>' +
          '<td class="jurado-preliminar-num">' + row.j3 + '</td>' +
          '<td class="jurado-preliminar-total"><strong>' + row.total + '</strong></td></tr>';
      });
      html += '</tbody></table></div></details>';
    }

    html += '</div>';
    return html;
  }

  function downloadEditionKit(editionId) {
    if (editionId !== 'preliminar-1' || !global.Preliminar1Results) return false;
    var kit = global.Preliminar1Results.exportKit();
    var blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'v60-' + editionId + '-kit.json';
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  global.CompetitionHistory = {
    getEditions: getEditions,
    getEdition: getEdition,
    renderEditionsList: renderEditionsList,
    renderEditionSummaryCard: renderEditionSummaryCard,
    renderEditionDetail: renderEditionDetail,
    downloadEditionKit: downloadEditionKit
  };
})(typeof window !== 'undefined' ? window : globalThis);
