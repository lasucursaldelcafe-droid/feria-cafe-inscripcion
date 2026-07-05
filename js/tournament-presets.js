/**
 * Plantillas de torneo basadas en campeonatos mundiales y entidades reguladoras.
 * Referencias: WCE (World Coffee Events), SCA, WAC (World Aeropress Championship).
 */
(function (global) {
  'use strict';

  var PRESETS = {
    filtrado: {
      id: 'filtrado',
      label: 'Filtrado / Brewers',
      entity: 'WCE — World Brewers Cup',
      reference: 'WBrC',
      eventSubtitle: 'WBrC · Filtrado V60 en duelos 1v1',
      reglamentoUrl: 'reglas',
      modo: 'duelos',
      jueces: 3,
      scaleMin: 1,
      scaleMax: 6,
      competidoresEsperados: 16,
      avancePorRonda: 0,
      criteria: [
        { key: 'aroma', label: 'Aroma', desc: 'Intensidad y calidad en seco y húmedo (SCA)' },
        { key: 'sabor', label: 'Sabor', desc: 'Amplitud, complejidad y definición del perfil' },
        { key: 'acidez', label: 'Acidez', desc: 'Calidad, intensidad y tipo de acidez' },
        { key: 'dulzor', label: 'Dulzor', desc: 'Percepción de dulzor natural en taza' },
        { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura y sensación en boca' },
        { key: 'balance', label: 'Balance', desc: 'Integración armónica de atributos' },
        { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Ausencia de defectos u off-flavors' },
        { key: 'impresion_general', label: 'Impresión general', desc: 'Experiencia global de la bebida servida' }
      ],
      tips: [
        'El WBrC evalúa una sola bebida filtrada servida al jurado; el formato 1v1 (duelos) replica las rondas eliminatorias.',
        'Recomendado: 3 jueces sensoriales con escala 1–6 (convención SCA en competencias internacionales).',
        'Para 8–16 competidores: octavos → cuartos → semifinal → final. El sistema calcula el cuadro automáticamente.',
        'Solicita foto del competidor en inscripción para identificarlo en el panel de calificación en vivo.'
      ]
    },
    catacion: {
      id: 'catacion',
      label: 'Catación / Cup Tasters',
      entity: 'WCE — World Cup Tasters Championship',
      reference: 'WCTC',
      eventSubtitle: 'WCTC · Catación por triángulos y ranking',
      reglamentoUrl: 'https://worldcoffeeevents.org/competitions/world-cup-tasters-championship/',
      modo: 'puntaje_general',
      jueces: 3,
      scaleMin: 0,
      scaleMax: 8,
      competidoresEsperados: 24,
      avancePorRonda: 8,
      criteria: [
        { key: 'triangulos_correctos', label: 'Triángulos correctos', desc: 'Discriminación sensorial en rondas de triángulo' },
        { key: 'precision_olfativa', label: 'Precisión olfativa', desc: 'Identificación de aromas y diferencias sutiles' },
        { key: 'consistencia', label: 'Consistencia', desc: 'Estabilidad entre rondas consecutivas' },
        { key: 'velocidad', label: 'Velocidad', desc: 'Tiempo de respuesta sin sacrificar precisión' },
        { key: 'impresion_general', label: 'Impresión general', desc: 'Desempeño global del catador' }
      ],
      tips: [
        'El WCTC clasifica por puntaje acumulado en rondas; usa modo «Puntaje general (ranking)».',
        'Escala 0–8 por ronda es habitual en entrenamientos; ajusta según tu protocolo local.',
        'Define cuántos avanzan por ronda (ej. top 8) en «Avance por ronda» o deja 0 para cálculo automático.',
        'Ideal para 16–32 catadores; con más de 32 el sistema puede activar fase de grupos automáticamente.'
      ]
    },
    arte_latte: {
      id: 'arte_latte',
      label: 'Arte latte',
      entity: 'WCE — World Latte Art Championship',
      reference: 'WLAC',
      eventSubtitle: 'WLAC · Arte latte en duelos eliminatorios',
      reglamentoUrl: 'https://worldcoffeeevents.org/competitions/world-latte-art-championship/',
      modo: 'duelos',
      jueces: 3,
      scaleMin: 1,
      scaleMax: 6,
      competidoresEsperados: 12,
      avancePorRonda: 0,
      criteria: [
        { key: 'patron_visual', label: 'Patrón visual', desc: 'Definición, simetría y contraste del diseño' },
        { key: 'complejidad', label: 'Complejidad', desc: 'Dificultad técnica del vertido' },
        { key: 'textura_leche', label: 'Textura de leche', desc: 'Microespuma brillante y sedosa' },
        { key: 'sabor_bebida', label: 'Sabor de la bebida', desc: 'Balance café-leche en taza' },
        { key: 'presentacion', label: 'Presentación', desc: 'Limpieza de la taza y estación de trabajo' },
        { key: 'impresion_general', label: 'Impresión general', desc: 'Impacto global de la rutina' }
      ],
      tips: [
        'El WLAC combina rondas técnicas y creativas; los duelos 1v1 reflejan las eliminatorias oficiales.',
        'Incluye criterios visuales y de sabor: el jurado evalúa tanto el arte como la bebida final.',
        '12–16 competidores es el rango típico en regionales; ajusta el cupo de inscripción al mismo número.',
        'La foto del barista ayuda al jurado a identificar al competidor en la mesa de calificación.'
      ]
    },
    tostion: {
      id: 'tostion',
      label: 'Tostión',
      entity: 'WCE — World Coffee Roasting Championship',
      reference: 'WCRC',
      eventSubtitle: 'WCRC · Tostión con ranking por puntaje',
      reglamentoUrl: 'https://worldcoffeeevents.org/competitions/world-coffee-roasting-championship/',
      modo: 'puntaje_general',
      jueces: 3,
      scaleMin: 1,
      scaleMax: 6,
      competidoresEsperados: 16,
      avancePorRonda: 0,
      criteria: [
        { key: 'perfil_tueste', label: 'Perfil de tueste', desc: 'Adecuación del desarrollo al origen y variedad' },
        { key: 'aroma', label: 'Aroma', desc: 'Expresión aromática en seco y en taza' },
        { key: 'sabor', label: 'Sabor', desc: 'Definición del perfil tostado en taza' },
        { key: 'acidez', label: 'Acidez', desc: 'Vivacidad y calidad de la acidez' },
        { key: 'dulzor', label: 'Dulzor', desc: 'Desarrollo del dulzor en taza' },
        { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura resultante del tueste' },
        { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Ausencia de defectos de tueste' },
        { key: 'impresion_general', label: 'Impresión general', desc: 'Calidad global de la muestra presentada' }
      ],
      tips: [
        'El WCRC puntúa muestras catadas a ciegas; el ranking por puntaje total es el formato más fiel.',
        'Usa escala sensorial SCA 1–6 para la evaluación en taza de las muestras tostadas.',
        '16 tostadores es un formato regional estándar; fases de grupos se activan automáticamente si superas 32.',
        'Documenta origen y variedad en el formulario de inscripción (campo «Representa»).'
      ]
    },
    aeropress: {
      id: 'aeropress',
      label: 'Aeropress',
      entity: 'WAC — World Aeropress Championship',
      reference: 'WAC',
      eventSubtitle: 'WAC · Aeropress en duelos de taza',
      reglamentoUrl: 'https://worldaeropresschampionship.com/',
      modo: 'duelos',
      jueces: 3,
      scaleMin: 1,
      scaleMax: 6,
      competidoresEsperados: 20,
      avancePorRonda: 0,
      criteria: [
        { key: 'sabor', label: 'Sabor', desc: 'Perfil y placer de la bebida en taza' },
        { key: 'aroma', label: 'Aroma', desc: 'Intensidad y calidad aromática' },
        { key: 'acidez', label: 'Acidez', desc: 'Brillo y equilibrio ácido' },
        { key: 'dulzor', label: 'Dulzor', desc: 'Dulzor percibido en la taza' },
        { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura de la bebida Aeropress' },
        { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Sin defectos ni sabores extraños' },
        { key: 'impresion_general', label: 'Impresión general', desc: 'Experiencia total de la taza' }
      ],
      tips: [
        'El WAC usa eliminación directa por duelos de taza; el ganador avanza por mayor puntaje sensorial.',
        'Cada competidor prepara su receta Aeropress; 3 jueces catan la misma taza.',
        '20–32 participantes es típico en nacionales; el cuadro se genera automáticamente al sortear.',
        'Tiempo de preparación y protocolo deben definirse en el reglamento del evento.'
      ]
    },
    personalizado: {
      id: 'personalizado',
      label: 'Personalizado',
      entity: 'Configuración libre',
      reference: 'Custom',
      modo: 'duelos',
      jueces: 3,
      scaleMin: 1,
      scaleMax: 5,
      competidoresEsperados: 16,
      avancePorRonda: 0,
      criteria: null,
      tips: [
        'Define tus propios criterios, escala y número de jueces según el reglamento de tu evento.',
        'Modos disponibles: «Duelos 1v1» (eliminatoria) o «Puntaje general» (ranking por ronda).',
        'El sistema calcula automáticamente fases (octavos, grupos, etc.) según inscritos habilitados.',
        'Puedes subir una imagen de fondo para el panel de calificación y activar fotos de competidores.'
      ]
    }
  };

  var CLASSIFICATION_MODES = [
    {
      id: 'duelos',
      label: 'Duelos 1v1 (eliminatoria)',
      desc: 'Dos competidores por llave; avanza quien tenga mayor puntaje total. Usado en WBrC, WAC y WLAC.',
      entities: 'WBrC · WAC · WLAC'
    },
    {
      id: 'puntaje_general',
      label: 'Puntaje general (ranking)',
      desc: 'Clasificación por suma de puntajes en la ronda. Usado en WCTC, WCRC y fases de grupos.',
      entities: 'WCTC · WCRC · fases de liga'
    }
  ];

  function listPresets() {
    return Object.keys(PRESETS).map(function (id) {
      var p = PRESETS[id];
      return { id: id, label: p.label, entity: p.entity, reference: p.reference };
    });
  }

  function getPreset(id) {
    return PRESETS[id] || PRESETS.personalizado;
  }

  function resolveReglamentoUrl(ref) {
    if (!ref) return '';
    if (/^https?:\/\//i.test(ref)) return ref;
    if (ref === 'reglas' || ref === 'reglasPdf') {
      if (global.SiteLinks && global.SiteLinks.absUrl) {
        return global.SiteLinks.absUrl(ref);
      }
      return ref === 'reglasPdf' ? '/assets/reglas-v60-championship.pdf' : '/reglas';
    }
    if (ref.charAt(0) === '/') return ref;
    return ref;
  }

  function applyPresetRegistration(presetId, currentRegistration) {
    var preset = getPreset(presetId);
    var base = currentRegistration && typeof currentRegistration === 'object' ? currentRegistration : {};
    var out = Object.assign({}, base);
    if (preset.reglamentoUrl) {
      out.reglamentoUrl = resolveReglamentoUrl(preset.reglamentoUrl);
    }
    if (preset.registrationTitle) {
      out.title = preset.registrationTitle;
    }
    return out;
  }

  function getClassificationModes() {
    return CLASSIFICATION_MODES.slice();
  }

  function applyPresetToScoring(presetId, currentScoring) {
    var preset = getPreset(presetId);
    var base = currentScoring && typeof currentScoring === 'object' ? currentScoring : {};
    var out = {
      disciplina: presetId,
      modo: preset.modo,
      scaleMin: preset.scaleMin,
      scaleMax: preset.scaleMax,
      jueces: preset.jueces,
      avancePorRonda: preset.avancePorRonda,
      autoAvance: base.autoAvance !== false,
      competidoresEsperados: preset.competidoresEsperados,
      mostrarFotos: base.mostrarFotos !== false,
      criteria: preset.criteria
        ? preset.criteria.map(function (c) { return Object.assign({}, c); })
        : (base.criteria || []).map(function (c) { return Object.assign({}, c); })
    };
    if (!out.criteria || !out.criteria.length) {
      out.criteria = (base.criteria || []).map(function (c) { return Object.assign({}, c); });
    }
    return out;
  }

  function presetSummaryHtml(presetId) {
    var preset = getPreset(presetId);
    var mode = CLASSIFICATION_MODES.find(function (m) { return m.id === preset.modo; });
    var regUrl = preset.reglamentoUrl ? resolveReglamentoUrl(preset.reglamentoUrl) : '';
    var html = '<div class="jurado-preset-summary">' +
      '<p class="jurado-preset-summary__entity"><strong>' + preset.entity + '</strong> · ' + preset.reference + '</p>';
    if (mode) {
      html += '<p class="jurado-hint">' + mode.label + ' — ' + mode.desc + '</p>';
    }
    if (regUrl) {
      html += '<p class="jurado-preset-summary__rules">Reglamento sugerido: <a href="' + regUrl +
        '" target="_blank" rel="noopener noreferrer">' + regUrl + '</a></p>';
    }
    html += '<ul class="jurado-preset-tips">';
    preset.tips.forEach(function (tip) {
      html += '<li>' + tip + '</li>';
    });
    html += '</ul></div>';
    return html;
  }

  global.TournamentPresets = {
    list: listPresets,
    get: getPreset,
    classificationModes: getClassificationModes,
    applyToScoring: applyPresetToScoring,
    applyToRegistration: applyPresetRegistration,
    resolveReglamentoUrl: resolveReglamentoUrl,
    summaryHtml: presetSummaryHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
