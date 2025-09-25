(function () {
  // ===== EMgine Editor – UI (ES5) =====
  // - Layer panel (vertical boxes with eye toggle)
  // - Hover highlight via editor.setHoverLayer
  // - Not draw when hidden handled in core (guard)
  // - Underlay controls (enabled + alpha)
  // - Keyboard shortcuts: 1..4 layers, V toggle, L/← level-, R/→ level+
  // - No leading underscore names

  function onReady() {
    if (!window.editor) {
      document.addEventListener("editor:ready", onReady, { once: true });
      return;
    }

    // ===== Panel root =====
    var panel = document.createElement("div");
    panel.id = "level-panel";
    document.body.appendChild(panel);

    // ===== Title =====
    var title = document.createElement("div");
    title.className = "lp-title";
    title.textContent = "Level & Layers";
    panel.appendChild(title);

    // ===== Status (active layer name) =====
    var status = document.createElement("div");
    status.id = "lp-status";
    status.className = "lp-row small";
    status.innerHTML = 'Aktiver Layer: <strong id="lp-active-name"></strong>';
    panel.appendChild(status);

    // ===== Warning (hidden layer: drawing disabled) =====
    var warn = document.createElement("div");
    warn.id = "lp-hidden-warning";
    warn.className = "lp-row warn";
    warn.textContent = "Layer versteckt – Zeichnen deaktiviert";
    warn.style.display = "none";
    panel.appendChild(warn);

    // ===== Level row =====
    var rowLevel = document.createElement("div");
    rowLevel.className = "lp-row";
    var label = document.createElement("label");
    label.appendChild(document.createTextNode("Level: "));
    var slider = document.createElement("input");
    slider.id = "lp-level";
    slider.type = "range";
    var max = window.editor.getLevelsCount
      ? (window.editor.getLevelsCount() | 0) - 1
      : 0;
    if (max < 0) max = 0;
    slider.min = "0";
    slider.max = "" + max;
    var curLvl = window.editor.getCurrentLevel
      ? window.editor.getCurrentLevel() | 0
      : 0;
    if (curLvl < 0) curLvl = 0;
    if (curLvl > max) curLvl = max;
    slider.value = "" + curLvl;
    label.appendChild(slider);
    rowLevel.appendChild(label);
    var spanVal = document.createElement("span");
    spanVal.id = "lp-level-val";
    spanVal.textContent = "" + curLvl;
    rowLevel.appendChild(spanVal);
    panel.appendChild(rowLevel);

    // ===== Layer grid (vertical) =====
    var grid = document.createElement("div");
    grid.className = "lp-row lp-layer-grid";
    panel.appendChild(grid);

    function makeBox(name, color, labelText) {
      var box = document.createElement("div");
      box.className = "lp-box";
      box.setAttribute("data-name", name);

      var pill = document.createElement("span");
      pill.className = "lp-pill";
      pill.style.background = color;

      var nm = document.createElement("span");
      nm.className = "lp-name";
      nm.textContent = labelText;

      var btn = document.createElement("button");
      btn.className = "lp-vis";
      btn.title = "Toggle Visibility";
      btn.textContent = "👁";

      box.appendChild(pill);
      box.appendChild(nm);
      box.appendChild(btn);
      return box;
    }

    grid.appendChild(makeBox("floor", "#4FC3F7", "Floor"));
    grid.appendChild(makeBox("wall", "#FF8A65", "Wall"));
    grid.appendChild(makeBox("decor", "#BA68C8", "Decor"));
    grid.appendChild(makeBox("entities", "#FFF176", "Entities"));

    // ===== Underlay controls =====
    var rowU1 = document.createElement("div");
    rowU1.className = "lp-row small";
    var labU1 = document.createElement("label");
    var cbU = document.createElement("input");
    cbU.type = "checkbox";
    cbU.id = "lp-underlay-enabled";
    cbU.checked = true;
    labU1.appendChild(cbU);
    labU1.appendChild(document.createTextNode(" Unterlay anzeigen"));
    rowU1.appendChild(labU1);
    panel.appendChild(rowU1);

    var rowU2 = document.createElement("div");
    rowU2.className = "lp-row small";
    var labU2 = document.createElement("label");
    labU2.appendChild(document.createTextNode("Unterlay-Alpha "));
    var rangeU = document.createElement("input");
    rangeU.type = "range";
    rangeU.id = "lp-underlay-alpha";
    rangeU.min = "0";
    rangeU.max = "1";
    rangeU.step = "0.05";
    rangeU.value = "0.25";
    labU2.appendChild(rangeU);
    rowU2.appendChild(labU2);
    panel.appendChild(rowU2);

    // ===== Helpers =====
    function getLayerBoxes() {
      return grid.querySelectorAll(".lp-box");
    }
    function setActiveBox(activeName) {
      var list = getLayerBoxes();
      for (var j = 0; j < list.length; j++) {
        var n = list[j].getAttribute("data-name");
        if (n === activeName) list[j].classList.add("active");
        else list[j].classList.remove("active");
      }
    }
    function updateActiveName() {
      var el = document.getElementById("lp-active-name");
      if (!el) return;
      var n =
        window.editor && window.editor.getCurrentLayer
          ? window.editor.getCurrentLayer()
          : "";
      el.textContent = n || "";
    }
    function isVisible(name) {
      if (window.editor && window.editor.isLayerVisible)
        return !!window.editor.isLayerVisible(name);
      // UI fallback
      var list = getLayerBoxes();
      for (var j = 0; j < list.length; j++) {
        if (list[j].getAttribute("data-name") === name) {
          return !list[j].classList.contains("hidden");
        }
      }
      return true;
    }
    function updateHiddenWarning() {
      var active =
        window.editor && window.editor.getCurrentLayer
          ? window.editor.getCurrentLayer()
          : "floor";
      var show = isVisible(active);
      warn.style.display = show ? "none" : "block";
    }
    function syncVisibilityIcons() {
      var list = getLayerBoxes();
      for (var j = 0; j < list.length; j++) {
        var btn = list[j].querySelector(".lp-vis");
        if (!btn) continue;
        btn.textContent = list[j].classList.contains("hidden") ? "🚫" : "👁";
      }
    }

    // ===== Editor UI Hooks =====
    if (
      !window.editor.uiHookedLevel &&
      typeof window.editor.setCurrentLevel === "function"
    ) {
      var origSetCurrentLevel = window.editor.setCurrentLevel;
      window.editor.setCurrentLevel = function (i) {
        origSetCurrentLevel(i);
        // Core setzt beim Levelwechsel "floor" aktiv
        updateActiveName();
        updateHiddenWarning();
      };
      window.editor.uiHookedLevel = true;
    }
    if (
      !window.editor.uiHookedLayer &&
      typeof window.editor.setCurrentLayer === "function"
    ) {
      var origSetCurrentLayer = window.editor.setCurrentLayer;
      window.editor.setCurrentLayer = function (name) {
        origSetCurrentLayer(name);
        setActiveBox(name);
        updateActiveName();
        updateHiddenWarning();
      };
      window.editor.uiHookedLayer = true;
    }

    // ===== Wiring: Level slider =====
    slider.addEventListener("input", function () {
      if (window.editor && window.editor.setCurrentLevel) {
        window.editor.setCurrentLevel(slider.value | 0);

        // UI: Werte syncen
        var cl =
          (window.editor.getCurrentLevel && window.editor.getCurrentLevel()) |
          0;
        spanVal.textContent = "" + cl;

        // WICHTIG: aktive Box nach Core-Zustand markieren (kein "floor" hart setzen)
        var activeNow =
          (window.editor.getCurrentLayer && window.editor.getCurrentLayer()) ||
          "floor";
        setActiveBox(activeNow);
        updateActiveName();
        updateHiddenWarning();
      }
    });

    // ===== Wiring: Layer boxes =====
    var boxes = getLayerBoxes();
    for (var i = 0; i < boxes.length; i++) {
      (function (box) {
        var name = box.getAttribute("data-name");

        // Click -> active layer
        box.addEventListener("click", function (e) {
          if (
            e.target &&
            e.target.classList &&
            e.target.classList.contains("lp-vis")
          )
            return;
          if (window.editor && window.editor.setCurrentLayer) {
            window.editor.setCurrentLayer(name);
            setActiveBox(name);
            updateActiveName();
            updateHiddenWarning();
          }
        });

        // Eye toggle
        var visBtn = box.querySelector(".lp-vis");
        visBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          var hidden = box.classList.toggle("hidden");
          if (window.editor && window.editor.setLayerVisible) {
            window.editor.setLayerVisible(name, !hidden);
          }
          syncVisibilityIcons();
          updateHiddenWarning();
        });

        // Hover soften
        box.addEventListener("mouseenter", function () {
          if (window.editor && window.editor.setHoverLayer)
            window.editor.setHoverLayer(name);
        });
        box.addEventListener("mouseleave", function () {
          if (window.editor && window.editor.setHoverLayer)
            window.editor.setHoverLayer(null);
        });
      })(boxes[i]);
    }

    // ===== Wiring: Underlay controls =====
    var cbUnder = document.getElementById("lp-underlay-enabled") || cbU;
    var rangeUnder = document.getElementById("lp-underlay-alpha") || rangeU;
    if (cbUnder && window.editor && window.editor.setUnderlayPreviewEnabled) {
      cbUnder.addEventListener("change", function () {
        window.editor.setUnderlayPreviewEnabled(!!cbUnder.checked);
      });
    }
    if (rangeUnder && window.editor && window.editor.setUnderlayPreviewAlpha) {
      var applyAlpha = function () {
        var v = parseFloat(rangeUnder.value);
        if (!isNaN(v)) window.editor.setUnderlayPreviewAlpha(v);
      };
      rangeUnder.addEventListener("input", applyAlpha);
      rangeUnder.addEventListener("change", applyAlpha);
    }

    // ===== Keyboard shortcuts =====

    // ===== Zoom on Canvas (ohne Space-Pan) =====
    var canvas = document.getElementById("canvas");
    if (canvas) {
      canvas.addEventListener(
        "wheel",
        function (e) {
          if (!(window.editor && window.editor.zoomBy)) return;
          var rect = canvas.getBoundingClientRect();
          var sx = e.clientX - rect.left;
          var sy = e.clientY - rect.top;
          var factor = e.deltaY < 0 ? 1.1 : 0.9;
          window.editor.zoomBy(factor, sx, sy);
          e.preventDefault();
        },
        { passive: false }
      );
    }
    // ===== Canvas painting (left: draw id=1, right: erase id=0) =====
    var canvas = document.getElementById("canvas");
    if (canvas) {
      var isPainting = false;
      var paintButton = 0; // 0 left, 2 right
      var lastIdx = -1;

      // Prevent default context menu on right click
      canvas.addEventListener("contextmenu", function (e) {
        e.preventDefault();
      });

      function tileFromEvent(e) {
        if (!window.editor || !window.editor.clientToTile) return null;
        return window.editor.clientToTile(e);
      }
      function tileIndex(col, row) {
        if (!window.editor || !window.editor.getWorld) return -1;
        var w = window.editor.getWorld();
        return row * (w.cols | 0) + col;
      }
      function paintAt(e) {
        var t = tileFromEvent(e);
        if (!t) return;
        var idx = tileIndex(t.col, t.row);
        if (idx === lastIdx) return; // avoid redundant writes
        lastIdx = idx;
        var id = paintButton === 2 ? 0 : 1;
        if (window.editor && window.editor.setTile) {
          window.editor.setTile(t.col | 0, t.row | 0, id | 0);
        }
      }

      canvas.addEventListener("mousedown", function (e) {
        if (e.button !== 0 && e.button !== 2) return;
        isPainting = true;
        paintButton = e.button;
        paintAt(e);
      });

      canvas.addEventListener("mousemove", function (e) {
        if (!isPainting) return;
        paintAt(e);
      });
      window.addEventListener("mouseup", function () {
        isPainting = false;
        lastIdx = -1;
      });
      // also stop on leaving window
      window.addEventListener("blur", function () {
        isPainting = false;
        lastIdx = -1;
      });
    }

    document.addEventListener("keydown", function (ev) {
      var tag =
        ev.target && ev.target.tagName ? ev.target.tagName.toLowerCase() : "";
      var editable =
        ev.target &&
        (ev.target.isContentEditable ||
          tag === "input" ||
          tag === "textarea" ||
          tag === "select");
      if (editable) return;

      var map = { 1: "floor", 2: "wall", 3: "decor", 4: "entities" };
      if (map[ev.key]) {
        if (window.editor && window.editor.setCurrentLayer) {
          window.editor.setCurrentLayer(map[ev.key]);
          setActiveBox(map[ev.key]);
          updateActiveName();
          updateHiddenWarning();
          ev.preventDefault();
        }
        return;
      }

      if (ev.key === "v" || ev.key === "V") {
        var active =
          window.editor && window.editor.getCurrentLayer
            ? window.editor.getCurrentLayer()
            : "floor";
        var visible = isVisible(active);
        for (var k = 0; k < boxes.length; k++) {
          if (boxes[k].getAttribute("data-name") === active) {
            boxes[k].classList.toggle("hidden", visible);
            break;
          }
        }
        if (window.editor && window.editor.setLayerVisible)
          window.editor.setLayerVisible(active, !visible);
        syncVisibilityIcons();
        updateHiddenWarning();
        ev.preventDefault();
        return;
      }

      if (ev.key === "l" || ev.key === "L" || ev.key === "ArrowLeft") {
        if (
          window.editor &&
          window.editor.setCurrentLevel &&
          window.editor.getCurrentLevel
        ) {
          var cl = window.editor.getCurrentLevel() | 0;
          if (cl > 0) window.editor.setCurrentLevel(cl - 1);

          // UI sync
          var cur =
            (window.editor.getCurrentLevel && window.editor.getCurrentLevel()) |
            0;
          slider.value = "" + cur;
          spanVal.textContent = slider.value;

          // aktive Box gemäß Core
          var activeNow =
            (window.editor.getCurrentLayer &&
              window.editor.getCurrentLayer()) ||
            "floor";
          setActiveBox(activeNow);
          updateActiveName();
          updateHiddenWarning();
          ev.preventDefault();
        }
        return;
      }

      if (ev.key === "r" || ev.key === "R" || ev.key === "ArrowRight") {
        if (
          window.editor &&
          window.editor.setCurrentLevel &&
          window.editor.getCurrentLevel &&
          window.editor.getLevelsCount
        ) {
          var cl2 = window.editor.getCurrentLevel() | 0;
          var mx = (window.editor.getLevelsCount() | 0) - 1;
          if (mx < 0) mx = 0;
          if (cl2 < mx) window.editor.setCurrentLevel(cl2 + 1);

          // UI sync
          var cur2 =
            (window.editor.getCurrentLevel && window.editor.getCurrentLevel()) |
            0;
          slider.value = "" + cur2;
          spanVal.textContent = slider.value;

          // aktive Box gemäß Core
          var activeNow2 =
            (window.editor.getCurrentLayer &&
              window.editor.getCurrentLayer()) ||
            "floor";
          setActiveBox(activeNow2);
          updateActiveName();
          updateHiddenWarning();
          ev.preventDefault();
        }
        return;
      }
    });

    // ===== Initial sync & defaults =====
    // ===== Initial sync & defaults =====
    try {
      // Level einmal initialisieren, Layer NICHT hart auf "floor" setzen
      if (window.editor.setCurrentLevel) {
        // nichts tun, falls der Core bereits initialisiert hat;
        // optional: window.editor.setCurrentLevel(window.editor.getCurrentLevel()|0);
      }
    } catch (e) {}

    var activeFromCore =
      (window.editor &&
        window.editor.getCurrentLayer &&
        window.editor.getCurrentLayer()) ||
      "floor";
    setActiveBox(activeFromCore);
    updateActiveName();
    syncVisibilityIcons();
    updateHiddenWarning();

    console.log("[ui] initialisiert.");
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
