/**
 * Estándares V60 Championship — criterios sensoriales y observaciones por puntaje.
 * Alineado con reglas-v60-championship.html §7 (parámetros 1–7 en escala 1–5).
 */
(function (global) {
  'use strict';

  var V60_CRITERIA = [
    { key: 'aroma', label: 'Aroma', desc: 'Intensidad y calidad en seco y húmedo' },
    { key: 'dulzor', label: 'Dulzor', desc: 'Percepción de dulzor natural' },
    { key: 'acidez', label: 'Acidez', desc: 'Calidad, intensidad y tipo' },
    { key: 'sabor', label: 'Sabor', desc: 'Amplitud y complejidad del perfil' },
    { key: 'balance', label: 'Balance', desc: 'Integración armónica de atributos' },
    { key: 'cuerpo', label: 'Cuerpo', desc: 'Textura y sensación en boca' },
    { key: 'limpieza_taza', label: 'Limpieza de taza', desc: 'Ausencia de defectos u off-flavors' }
  ];

  function scoreBand(val, scaleMin, scaleMax) {
    var min = typeof scaleMin === 'number' ? scaleMin : 1;
    var max = typeof scaleMax === 'number' ? scaleMax : 5;
    var n = parseFloat(val);
    if (isNaN(n)) return { level: 'sin_dato', label: '—', text: 'Sin calificación registrada.' };
    var span = Math.max(1, max - min);
    var pct = (n - min) / span;
    if (pct >= 0.9) {
      return {
        level: 'excelente',
        label: 'Excelente',
        text: 'Supera el estándar competitivo V60 en este parámetro.'
      };
    }
    if (pct >= 0.75) {
      return {
        level: 'muy_bueno',
        label: 'Muy bueno',
        text: 'Cumple ampliamente el estándar del reglamento oficial.'
      };
    }
    if (pct >= 0.6) {
      return {
        level: 'competitivo',
        label: 'Competitivo',
        text: 'Dentro del rango esperado para una ronda oficial.'
      };
    }
    if (pct >= 0.45) {
      return {
        level: 'en_desarrollo',
        label: 'En desarrollo',
        text: 'Por debajo del estándar; conviene reforzar este atributo en entrenamiento.'
      };
    }
    return {
      level: 'por_fortalecer',
      label: 'Por fortalecer',
      text: 'Muy alejado del estándar sensorial SCA / WBrC para competencia V60.'
    };
  }

  function criterionObservation(val, criterion, scaleMin, scaleMax) {
    var crit = criterion || {};
    var band = scoreBand(val, scaleMin, scaleMax);
    var desc = String(crit.desc || '').trim();
    var parts = [];
    if (desc) parts.push(desc);
    parts.push(band.text);
    return {
      band: band,
      text: parts.join(' ')
    };
  }

  function averageCriterionScores(judges, criterionKey, jmax) {
    var sum = 0;
    var count = 0;
    var maxJ = jmax || 3;
    for (var j = 1; j <= maxJ; j++) {
      var g = judges && judges['j' + j];
      var v = g && g.scores ? g.scores[criterionKey] : null;
      if (v != null && !isNaN(parseFloat(v))) {
        sum += parseFloat(v);
        count++;
      }
    }
    if (!count) return null;
    return Math.round((sum / count) * 10) / 10;
  }

  function roundSummaryObservation(round, criteria, scaleMin, scaleMax) {
    var judges = round && round.judges ? round.judges : {};
    var crits = criteria && criteria.length ? criteria : V60_CRITERIA;
    var strengths = [];
    var weaknesses = [];
    crits.forEach(function (c) {
      var avg = averageCriterionScores(judges, c.key, 3);
      if (avg == null) return;
      var obs = criterionObservation(avg, c, scaleMin, scaleMax);
      if (obs.band.level === 'excelente' || obs.band.level === 'muy_bueno') {
        strengths.push(c.label);
      } else if (obs.band.level === 'en_desarrollo' || obs.band.level === 'por_fortalecer') {
        weaknesses.push(c.label);
      }
    });
    var lines = [];
    if (strengths.length) {
      lines.push('Fortalezas según estándar V60: ' + strengths.join(', ') + '.');
    }
    if (weaknesses.length) {
      lines.push('Áreas a reforzar: ' + weaknesses.join(', ') + '.');
    }
    if (!lines.length) {
      lines.push('Desempeño equilibrado en los parámetros evaluados según el reglamento oficial.');
    }
    return lines.join(' ');
  }

  function mergeCriteria(apiCriteria) {
    if (!apiCriteria || !apiCriteria.length) return V60_CRITERIA.slice();
    var byKey = {};
    V60_CRITERIA.forEach(function (c) { byKey[c.key] = c; });
    return apiCriteria.map(function (c) {
      var base = byKey[c.key] || {};
      return {
        key: c.key || base.key,
        label: c.label || base.label || c.key,
        desc: c.desc || base.desc || ''
      };
    });
  }

  global.JuradoStandards = {
    V60_CRITERIA: V60_CRITERIA,
    scoreBand: scoreBand,
    criterionObservation: criterionObservation,
    averageCriterionScores: averageCriterionScores,
    roundSummaryObservation: roundSummaryObservation,
    mergeCriteria: mergeCriteria
  };
})(typeof window !== 'undefined' ? window : globalThis);
