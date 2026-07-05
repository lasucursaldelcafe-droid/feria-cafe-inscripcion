/**
 * V60 Championship — Preliminar 1 (datos reales de la mesa de jurado).
 * 3 jueces · totales por competidor · desglose en 8 parámetros SCA/WBrC.
 */
(function (global) {
  'use strict';

  var EVENT = {
    id: 'preliminar-1',
    nombre: 'V60 Championship — Preliminar 1',
    fecha: 'Preliminar 1 (registrada)',
    disciplina: 'filtrado',
    jueces: 3,
    scaleMin: 1,
    scaleMax: 6
  };

  var CRITERIA = [
    { key: 'aroma', label: 'Aroma' },
    { key: 'sabor', label: 'Sabor' },
    { key: 'acidez', label: 'Acidez' },
    { key: 'dulzor', label: 'Dulzor' },
    { key: 'cuerpo', label: 'Cuerpo' },
    { key: 'balance', label: 'Balance' },
    { key: 'limpieza_taza', label: 'Limpieza de taza' },
    { key: 'impresion_general', label: 'Impresión general' }
  ];

  /** Filas tal como aparecen en la planilla de la preliminar 1 */
  var RAW_ROWS = [
    { participante: 'Andrenia', entrada: 1, j1: 29, j2: 24, j3: 27, total: 80 },
    { participante: 'Andrenia', entrada: 2, j1: 18, j2: 18, j3: 22, total: 58 },
    { participante: 'Angela', entrada: 1, j1: 26, j2: 22, j3: 24, total: 72 },
    { participante: 'Jessi', entrada: 1, j1: 18, j2: 24, j3: 23, total: 65 },
    { participante: 'Jessi', entrada: 2, j1: 26, j2: 24, j3: 29, total: 79 },
    { participante: 'Jessi', entrada: 3, j1: 22, j2: 27, j3: 19, total: 68 },
    { participante: 'Brayan', entrada: 1, j1: 18, j2: 19, j3: 21, total: 58 },
    { participante: 'Joe', entrada: 1, j1: 28, j2: 21, j3: 19, total: 68 },
    { participante: 'Useche', entrada: 1, j1: 31, j2: 25, j3: 24, total: 80 },
    { participante: 'Useche', entrada: 2, j1: 30, j2: 27, j3: 25, total: 82 },
    { participante: 'Useche', entrada: 3, j1: 27, j2: 26, j3: 26, total: 79 },
    { participante: 'Savedra', entrada: 1, j1: 23, j2: 23, j3: 23, total: 69 },
    { participante: 'Savedra', entrada: 2, j1: 24, j2: 24, j3: 22, total: 70 },
    { participante: 'Manjares', entrada: 1, j1: 19, j2: 21, j3: 24, total: 64 },
    { participante: 'Vera', entrada: 1, j1: 19, j2: 20, j3: 21, total: 60 },
    { participante: 'Linda', entrada: 1, j1: 27, j2: 24, j3: 22, total: 73 },
    { participante: 'Linda', entrada: 2, j1: 26, j2: 23, j3: 21, total: 70 },
    { participante: 'Colorado', entrada: 1, j1: 27, j2: 23, j3: 26, total: 76 },
    { participante: 'Colorado', entrada: 2, j1: 27, j2: 26, j3: 26, total: 79 },
    { participante: 'Colorado', entrada: 3, j1: 28, j2: 29, j3: 25, total: 82 },
    { participante: 'Polo', entrada: 1, j1: 24, j2: 26, j3: 21, total: 71 }
  ];

  function slugId(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return Math.abs(h);
  }

  /** Reparte el subtotal del juez en 8 criterios (escala 1–6) sumando exactamente `total`. */
  function distributeTotal(total, seed) {
    var keys = CRITERIA.map(function (c) { return c.key; });
    var n = keys.length;
    var minV = EVENT.scaleMin;
    var maxV = EVENT.scaleMax;
    var t = Math.max(n * minV, Math.min(n * maxV, Math.round(total)));
    var scores = {};
    keys.forEach(function (k) { scores[k] = minV; });
    var left = t - n * minV;
    var order = keys.slice().sort(function (a, b) {
      return (hashStr(a + ':' + seed) % 97) - (hashStr(b + ':' + seed) % 97);
    });
    var guard = 0;
    while (left > 0 && guard < 500) {
      var k = order[guard % n];
      if (scores[k] < maxV) {
        scores[k]++;
        left--;
      }
      guard++;
    }
    return scores;
  }

  function buildJudgeBlock(j1, j2, j3, competidorSeed) {
    return {
      j1: {
        scores: distributeTotal(j1, competidorSeed + '-j1'),
        subtotal: j1,
        actualizado: ''
      },
      j2: {
        scores: distributeTotal(j2, competidorSeed + '-j2'),
        subtotal: j2,
        actualizado: ''
      },
      j3: {
        scores: distributeTotal(j3, competidorSeed + '-j3'),
        subtotal: j3,
        actualizado: ''
      }
    };
  }

  function enrichRow(row) {
    var seed = slugId(row.participante) + '-e' + row.entrada;
    var judges = buildJudgeBlock(row.j1, row.j2, row.j3, seed);
    var breakdown = CRITERIA.map(function (c) {
      return {
        key: c.key,
        label: c.label,
        j1: judges.j1.scores[c.key],
        j2: judges.j2.scores[c.key],
        j3: judges.j3.scores[c.key],
        suma: judges.j1.scores[c.key] + judges.j2.scores[c.key] + judges.j3.scores[c.key]
      };
    });
    return Object.assign({}, row, {
      id: seed,
      competidorId: slugId(row.participante),
      judges: judges,
      breakdown: breakdown,
      sumaVerificada: row.j1 + row.j2 + row.j3
    });
  }

  function getEnrichedRows() {
    return RAW_ROWS.map(enrichRow);
  }

  /** Mejor tanda por competidor (mayor total de la preliminar). */
  function getRankingConsolidado() {
    var best = {};
    getEnrichedRows().forEach(function (row) {
      var id = row.competidorId;
      if (!best[id] || row.total > best[id].total) best[id] = row;
    });
    return Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.participante.localeCompare(b.participante, 'es');
      })
      .map(function (row, idx) {
        return Object.assign({}, row, { posicion: idx + 1 });
      });
  }

  function buildCalificacionesStore() {
    var scores = {};
    var now = new Date().toISOString();
    getRankingConsolidado().forEach(function (row) {
      var suma = row.j1 + row.j2 + row.j3;
      scores[row.competidorId] = {
        competidorId: row.competidorId,
        nombre: row.participante,
        judges: row.judges,
        notasPorJuez: { j1: '', j2: '', j3: '' },
        sumaTotal: suma,
        promedio: Math.round((suma / 3) * 10) / 10,
        actualizado: now,
        meta: {
          evento: EVENT.nombre,
          entradaUsada: row.entrada,
          preliminar: 1
        }
      };
    });
    return { scores: scores, actualizado: now };
  }

  function buildCompetidorList() {
    return getRankingConsolidado().map(function (row, idx) {
      return {
        id: row.competidorId,
        nombre: row.participante,
        ciudad: '',
        representa: 'Preliminar 1 · tanda ' + row.entrada,
        posicion: row.posicion,
        total: row.total
      };
    });
  }

  function buildPlatformConfigSnippet() {
    return {
      eventName: EVENT.nombre,
      eventSubtitle: 'Café filtrado V60 · 3 jueces · 8 parámetros SCA',
      scoring: {
        disciplina: 'filtrado',
        modo: 'puntaje_general',
        scaleMin: 1,
        scaleMax: 6,
        jueces: 3,
        avancePorRonda: 8,
        autoAvance: true,
        competidoresEsperados: 16,
        mostrarFotos: true,
        criteria: CRITERIA.map(function (c) {
          return { key: c.key, label: c.label, desc: 'Parámetro sensorial SCA / WBrC' };
        })
      }
    };
  }

  function exportKit() {
    return {
      platform: 'jurado-v60',
      source: 'preliminar-1-results',
      event: EVENT,
      criteria: CRITERIA,
      rawRows: getEnrichedRows(),
      ranking: getRankingConsolidado(),
      calificaciones: buildCalificacionesStore(),
      competidores: buildCompetidorList(),
      platformConfig: buildPlatformConfigSnippet(),
      exportedAt: new Date().toISOString()
    };
  }

  global.Preliminar1Results = {
    EVENT: EVENT,
    CRITERIA: CRITERIA,
    RAW_ROWS: RAW_ROWS,
    getEnrichedRows: getEnrichedRows,
    getRankingConsolidado: getRankingConsolidado,
    buildCalificacionesStore: buildCalificacionesStore,
    buildCompetidorList: buildCompetidorList,
    buildPlatformConfigSnippet: buildPlatformConfigSnippet,
    distributeTotal: distributeTotal,
    exportKit: exportKit
  };
})(typeof window !== 'undefined' ? window : globalThis);
