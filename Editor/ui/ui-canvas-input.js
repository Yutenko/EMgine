// ui-canvas-input.js – Pointer-Handling fürs Malen/Pannen (ES5) + Bresenham
// Beachtet Tool-Modus: nur "paint" und "pan" aktiv. Toolwechsel setzt Hover-Suppress zurück.
(function () {
  function onReady() {
    var editor = window.editor;
    if (!editor) {
      document.addEventListener("editor:ready", onReady, { once: true });
      return;
    }
    var canvas = editor.getCanvas();

    var mode = "paint"; // "paint" | "pan"
    function toolMode() {
      return window.emToolMode || mode;
    }
    window.addEventListener("em:setTool", function (ev) {
      var t = ev && ev.detail && ev.detail.tool;
      if (t) {
        mode = t;
      }
      // Hover-Highlight immer freigeben bei Toolwechsel
      editor.suppressHoverHighlight = false;
      editor.requestRender();
    });

    // Hover-Highlight beim Malen ausblenden
    editor.suppressHoverHighlight = false;

    canvas.addEventListener(
      "wheel",
      function (e) {
        if (!editor.zoomBy) return;
        var rect = canvas.getBoundingClientRect();
        var sx = e.clientX - rect.left;
        var sy = e.clientY - rect.top;
        var factor = e.deltaY < 0 ? 1.1 : 0.9;
        editor.zoomBy(factor, sx, sy);
        e.preventDefault();
      },
      { passive: false }
    );

    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    var isDown = false;
    var paintButton = 0; // 0 left, 2 right
    var lastTileCol = null,
      lastTileRow = null;
    var lastPanX = 0,
      lastPanY = 0;
    var compoundOpen = false;

    function tileFromEvent(e) {
      return editor.clientToTile ? editor.clientToTile(e) : null;
    }

    function drawLineTiles(c0, r0, c1, r1, drawFn) {
      var dx = Math.abs(c1 - c0),
        sx = c0 < c1 ? 1 : -1;
      var dy = -Math.abs(r1 - r0),
        sy = r0 < r1 ? 1 : -1;
      var err = dx + dy,
        e2;
      var c = c0,
        r = r0;
      while (1) {
        drawFn(c, r);
        if (c === c1 && r === r1) break;
        e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          c += sx;
        }
        if (e2 <= dx) {
          err += dx;
          r += sy;
        }
      }
    }

    function beginCompoundIfNeeded() {
      if (!compoundOpen && editor.beginCompound) {
        editor.beginCompound("paint-stroke");
        compoundOpen = true;
      }
    }
    function endCompoundIfNeeded() {
      if (compoundOpen && editor.endCompound) {
        editor.endCompound(false);
        compoundOpen = false;
      }
    }

    function paintAtTile(col, row) {
      if (paintButton === 2) {
        editor.setTile(col | 0, row | 0, 0);
        return;
      }

      var pat = editor.getBrushPattern && editor.getBrushPattern();
      if (pat && pat.w > 0 && pat.h > 0 && pat.ids) {
        for (var r = 0; r < pat.h; r++)
          for (var c = 0; c < pat.w; c++) {
            var id = pat.ids[r][c] | 0;
            if (!id) continue;
            editor.setTile((col + c) | 0, (row + r) | 0, id);
          }
        return;
      }

      var id = editor.getBrushId
        ? editor.getBrushId()
        : window.emBrushId != null
        ? window.emBrushId | 0
        : 1;
      editor.setTile(col | 0, row | 0, id | 0);
    }

    function paintFromEvent(e) {
      var t = tileFromEvent(e);
      if (!t) return;
      if (lastTileCol == null || lastTileRow == null) {
        paintAtTile(t.col | 0, t.row | 0);
        lastTileCol = t.col | 0;
        lastTileRow = t.row | 0;
        return;
      }
      var c0 = lastTileCol | 0,
        r0 = lastTileRow | 0;
      var c1 = t.col | 0,
        r1 = t.row | 0;
      if (c0 === c1 && r0 === r1) {
        paintAtTile(c1, r1);
      } else {
        drawLineTiles(c0, r0, c1, r1, paintAtTile);
      }
      lastTileCol = c1;
      lastTileRow = r1;
    }

    canvas.addEventListener("pointerdown", function (e) {
      // Nur paint/pan-tools verarbeiten
      if (toolMode() !== "paint" && toolMode() !== "pan") return;

      isDown = true;
      paintButton = e.button | 0;
      canvas.setPointerCapture(e.pointerId);

      if (toolMode() === "pan") {
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        return;
      }

      // Paint: Hover-Highlight aus
      editor.suppressHoverHighlight = true;

      beginCompoundIfNeeded();
      paintFromEvent(e);
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!isDown) return;
      if (toolMode() !== "paint" && toolMode() !== "pan") return;

      if (toolMode() === "pan") {
        var z = editor.getCamera ? editor.getCamera().z : 1;
        var dx = (lastPanX - e.clientX) / z;
        var dy = (lastPanY - e.clientY) / z;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        editor.panTo(editor.getCamera().x + dx, editor.getCamera().y + dy);
        return;
      }
      beginCompoundIfNeeded();
      paintFromEvent(e);
    });

    canvas.addEventListener("pointerup", function (e) {
      if (toolMode() !== "paint" && toolMode() !== "pan") return;

      isDown = false;
      canvas.releasePointerCapture(e.pointerId);
      lastTileCol = lastTileRow = null;

      // Hover-Highlight wieder an
      editor.suppressHoverHighlight = false;
      editor.requestRender();

      endCompoundIfNeeded();
    });

    canvas.addEventListener("pointerleave", function () {
      isDown = false;
      lastTileCol = lastTileRow = null;
      editor.suppressHoverHighlight = false;
      editor.requestRender();
      endCompoundIfNeeded();
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
