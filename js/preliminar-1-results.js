/**
 * V60 Championship — Preliminar 1 (planilla real + inscritos Sheets).
 * Cruzado con admin_dashboard · IDs SC-* · 3 jueces · 8 parámetros SCA/WBrC.
 * Regenerar doc: python3 tools/build_preliminar1_from_inscritos.py
 */
(function (global) {
  'use strict';

  var EVENT = {
    id: 'preliminar-1',
    nombre: 'V60 Championship — Preliminar 1',
    fecha: '4 de julio de 2026 · Plaza Marbella, Curis',
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

  /** Nombre corto en planilla → clave interna */
  var PLANILLA_TO_KEY = {
    Andrenia: 'andrenia',
    Angela: 'angela',
    Jessi: 'jessi',
    Brayan: 'brayan',
    Joe: 'joe',
    Useche: 'useche',
    Savedra: 'savedra',
    Manjares: 'manjares',
    Vera: 'vera',
    Linda: 'linda',
    Colorado: 'colorado',
    Polo: 'polo'
  };

  /**
   * Inscritos reales (Sheets · V60 Championship — Preliminar 1).
   * Sincronizado: 2026-07-05
   */
  var INSCRITOS = {
    andrenia: {
      key: 'andrenia',
      id: 'SC-MR6QU500',
      nombre: 'Andreina',
      planilla: 'Andrenia',
      ciudad: 'Cali',
      representa: 'Tierradentro',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1eBFiW59v84dNu8Bn0Ya_5vVavEGMFofN/view?usp=drivesdk',
      correo: 'apernia2412@gmail.com',
      documento: '1026308764'
    },
    angela: {
      key: 'angela',
      id: 'SC-MR14S1PV',
      nombre: 'Angela sibaja',
      planilla: 'Angela',
      ciudad: 'Cali',
      representa: 'El cafe de Astoria',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1s2v2QVXKpR0edyMN88skvllC-Hw3hvHH/view?usp=drivesdk',
      correo: 'angesibaja777@gmail.com',
      documento: '1143838869'
    },
    jessi: {
      key: 'jessi',
      id: 'SC-MR2CEGBE',
      nombre: 'Jessica combita',
      planilla: 'Jessi',
      ciudad: 'Cali',
      representa: 'MAS CAFÉ',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1F4HFFpdf2z3PlfWSRVs7NSxvHb9ekAsv/view?usp=drivesdk',
      correo: 'jesikaparra9@gmail.com',
      documento: '1018509921'
    },
    brayan: {
      key: 'brayan',
      id: 'SC-MR1B4PZS',
      nombre: 'Brayan Moreno G',
      planilla: 'Brayan',
      ciudad: 'Cali',
      representa: 'Médium Café',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1xAaWDVWrZD0UwdpZ1KXp3jgEWQQ1IDJO/view?usp=drivesdk',
      correo: 'bmgpersonal99@gmail.com',
      documento: '1234198183'
    },
    joe: {
      key: 'joe',
      id: 'SC-MQSNH3RD',
      nombre: 'Joe',
      planilla: 'Joe',
      ciudad: 'Cali',
      representa: 'Espressoyourself',
      habilitado: '',
      fotoUrl: 'https://drive.google.com/file/d/1BFrQIyP6YK2hvYv588Fie0mAJ2iz_L98/view?usp=drivesdk',
      correo: 'joehernandezpena@hotmail.com',
      documento: '1006172292'
    },
    useche: {
      key: 'useche',
      id: 'SC-MR488BBE',
      nombre: 'José Alejandro Useche',
      planilla: 'Useche',
      ciudad: 'Cali',
      representa: 'Purist café',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1Wohlim0taSLCBFsLR1W8rcD-n1XhTFfB/view?usp=drivesdk',
      correo: 'josealejandro.usechemahecha@gmail.com',
      documento: '1006072215'
    },
    savedra: {
      key: 'savedra',
      id: 'SC-MR2NRDPE',
      nombre: 'Juan David Saavedra cardona',
      planilla: 'Savedra',
      ciudad: 'Cali',
      representa: 'Independiente',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1jET4LD5HZ92cjFeemK4PQyKv6ltLc6Ht/view?usp=drivesdk',
      correo: 'judasaca34@gmail.com',
      documento: '1107847761'
    },
    manjares: {
      key: 'manjares',
      id: 'SC-MR442V2P',
      nombre: 'Juan Miguel Manjarres',
      planilla: 'Manjares',
      ciudad: 'Palmira',
      representa: 'Barista independiente',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/14jwUR6qJV79EL0a_dD9jJu2oOn-htsCT/view?usp=drivesdk',
      correo: 'juanmimanjarresilva@gmail.com',
      documento: '1021396326'
    },
    vera: {
      key: 'vera',
      id: 'SC-MR2KMUPR',
      nombre: 'Juan sebastian vera',
      planilla: 'Vera',
      ciudad: 'Cali',
      representa: 'Barista independiente',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/173jY-rAN4sh7_EpIchcFlDTFznh8mO1g/view?usp=drivesdk',
      correo: 'thesmilesmilingjj88@gmail.com',
      documento: '1006008177'
    },
    linda: {
      key: 'linda',
      id: 'SC-MR172ZIT',
      nombre: 'Linda Hernandez',
      planilla: 'Linda',
      ciudad: 'Cali',
      representa: 'Mas cafe',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1ArkCQeEZRqPOZjkFE2asOy9BdzidaoJP/view?usp=drivesdk',
      correo: 'lindahernandez200025@gmail.com',
      documento: '1005974653'
    },
    colorado: {
      key: 'colorado',
      id: 'SC-MQQQCABR',
      nombre: 'Santiago Colorado',
      planilla: 'Colorado',
      ciudad: 'Cali',
      representa: 'Delta Coffee',
      habilitado: '',
      fotoUrl: 'https://drive.google.com/file/d/1cDE3D6gPjgpbKDOg8a-DTVtxy9gmBX9x/view?usp=drivesdk',
      correo: 'santiagocoloradotrujillo@gmail.com',
      documento: '1006170225'
    },
    polo: {
      key: 'polo',
      id: 'SC-MR5J8QUJ',
      nombre: 'Ximena polo',
      planilla: 'Polo',
      ciudad: 'Cali',
      representa: 'Black coffee',
      habilitado: 'Sí',
      fotoUrl: 'https://drive.google.com/file/d/1VJsPhFiGTfDc6aXqYlIlDk1GhtweDjGM/view?usp=drivesdk',
      correo: 'ximena.polo@gmail.com',
      documento: '31320969'
    }
  };

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

  function resolveInscritoKey(participante) {
    var p = String(participante || '').trim();
    if (PLANILLA_TO_KEY[p]) return PLANILLA_TO_KEY[p];
    var slug = slugId(p);
    var keys = Object.keys(INSCRITOS);
    for (var i = 0; i < keys.length; i++) {
      var ins = INSCRITOS[keys[i]];
      if (ins.id === p || slugId(ins.nombre) === slug || ins.key === slug) return ins.key;
    }
    return '';
  }

  function resolveInscrito(participanteOrKey) {
    var key = resolveInscritoKey(participanteOrKey);
    if (key && INSCRITOS[key]) return INSCRITOS[key];
    var direct = INSCRITOS[participanteOrKey];
    if (direct) return direct;
    return null;
  }

  function resolveInscritoId(participanteOrId) {
    var ins = resolveInscrito(participanteOrId);
    if (ins && ins.id) return ins.id;
    var s = String(participanteOrId || '').trim();
    if (/^SC-/i.test(s)) return s;
    return slugId(s);
  }

  function getInscritosList() {
    return Object.keys(INSCRITOS).map(function (k) { return INSCRITOS[k]; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
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
    var now = new Date().toISOString();
    return {
      j1: {
        scores: distributeTotal(j1, competidorSeed + '-j1'),
        subtotal: j1,
        actualizado: now,
        imported: true
      },
      j2: {
        scores: distributeTotal(j2, competidorSeed + '-j2'),
        subtotal: j2,
        actualizado: now,
        imported: true
      },
      j3: {
        scores: distributeTotal(j3, competidorSeed + '-j3'),
        subtotal: j3,
        actualizado: now,
        imported: true
      }
    };
  }

  function enrichRow(row) {
    var inscrito = resolveInscrito(row.participante);
    var seed = (inscrito ? inscrito.id : slugId(row.participante)) + '-e' + row.entrada;
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
      competidorId: inscrito ? inscrito.id : slugId(row.participante),
      inscritoKey: inscrito ? inscrito.key : '',
      nombreInscrito: inscrito ? inscrito.nombre : row.participante,
      ciudad: inscrito ? inscrito.ciudad : '',
      representa: inscrito ? inscrito.representa : '',
      fotoUrl: inscrito ? inscrito.fotoUrl : '',
      inscrito: inscrito,
      judges: judges,
      breakdown: breakdown,
      sumaVerificada: row.j1 + row.j2 + row.j3
    });
  }

  function getEnrichedRows() {
    return RAW_ROWS.map(enrichRow);
  }

  function getRowsByEntrada(entrada) {
    return getEnrichedRows().filter(function (r) { return r.entrada === entrada; })
      .sort(function (a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.participante.localeCompare(b.participante, 'es');
      });
  }

  function entradaLabel(entrada) {
    if (entrada === 1) return 'Clasificatoria';
    if (entrada === 2) return 'Semifinal';
    if (entrada === 3) return 'Final';
    return 'Tanda ' + entrada;
  }

  /** Texto que explica la lógica del puntaje (planilla solo trae subtotales por juez). */
  function scoringMethodNote() {
    return 'La planilla original registra el subtotal de cada juez (J1+J2+J3). ' +
      'Como no hay nota por parámetro en papel, el sistema reconstruye el desglose en 8 criterios SCA/WBrC ' +
      '(escala ' + EVENT.scaleMin + '–' + EVENT.scaleMax + ' por criterio) repartiendo cada subtotal de forma ' +
      'determinística: la suma de los 8 parámetros de un juez coincide exactamente con su columna J1, J2 o J3.';
  }

  function buildJudgeBreakdownLines(judgeKey, judgeBlock) {
    var block = judgeBlock[judgeKey];
    if (!block || !block.scores) return [];
    return CRITERIA.map(function (c) {
      return {
        key: c.key,
        label: c.label,
        valor: block.scores[c.key],
        judgeKey: judgeKey
      };
    });
  }

  function renderBreakdownTableHtml(row, opts) {
    opts = opts || {};
    var compact = !!opts.compact;
    var judges = row.judges || {};
    var head = '<thead><tr><th>Parámetro</th><th>J1</th><th>J2</th><th>J3</th><th>Suma</th></tr></thead>';
    var body = CRITERIA.map(function (c) {
      var v1 = judges.j1 && judges.j1.scores ? judges.j1.scores[c.key] : '—';
      var v2 = judges.j2 && judges.j2.scores ? judges.j2.scores[c.key] : '—';
      var v3 = judges.j3 && judges.j3.scores ? judges.j3.scores[c.key] : '—';
      var suma = (typeof v1 === 'number' ? v1 : 0) + (typeof v2 === 'number' ? v2 : 0) + (typeof v3 === 'number' ? v3 : 0);
      return '<tr><td>' + c.label + '</td>' +
        '<td class="jurado-preliminar-num">' + v1 + '</td>' +
        '<td class="jurado-preliminar-num">' + v2 + '</td>' +
        '<td class="jurado-preliminar-num">' + v3 + '</td>' +
        '<td class="jurado-preliminar-num"><strong>' + suma + '</strong></td></tr>';
    }).join('');
    var foot = '<tfoot><tr class="jurado-preliminar-breakdown-total">' +
      '<td><strong>Subtotal juez</strong></td>' +
      '<td class="jurado-preliminar-num"><strong>' + row.j1 + '</strong></td>' +
      '<td class="jurado-preliminar-num"><strong>' + row.j2 + '</strong></td>' +
      '<td class="jurado-preliminar-num"><strong>' + row.j3 + '</strong></td>' +
      '<td class="jurado-preliminar-total"><strong>' + row.total + '</strong></td></tr></tfoot>';
    var title = compact ? '' : (
      '<p class="jurado-preliminar-breakdown-lead">' +
      '<strong>' + row.participante + '</strong> · ' + entradaLabel(row.entrada) +
      ' · total <strong>' + row.total + '</strong> = ' + row.j1 + ' + ' + row.j2 + ' + ' + row.j3 +
      '</p>'
    );
    return title +
      '<div class="jurado-preliminar-breakdown-wrap">' +
      '<table class="jurado-preliminar-table jurado-preliminar-table--breakdown">' +
      head + '<tbody>' + body + '</tbody>' + foot + '</table></div>';
  }

  function renderBreakdownMarkdown(row) {
    var lines = [
      '#### ' + row.participante + ' — ' + entradaLabel(row.entrada) + ' (total **' + row.total + '**)',
      '',
      'Subtotales: J1=' + row.j1 + ' · J2=' + row.j2 + ' · J3=' + row.j3 + ' → **' + row.total + '**',
      '',
      '| Parámetro | J1 | J2 | J3 | Suma 3 jueces |',
      '|---|--:|--:|--:|--:|'
    ];
    (row.breakdown || []).forEach(function (b) {
      lines.push('| ' + b.label + ' | ' + b.j1 + ' | ' + b.j2 + ' | ' + b.j3 + ' | **' + b.suma + '** |');
    });
    lines.push('| **Subtotal juez** | **' + row.j1 + '** | **' + row.j2 + '** | **' + row.j3 + '** | **' + row.total + '** |');
    lines.push('');
    return lines.join('\n');
  }

  function buildBreakdownDocumentMarkdown() {
    var lines = [
      '## Cómo se calcula el puntaje',
      '',
      scoringMethodNote(),
      '',
      '**Fórmula:** total competidor = subtotal J1 + subtotal J2 + subtotal J3, donde cada subtotal = suma de los 8 parámetros (máx. ' +
      (CRITERIA.length * EVENT.scaleMax) + ' pts por juez).',
      '',
      '**Parámetros evaluados:** ' + CRITERIA.map(function (c) { return c.label; }).join(', ') + '.',
      ''
    ];
    [1, 2, 3].forEach(function (entrada) {
      var phaseRows = getRowsByEntrada(entrada);
      if (!phaseRows.length) return;
      lines.push('## ' + entradaLabel(entrada));
      lines.push('');
      phaseRows.forEach(function (row) {
        lines.push(renderBreakdownMarkdown(row));
      });
    });
    lines.push('## Ranking importado (mejor tanda por competidor)');
    lines.push('');
    lines.push('Al pulsar «Cargar Preliminar 1» en la Consola, se usa la tanda con mayor total de cada uno.');
    lines.push('');
    getRankingConsolidado().forEach(function (row) {
      lines.push(renderBreakdownMarkdown(row));
    });
    return lines.join('\n');
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
        nombre: row.nombreInscrito || row.participante,
        judges: row.judges,
        notasPorJuez: { j1: '', j2: '', j3: '' },
        sumaTotal: suma,
        promedio: Math.round((suma / 3) * 10) / 10,
        actualizado: now,
        meta: {
          evento: EVENT.nombre,
          entradaUsada: row.entrada,
          preliminar: 1,
          planilla: row.participante,
          inscritoId: row.competidorId,
          ciudad: row.ciudad || '',
          representa: row.representa || ''
        }
      };
    });
    return { scores: scores, actualizado: now };
  }

  function buildCompetidorList() {
    return getRankingConsolidado().map(function (row) {
      return {
        id: row.competidorId,
        nombre: row.nombreInscrito || row.participante,
        ciudad: row.ciudad || '',
        representa: row.representa || ('Preliminar 1 · tanda ' + row.entrada),
        fotoUrl: row.fotoUrl || '',
        posicion: row.posicion,
        total: row.total,
        planilla: row.participante,
        entradaUsada: row.entrada
      };
    });
  }

  function buildPlatformConfigSnippet() {
    return {
      eventName: EVENT.nombre,
      eventId: EVENT.nombre,
      eventSubtitle: 'Café filtrado V60 · 3 jueces · 8 parámetros SCA',
      scoring: {
        disciplina: 'filtrado',
        modo: 'puntaje_general',
        scaleMin: 1,
        scaleMax: 6,
        jueces: 3,
        avancePorRonda: 8,
        autoAvance: true,
        competidoresEsperados: 12,
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
      syncedAt: '2026-07-05T22:45:00.000Z',
      event: EVENT,
      criteria: CRITERIA,
      inscritos: getInscritosList(),
      crosswalk: PLANILLA_TO_KEY,
      rawRows: getEnrichedRows(),
      ranking: getRankingConsolidado(),
      calificaciones: buildCalificacionesStore(),
      competidores: buildCompetidorList(),
      platformConfig: buildPlatformConfigSnippet(),
      scoringMethodNote: scoringMethodNote(),
      breakdownMarkdown: buildBreakdownDocumentMarkdown(),
      exportedAt: new Date().toISOString()
    };
  }

  global.Preliminar1Results = {
    EVENT: EVENT,
    CRITERIA: CRITERIA,
    PLANILLA_TO_KEY: PLANILLA_TO_KEY,
    INSCRITOS: INSCRITOS,
    RAW_ROWS: RAW_ROWS,
    resolveInscrito: resolveInscrito,
    resolveInscritoId: resolveInscritoId,
    resolveInscritoKey: resolveInscritoKey,
    getInscritosList: getInscritosList,
    getEnrichedRows: getEnrichedRows,
    getRowsByEntrada: getRowsByEntrada,
    entradaLabel: entradaLabel,
    scoringMethodNote: scoringMethodNote,
    renderBreakdownTableHtml: renderBreakdownTableHtml,
    renderBreakdownMarkdown: renderBreakdownMarkdown,
    buildBreakdownDocumentMarkdown: buildBreakdownDocumentMarkdown,
    getRankingConsolidado: getRankingConsolidado,
    buildCalificacionesStore: buildCalificacionesStore,
    buildCompetidorList: buildCompetidorList,
    buildPlatformConfigSnippet: buildPlatformConfigSnippet,
    distributeTotal: distributeTotal,
    exportKit: exportKit
  };
})(typeof window !== 'undefined' ? window : globalThis);
