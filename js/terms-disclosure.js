/**
 * Acordeón de términos legales: checkbox separado del botón expandir (compatible móvil).
 */
(function (global) {
  'use strict';

  function init(options) {
    options = options || {};
    var termIds = options.termIds || [];
    var btnSelectAll = document.getElementById(options.selectAllButtonId || 'btnSelectAllTerms');
    var onChange = typeof options.onChange === 'function' ? options.onChange : null;

    document.querySelectorAll('.term-disclosure__toggle').forEach(function (btn) {
      var panelId = btn.getAttribute('aria-controls');
      var panel = panelId ? document.getElementById(panelId) : null;
      var wrapper = btn.closest('.term-disclosure');
      if (!panel || !wrapper) return;

      function setExpanded(expanded) {
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        panel.hidden = !expanded;
        wrapper.classList.toggle('is-expanded', expanded);
        btn.textContent = expanded ? 'Ocultar' : 'Detalle';
      }

      setExpanded(false);

      btn.addEventListener('click', function () {
        setExpanded(btn.getAttribute('aria-expanded') !== 'true');
      });
    });

    function allTermsChecked() {
      return termIds.every(function (id) {
        var el = document.getElementById(id);
        return el && el.checked;
      });
    }

    function updateSelectAllLabel() {
      if (!btnSelectAll) return;
      var allChecked = allTermsChecked();
      btnSelectAll.textContent = allChecked ? 'Desmarcar todas' : 'Seleccionar todas';
      btnSelectAll.setAttribute('aria-pressed', allChecked ? 'true' : 'false');
    }

    function syncTermState(checkbox) {
      var wrapper = checkbox.closest('.term-disclosure');
      if (wrapper) wrapper.classList.toggle('is-checked', checkbox.checked);
    }

    termIds.forEach(function (id) {
      var checkbox = document.getElementById(id);
      if (!checkbox) return;

      checkbox.addEventListener('change', function () {
        syncTermState(checkbox);
        updateSelectAllLabel();
        if (onChange) onChange();
      });

      syncTermState(checkbox);
    });

    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', function () {
        var shouldCheck = !allTermsChecked();
        termIds.forEach(function (id) {
          var el = document.getElementById(id);
          if (el) {
            el.checked = shouldCheck;
            syncTermState(el);
          }
        });
        updateSelectAllLabel();
        if (onChange) onChange();
      });
    }

    updateSelectAllLabel();

    return {
      updateSelectAllLabel: updateSelectAllLabel,
      collapseAll: function () {
        document.querySelectorAll('.term-disclosure__toggle').forEach(function (btn) {
          var panelId = btn.getAttribute('aria-controls');
          var panel = panelId ? document.getElementById(panelId) : null;
          var wrapper = btn.closest('.term-disclosure');
          btn.setAttribute('aria-expanded', 'false');
          if (panel) panel.hidden = true;
          if (wrapper) wrapper.classList.remove('is-expanded');
          btn.textContent = 'Detalle';
        });
      },
      resetCheckedState: function () {
        document.querySelectorAll('.term-disclosure').forEach(function (wrapper) {
          var cb = wrapper.querySelector('input[type="checkbox"]');
          wrapper.classList.remove('is-expanded');
          wrapper.classList.toggle('is-checked', !!(cb && cb.checked));
        });
        updateSelectAllLabel();
      }
    };
  }

  global.TermsDisclosure = { init: init };
})(window);
