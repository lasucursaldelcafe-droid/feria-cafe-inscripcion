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

  function driveThumbUrl(url, size) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w' + (size || 200);
    if (/^https?:\/\//i.test(s)) return s;
    return '';
  }

  function competitorPhotoHtml(fotoUrl, size, alt) {
    var thumb = Math.max(64, Math.round((size || 44) * 2));
    var url = driveThumbUrl(fotoUrl, thumb);
    if (!url) {
      return '<span class="jurado-clasificacion-photo jurado-clasificacion-photo--empty" aria-hidden="true"></span>';
    }
    return '<img class="jurado-clasificacion-photo" src="' + escapeHtml(url) + '" alt="' +
      escapeHtml(alt || '') + '" loading="lazy" referrerpolicy="no-referrer">';
  }

  function posMedalClass(pos) {
    if (pos === 1) return 'jurado-clasificacion-card--gold';
    if (pos === 2) return 'jurado-clasificacion-card--silver';
    if (pos === 3) return 'jurado-clasificacion-card--bronze';
    return '';
  }

  function getPhaseRows(edition, entrada) {
    var rows = edition.rawRows || [];
    return rows.filter(function (r) { return r.entrada === entrada; })
      .slice()
      .sort(function (a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return (a.participante || '').localeCompare(b.participante || '', 'es');
      });
  }

  function phaseLabel(entrada) {
    if (global.Preliminar1Results && global.Preliminar1Results.entradaLabel) {
      return global.Preliminar1Results.entradaLabel(entrada);
    }
    if (entrada === 1) return 'Grupos';
    if (entrada === 2) return 'Semifinal';
    if (entrada === 3) return 'Final';
    return 'Tanda ' + entrada;
  }

  function renderGruposRondas(edition) {
    var rounds = edition.gruposRondas || [];
    if (!rounds.length) return '';
    var cards = rounds.map(function (round) {
      function chip(row, cls) {
        if (!row) return '';
        var name = row.nombreInscrito || row.participante;
        var inSemi = (round.clasificaronSemi || []).indexOf(row.participante) >= 0;
        return '<div class="jurado-grupo-duo ' + cls + (inSemi ? ' jurado-grupo-duo--semi' : '') + '">' +
          competitorPhotoHtml(row.fotoUrl, 44, name) +
          '<div class="jurado-grupo-duo__body">' +
          '<strong>' + escapeHtml(name) + '</strong>' +
          '<span class="jurado-grupo-duo__pts">' + row.total + ' pts</span>' +
          (inSemi ? '<span class="jurado-grupo-duo__badge">→ Semi</span>' : '') +
          '</div></div>';
      }
      return '<article class="jurado-grupo-ronda">' +
        '<h4 class="jurado-grupo-ronda__title">Ronda ' + round.ronda + '</h4>' +
        '<div class="jurado-grupo-ronda__duo">' +
        chip(round.participanteA, 'jurado-grupo-duo--a') +
        '<span class="jurado-grupo-ronda__vs">vs</span>' +
        chip(round.participanteB, 'jurado-grupo-duo--b') +
        '</div></article>';
    }).join('');
    return '<section class="jurado-clasificacion-section">' +
      '<h3 class="jurado-clasificacion-title">Grupos — rondas de 2</h3>' +
      '<p class="jurado-hint">12 competidores · orden alfabético por nombre · a semifinal los mejores puntajes de cada ronda.</p>' +
      '<div class="jurado-grupos-rondas">' + cards + '</div></section>';
  }

  function renderPodiumMap(edition) {
    var top = edition.podioFinal || edition.podio || (edition.ranking || []).slice(0, 3);
    if (!top.length) return '';
    var order = top.length >= 3 ? [top[1], top[0], top[2]] : top;
    var cards = order.map(function (row) {
      var name = row.nombreInscrito || row.participante;
      return '<div class="jurado-podium-slot ' + posMedalClass(row.posicion) + '">' +
        '<span class="jurado-podium-pos">' + row.posicion + '°</span>' +
        competitorPhotoHtml(row.fotoUrl, 48, name) +
        '<strong class="jurado-podium-name">' + escapeHtml(name) + '</strong>' +
        '<span class="jurado-podium-meta">' + escapeHtml(row.representa || row.ciudad || '') + '</span>' +
        '<span class="jurado-podium-pts">' + row.total + ' pts</span>' +
        '</div>';
    }).join('');
    return '<section class="jurado-clasificacion-section">' +
      '<h3 class="jurado-clasificacion-title">Podio oficial</h3>' +
      '<p class="jurado-hint">1°, 2° y 3° por puntaje en la final.</p>' +
      '<div class="jurado-podium-map">' + cards + '</div></section>';
  }

  function renderClassificationGrid(edition) {
    var ranking = edition.ranking || [];
    if (!ranking.length) return '';
    var cards = ranking.map(function (row) {
      var name = row.nombreInscrito || row.participante;
      var sub = row.participante !== name
        ? '<span class="jurado-clasificacion-planilla">' + escapeHtml(row.participante) + '</span>'
        : '';
      return '<article class="jurado-clasificacion-card ' + posMedalClass(row.posicion) + '">' +
        '<span class="jurado-clasificacion-rank">' + row.posicion + '°</span>' +
        competitorPhotoHtml(row.fotoUrl, 44, name) +
        '<strong class="jurado-clasificacion-name">' + escapeHtml(name) + '</strong>' +
        sub +
        '<span class="jurado-clasificacion-meta">' + escapeHtml(row.representa || '') + '</span>' +
        '<span class="jurado-clasificacion-scores">J1 ' + row.j1 + ' · J2 ' + row.j2 + ' · J3 ' + row.j3 + '</span>' +
        '<span class="jurado-clasificacion-total">' + row.total + ' pts</span>' +
        '<span class="jurado-clasificacion-phase">' + escapeHtml(phaseLabel(row.entrada)) + '</span>' +
        '</article>';
    }).join('');
    return '<section class="jurado-clasificacion-section">' +
      '<h3 class="jurado-clasificacion-title">Mapa de clasificación</h3>' +
      '<p class="jurado-hint">Ranking por mejor tanda de cada competidor · podio oficial = final.</p>' +
      '<div class="jurado-clasificacion-grid">' + cards + '</div></section>';
  }

  function renderPhaseLanes(edition) {
    var phases = [1, 2, 3].map(function (entrada) {
      var rows = getPhaseRows(edition, entrada);
      if (!rows.length) return '';
      var items = rows.map(function (row, idx) {
        var name = row.nombreInscrito || row.participante;
        return '<div class="jurado-phase-chip">' +
          '<span class="jurado-phase-chip-pos">' + (idx + 1) + '</span>' +
          competitorPhotoHtml(row.fotoUrl, 32, name) +
          '<span class="jurado-phase-chip-name">' + escapeHtml(name) + '</span>' +
          '<span class="jurado-phase-chip-pts">' + row.total + '</span>' +
          '</div>';
      }).join('');
      return '<div class="jurado-phase-lane jurado-phase-lane--' + entrada + '">' +
        '<h4>' + phaseLabel(entrada) + ' <span class="jurado-phase-count">(' + rows.length + ')</span></h4>' +
        '<div class="jurado-phase-lane-body">' + items + '</div></div>';
    }).filter(Boolean).join('');
    if (!phases) return '';
    return '<section class="jurado-clasificacion-section">' +
      '<h3 class="jurado-clasificacion-title">Recorrido por fases</h3>' +
      '<div class="jurado-phase-lanes">' + phases + '</div></section>';
  }

  function renderBreakdownSection(edition) {
    if (edition.id !== 'preliminar-1' || !global.Preliminar1Results) return '';
    var P = global.Preliminar1Results;
    var blocks = [1, 2, 3].map(function (entrada) {
      var rows = P.getRowsByEntrada ? P.getRowsByEntrada(entrada) : [];
      if (!rows.length) return '';
      var items = rows.map(function (row) {
        return '<details class="jurado-preliminar-phase-item">' +
          '<summary><strong>' + escapeHtml(row.participante) + '</strong> · ' +
          row.j1 + '+' + row.j2 + '+' + row.j3 + ' = ' + row.total + '</summary>' +
          P.renderBreakdownTableHtml(row) +
          '</details>';
      }).join('');
      return '<div class="jurado-preliminar-phase"><h4>' + escapeHtml(P.entradaLabel(entrada)) + '</h4>' + items + '</div>';
    }).filter(Boolean).join('');
    if (!blocks) return '';
    return '<section class="jurado-clasificacion-section">' +
      '<h3 class="jurado-clasificacion-title">Desglose por parámetros SCA</h3>' +
      '<p class="jurado-hint">' + escapeHtml(P.scoringMethodNote()) + '</p>' +
      '<div class="jurado-preliminar-phases">' + blocks + '</div></section>';
  }

  function getPreliminar1Edition() {
    if (!global.Preliminar1Results) return null;
    var kit = global.Preliminar1Results.exportKit();
    var ranking = kit.ranking || [];
    var podioFinal = kit.podioFinal || [];
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
      formatDescription: kit.formatDescription || '',
      gruposRondas: kit.gruposRondas || [],
      podio: podioFinal.map(function (r) {
        return {
          posicion: r.posicion,
          nombre: r.nombreInscrito || r.participante,
          total: r.total,
          id: r.competidorId,
          fotoUrl: r.fotoUrl || '',
          representa: r.representa || '',
          ciudad: r.ciudad || '',
          fase: 'final'
        };
      }),
      podioFinal: podioFinal,
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
      podioHtml = '<ol class="jurado-history-podio jurado-history-podio--photos">' +
        edition.podio.map(function (p) {
          var photo = competitorPhotoHtml(p.fotoUrl, 36, p.nombre);
          return '<li class="jurado-history-podio-item ' + posMedalClass(p.posicion) + '">' +
            photo +
            '<span class="jurado-history-podio-pos">' + p.posicion + '°</span> ' +
            '<span class="jurado-history-podio-text">' +
            '<strong>' + escapeHtml(p.nombre) + '</strong>' +
            (p.representa ? '<span class="jurado-history-podio-meta">' + escapeHtml(p.representa) + '</span>' : '') +
            '</span>' +
            '<span class="jurado-history-podio-pts">' + p.total + ' pts</span></li>';
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
      (edition.formatDescription
        ? '<p class="jurado-history-format">' + escapeHtml(edition.formatDescription) + '</p>'
        : '') +
      '</header>';

    if (!edition.hasResults || !edition.ranking || !edition.ranking.length) {
      html += '<p class="jurado-hint">Los resultados de esta edición aún no están disponibles en el archivo.</p></div>';
      return html;
    }

    html += renderPodiumMap(edition);
    html += renderGruposRondas(edition);
    html += renderClassificationGrid(edition);
    html += renderPhaseLanes(edition);

    var rows = edition.ranking.map(function (row) {
      var name = row.nombreInscrito || row.participante;
      return '<tr>' +
        '<td class="jurado-preliminar-rank">' + row.posicion + '</td>' +
        '<td class="jurado-clasificacion-table-photo">' + competitorPhotoHtml(row.fotoUrl, 32, name) + '</td>' +
        '<td><code class="jurado-preliminar-id">' + escapeHtml(row.competidorId) + '</code></td>' +
        '<td><strong>' + escapeHtml(name) + '</strong>' +
        (row.representa ? '<br><span class="jurado-hint">' + escapeHtml(row.representa) + '</span>' : '') +
        '</td>' +
        '<td class="jurado-preliminar-num">' + escapeHtml(phaseLabel(row.entrada)) + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j1 + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j2 + '</td>' +
        '<td class="jurado-preliminar-num">' + row.j3 + '</td>' +
        '<td class="jurado-preliminar-total"><strong>' + row.total + '</strong></td>' +
        '</tr>';
    }).join('');

    html +=
      '<section class="jurado-clasificacion-section">' +
      '<h3 class="jurado-clasificacion-title">Tabla de resultados</h3>' +
      '<div class="jurado-preliminar-table-wrap">' +
      '<table class="jurado-preliminar-table">' +
      '<thead><tr><th>#</th><th>Foto</th><th>ID</th><th>Competidor</th><th>Fase</th><th>J1</th><th>J2</th><th>J3</th><th>Total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></section>';

    html += renderBreakdownSection(edition);

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
    renderPodiumMap: renderPodiumMap,
    renderClassificationGrid: renderClassificationGrid,
    renderPhaseLanes: renderPhaseLanes,
    downloadEditionKit: downloadEditionKit
  };
})(typeof window !== 'undefined' ? window : globalThis);
