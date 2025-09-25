// ui-selection.js – Auswahl über ALLE sichtbaren Layer (ES5) mit Floating-Selection
// Verhalten:
//  - Toolwechsel weg von "select": Auswahl & Floating verschwinden sofort
//  - Copy: erzeugt schwebende Kopie (Ghost), Commit erst beim Loslassen
//  - Cut: Paste einmalig -> danach Auswahl & Clipboard geleert
//  - Rotate: korrekt multi-layer; wirkt auf Ghost (falls aktiv) oder in-place
//  - Move-Cursor über Auswahl/Floating; Ghost halbtransparent beim Drag
//  - Shortcuts: Strg+C / Strg+X / Strg+V / Entf
(function () {
  var TOOL_NAME = "select";

  function onReady() {
    var editor = window.editor;
    if (!editor) {
      document.addEventListener("editor:ready", onReady, { once: true });
      return;
    }

    var canvas = editor.getCanvas();
    var dpr = editor.getDpr ? editor.getDpr() : window.devicePixelRatio || 1;

    var active = false;

    // Auswahl (Weltzellen, inkl. Endzelle)
    var sel = null; // {c0,r0,c1,r1}
    var selecting = false;
    var draggingSel = false;
    var dragStartSel = null; // {col,row}
    var dragOffsetSel = { dc: 0, dr: 0 };
    var lastMouseTile = null;

    // Clipboard
    var clip = null; // {w,h,layers:[...],data:{layer:[[ids]]}}
    var clipIsCut = false; // true -> Paste verbraucht Clipboard

    // Floating-Selection (schwebende Kopie, noch NICHT im Weltpuffer)
    var floating = false;
    var floatData = null; // wie clip-Struktur
    var floatPos = { col: 0, row: 0 }; // linke obere Zelle
    var floatDragging = false;
    var floatDragStart = null; // {col,row}
    var floatDragOffset = { dc: 0, dr: 0 };

    // Ghost-Rendering
    var ghostCanvas = null;
    var ghostCtx = null;

    // ===== Helpers =====
    function normSel(a, b) {
      var c0 = Math.min(a.col | 0, b.col | 0);
      var r0 = Math.min(a.row | 0, b.row | 0);
      var c1 = Math.max(a.col | 0, b.col | 0);
      var r1 = Math.max(a.row | 0, b.row | 0);
      return { c0: c0, r0: r0, c1: c1, r1: r1 };
    }
    function hasSel() {
      return !!sel && sel.c1 >= sel.c0 && sel.r1 >= sel.r0;
    }
    function selSize(s) {
      return { w: s.c1 - s.c0 + 1, h: s.r1 - s.r0 + 1 };
    }
    function tileFromEvent(e) {
      return editor.clientToTile ? editor.clientToTile(e) : null;
    }
    function insideRect(t, c0, r0, c1, r1) {
      if (!t) return false;
      return t.col >= c0 && t.col <= c1 && t.row >= r0 && t.row <= r1;
    }
    function insideSel(t) {
      return hasSel() && insideRect(t, sel.c0, sel.r0, sel.c1, sel.r1);
    }
    function insideFloat(t) {
      if (!floating || !floatData) return false;
      var c0 = floatPos.col,
        r0 = floatPos.row,
        c1 = c0 + floatData.w - 1,
        r1 = r0 + floatData.h - 1;
      return insideRect(t, c0, r0, c1, r1);
    }
    function clampToWorld(col, row) {
      var w = editor.getWorld();
      col = Math.max(0, Math.min((w.cols | 0) - 1, col | 0));
      row = Math.max(0, Math.min((w.rows | 0) - 1, row | 0));
      return { col: col, row: row };
    }
    function regionFits(col, row, w, h) {
      var WW = editor.getWorld();
      return col >= 0 && row >= 0 && col + w <= WW.cols && row + h <= WW.rows;
    }
    function findNearbyPlacement(baseC, baseR, w, h) {
      if (regionFits(baseC, baseR, w, h)) return { col: baseC, row: baseR };
      var maxRadius = 6,
        r,
        dc,
        dr;
      for (r = 1; r <= maxRadius; r++) {
        for (dc = -r; dc <= r; dc++) {
          var c1 = { col: baseC + dc, row: baseR - r },
            c2 = { col: baseC + dc, row: baseR + r };
          if (regionFits(c1.col, c1.row, w, h)) return c1;
          if (regionFits(c2.col, c2.row, w, h)) return c2;
        }
        for (dr = -r + 1; dr <= r - 1; dr++) {
          var c3 = { col: baseC - r, row: baseR + dr },
            c4 = { col: baseC + r, row: baseR + dr };
          if (regionFits(c3.col, c3.row, w, h)) return c3;
          if (regionFits(c4.col, c4.row, w, h)) return c4;
        }
      }
      var cl = clampToWorld(baseC, baseR);
      var WW = editor.getWorld();
      cl.col = Math.min(cl.col, (WW.cols | 0) - w);
      cl.row = Math.min(cl.row, (WW.rows | 0) - h);
      if (cl.col < 0) cl.col = 0;
      if (cl.row < 0) cl.row = 0;
      return cl;
    }
    function visibleLayerNames() {
      var L = editor.levelsState,
        list = [];
      for (var name in L.show) {
        if (L.show[name]) list.push(name);
      }
      return list;
    }

    // ===== Data I/O (multi-layer) =====
    function readRegion(rect) {
      var s = rect,
        sz = selSize(s);
      var L = editor.levelsState,
        lvl = L.data[L.current | 0];
      var layers = visibleLayerNames();
      var data = {},
        li,
        layer,
        r,
        c,
        idx,
        rows;
      for (li = 0; li < layers.length; li++) {
        layer = layers[li];
        rows = [];
        for (r = 0; r < sz.h; r++) {
          var arr = [];
          for (c = 0; c < sz.w; c++) {
            idx = (s.r0 + r) * (L.cols | 0) + (s.c0 + c);
            arr.push(lvl[layer][idx] | 0);
          }
          rows.push(arr);
        }
        data[layer] = rows;
      }
      return { w: sz.w, h: sz.h, layers: layers, data: data };
    }
    function clearRegion(rect) {
      var s = rect,
        sz = selSize(s);
      var L = editor.levelsState,
        lvlIdx = L.current | 0,
        cols = L.cols | 0;
      var layers = visibleLayerNames(),
        changes = [],
        li,
        layer,
        r,
        c,
        idx,
        prev;
      for (li = 0; li < layers.length; li++) {
        layer = layers[li];
        var buf = L.data[lvlIdx][layer];
        for (r = 0; r < sz.h; r++) {
          for (c = 0; c < sz.w; c++) {
            idx = (s.r0 + r) * cols + (s.c0 + c);
            prev = buf[idx] | 0;
            if (!prev) continue;
            changes.push({
              level: lvlIdx,
              layer: layer,
              col: (s.c0 + c) | 0,
              row: (s.r0 + r) | 0,
              prev: prev,
              next: 0,
            });
          }
        }
      }
      if (!changes.length) return false;
      if (editor.pushAction)
        editor.pushAction({ type: "setTiles", changes: changes });
      for (var i = 0; i < changes.length; i++) {
        var ch = changes[i];
        editor.setTileRaw(ch.level, ch.layer, ch.col, ch.row, ch.next);
      }
      editor.requestRender();
      return true;
    }
    function writeRegionAt(reg, col, row) {
      if (!reg) return false;
      var L = editor.levelsState,
        lvlIdx = L.current | 0,
        cols = L.cols | 0;
      var changes = [],
        li,
        layer,
        r,
        c,
        id,
        t,
        idx,
        prev;
      for (li = 0; li < reg.layers.length; li++) {
        layer = reg.layers[li];
        for (r = 0; r < reg.h; r++) {
          for (c = 0; c < reg.w; c++) {
            id = reg.data[layer][r][c] | 0;
            t = clampToWorld((col | 0) + c, (row | 0) + r);
            idx = t.row * (cols | 0) + t.col;
            prev = L.data[lvlIdx][layer][idx] | 0;
            if (prev === id) continue;
            changes.push({
              level: lvlIdx,
              layer: layer,
              col: t.col,
              row: t.row,
              prev: prev,
              next: id,
            });
          }
        }
      }
      if (!changes.length) return false;
      if (editor.pushAction)
        editor.pushAction({ type: "setTiles", changes: changes });
      for (var i = 0; i < changes.length; i++) {
        var ch = changes[i];
        editor.setTileRaw(ch.level, ch.layer, ch.col, ch.row, ch.next);
      }
      editor.requestRender();
      return true;
    }
    function rotateDataCW(reg) {
      if (!reg) return null;
      var out = { w: reg.h, h: reg.w, layers: reg.layers.slice(), data: {} };
      var r,
        c,
        layer,
        id,
        nw = out.w,
        nh = out.h;
      for (var li = 0; li < reg.layers.length; li++) {
        layer = reg.layers[li];
        var dst = new Array(nh);
        for (r = 0; r < nh; r++) dst[r] = new Array(nw);
        for (r = 0; r < reg.h; r++) {
          for (c = 0; c < reg.w; c++) {
            id = reg.data[layer][r][c] | 0;
            dst[c][nw - 1 - r] = id; // (r,c) -> (c, newW-1-r)
          }
        }
        out.data[layer] = dst;
      }
      return out;
    }

    // Ghost erzeugen
    function buildGhostFromData(reg) {
      if (!reg) {
        ghostCanvas = null;
        ghostCtx = null;
        return;
      }
      var ts = editor.getTileSize();
      var wpx = reg.w * ts,
        hpx = reg.h * ts;
      var cnv =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(wpx, hpx)
          : (function () {
              var t = document.createElement("canvas");
              t.width = wpx;
              t.height = hpx;
              return t;
            })();
      var c2d = cnv.getContext("2d");
      var li, layer, r, c, id;
      for (li = 0; li < reg.layers.length; li++) {
        layer = reg.layers[li];
        for (r = 0; r < reg.h; r++) {
          for (c = 0; c < reg.w; c++) {
            id = reg.data[layer][r][c] | 0;
            if (!id) continue;
            c2d.fillStyle = editor.colorForIdLayer(layer, id);
            c2d.fillRect(c * ts, r * ts, ts, ts);
          }
        }
      }
      ghostCanvas = cnv;
      ghostCtx = c2d;
    }

    // ===== Clipboard Ops =====
    function copySelectionToClipboardOnly() {
      if (!hasSel()) return false;
      clip = readRegion(sel);
      clipIsCut = false;
      return true;
    }
    function cutSelection() {
      if (!hasSel()) return false;
      clip = readRegion(sel);
      clipIsCut = true;
      if (editor.beginCompound) editor.beginCompound("cut-selection");
      clearRegion(sel);
      if (editor.endCompound) editor.endCompound(false);
      editor.requestRender();
      return true;
    }
    function pasteClipboardAsFloating(atCol, atRow) {
      if (!clip) return false;
      floatData = {
        w: clip.w,
        h: clip.h,
        layers: clip.layers.slice(),
        data: {},
      };
      for (var li = 0; li < clip.layers.length; li++) {
        var layer = clip.layers[li];
        var rows = new Array(clip.h);
        for (var r = 0; r < clip.h; r++) {
          rows[r] = clip.data[layer][r].slice(0);
        }
        floatData.data[layer] = rows;
      }
      var start = findNearbyPlacement(
        atCol | 0,
        atRow | 0,
        floatData.w,
        floatData.h
      );
      floatPos = { col: start.col, row: start.row };
      floating = true;
      floatDragging = false;
      buildGhostFromData(floatData);
      sel = {
        c0: floatPos.col,
        r0: floatPos.row,
        c1: floatPos.col + floatData.w - 1,
        r1: floatPos.row + floatData.h - 1,
      };
      editor.requestRender();
      return true;
    }

    // ===== Mini-Toolbar =====
    var ui = document.createElement("div");
    ui.className = "selection-mini";
    ui.style.display = "none";
    ui.innerHTML =
      "" +
      '<button type="button" data-act="copy"  title="Kopieren (Strg+C)">⧉</button>' +
      '<button type="button" data-act="cut"   title="Ausschneiden (Strg+X)">✂</button>' +
      '<button type="button" data-act="rot"   title="Rotieren 90°">⟳</button>';
    document.body.appendChild(ui);

    function placeMiniToolbar() {
      if (!hasSel()) {
        ui.style.display = "none";
        return;
      }
      var ts = editor.getTileSize();
      var wx = sel.c0 * ts,
        wy = sel.r0 * ts;
      var p = editor.worldToScreen(wx, wy);
      var rect = canvas.getBoundingClientRect();
      ui.style.left = rect.left + p.x + 6 + "px";
      ui.style.top = rect.top + p.y - 30 + "px";
      ui.style.display = active ? "block" : "none";
    }
    function hideMini() {
      ui.style.display = "none";
    }

    ui.addEventListener("click", function (e) {
      var a = e.target && e.target.getAttribute("data-act");
      if (!a) return;

      if (a === "copy") {
        if (!hasSel()) return;
        // schwebende Kopie bei +1/+1 (oder Maus bei 1x1), keine Weltänderung
        var src = readRegion(sel);
        var baseCol = sel.c0 + 1,
          baseRow = sel.r0 + 1;
        var sz = selSize(sel);
        if (sz.w === 1 && sz.h === 1 && lastMouseTile) {
          baseCol = lastMouseTile.col;
          baseRow = lastMouseTile.row;
        }
        floatData = src;
        floating = true;
        clipIsCut = false;
        var start = findNearbyPlacement(baseCol, baseRow, src.w, src.h);
        floatPos = { col: start.col, row: start.row };
        buildGhostFromData(floatData);
        sel = {
          c0: floatPos.col,
          r0: floatPos.row,
          c1: floatPos.col + floatData.w - 1,
          r1: floatPos.row + floatData.h - 1,
        };
        editor.requestRender();
        placeMiniToolbar();
        return;
      } else if (a === "cut") {
        cutSelection();
      } else if (a === "rot") {
        // Rotate: Ghost drehen, falls floating aktiv; sonst In-Place drehen
        if (floating && floatData) {
          floatData = rotateDataCW(floatData);
          buildGhostFromData(floatData);
          sel = {
            c0: floatPos.col,
            r0: floatPos.row,
            c1: floatPos.col + floatData.w - 1,
            r1: floatPos.row + floatData.h - 1,
          };
          editor.requestRender();
        } else if (hasSel()) {
          var src = readRegion(sel);
          var rot = rotateDataCW(src);
          if (editor.beginCompound) editor.beginCompound("rotate-selection");
          clearRegion(sel);
          writeRegionAt(rot, sel.c0, sel.r0);
          if (editor.endCompound) editor.endCompound(false);
          sel = {
            c0: sel.c0,
            r0: sel.r0,
            c1: sel.c0 + rot.w - 1,
            r1: sel.r0 + rot.h - 1,
          };
          editor.requestRender();
        }
      }
      placeMiniToolbar();
    });

    // ===== Overlay-Rendering =====
    if (!editor.selectionOverlayPatched) {
      var origDraw = editor.draw;
      editor.draw = function (ctx) {
        if (typeof origDraw === "function") origDraw(ctx);
        drawOverlay(ctx);
      };
      editor.selectionOverlayPatched = true;
    }

    function drawOverlay(ctx) {
      if (!active) return;
      var ts = editor.getTileSize();
      ctx.save();

      // Floating-Ghost mit Inhalt
      if (floating && floatData && ghostCanvas) {
        var dx = floatDragOffset.dc * ts,
          dy = floatDragOffset.dr * ts;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(
          ghostCanvas,
          floatPos.col * ts + dx,
          floatPos.row * ts + dy
        );
        ctx.globalAlpha = 1.0;
      }

      // Auswahlrahmen
      if (hasSel()) {
        var x = sel.c0 * ts,
          y = sel.r0 * ts,
          w = (sel.c1 - sel.c0 + 1) * ts,
          h = (sel.r1 - sel.r0 + 1) * ts;
        ctx.lineWidth = 2 / editor.getCamera().z;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }

      ctx.restore();
      placeMiniToolbar();
    }

    // ===== Tool-Aktivierung / -Wechsel =====
    window.addEventListener("em:setTool", function (ev) {
      var t = ev && ev.detail && ev.detail.tool;
      var nowActive = t === TOOL_NAME;
      if (nowActive === active) return;

      active = nowActive;
      if (!active) {
        // Beim Abwählen selektierter Bereich & Floating weg
        sel = null;
        selecting = false;
        draggingSel = false;
        dragStartSel = null;
        dragOffsetSel = { dc: 0, dr: 0 };

        floating = false;
        floatData = null;
        floatPos = { col: 0, row: 0 };
        floatDragging = false;
        floatDragStart = null;
        floatDragOffset = { dc: 0, dr: 0 };
        ghostCanvas = null;
        ghostCtx = null;

        hideMini();
        canvas.style.cursor = "";
      }
      editor.requestRender();
    });

    // ===== Pointer =====
    canvas.addEventListener("pointerdown", function (e) {
      if (!active) return;
      var t = tileFromEvent(e);
      lastMouseTile = t;
      if (!t) return;
      canvas.setPointerCapture(e.pointerId);

      // Floating vorhanden -> Drag der Floating-Box
      if (floating && insideFloat(t)) {
        floatDragging = true;
        floatDragStart = { col: t.col, row: t.row };
        floatDragOffset = { dc: 0, dr: 0 };
        e.preventDefault();
        return;
      }

      // Klick in bestehende Auswahl -> klassisches Move (Cut+Paste beim Loslassen)
      if (!floating && insideSel(t)) {
        draggingSel = true;
        dragStartSel = { col: t.col, row: t.row };
        dragOffsetSel = { dc: 0, dr: 0 };
        e.preventDefault();
        return;
      }

      // Neue Auswahl starten
      selecting = true;
      sel = normSel(t, t);
      dragOffsetSel = { dc: 0, dr: 0 };
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", function (e) {
      var t = tileFromEvent(e);
      lastMouseTile = t;

      // Cursor: move über Auswahl oder Floating
      var overMove = false;
      if (floating && insideFloat(t)) overMove = true;
      else if (!floating && insideSel(t)) overMove = true;
      canvas.style.cursor = active && overMove ? "move" : active ? "" : "";

      if (!active) return;

      if (selecting && t) {
        sel = normSel({ col: sel.c0, row: sel.r0 }, t);
        editor.requestRender();
      } else if (floatDragging && t) {
        floatDragOffset.dc = (t.col - floatDragStart.col) | 0;
        floatDragOffset.dr = (t.row - floatDragStart.row) | 0;
        sel = {
          c0: (floatPos.col + floatDragOffset.dc) | 0,
          r0: (floatPos.row + floatDragOffset.dr) | 0,
          c1: (floatPos.col + floatDragOffset.dc + floatData.w - 1) | 0,
          r1: (floatPos.row + floatDragOffset.dr + floatData.h - 1) | 0,
        };
        editor.requestRender();
      } else if (draggingSel && t) {
        dragOffsetSel.dc = (t.col - dragStartSel.col) | 0;
        dragOffsetSel.dr = (t.row - dragStartSel.row) | 0;
        editor.requestRender();
      }
    });

    canvas.addEventListener("pointerup", function (e) {
      if (!active) return;
      canvas.releasePointerCapture(e.pointerId);

      // Floating-Commit beim Loslassen
      if (floatDragging && floatData) {
        floatDragging = false;
        var target = {
          col: (floatPos.col + floatDragOffset.dc) | 0,
          row: (floatPos.row + floatDragOffset.dr) | 0,
        };
        if (editor.beginCompound)
          editor.beginCompound(clipIsCut ? "paste-from-cut" : "paste-copy");
        writeRegionAt(floatData, target.col, target.row); // -> auf aktuellem Level!
        if (editor.endCompound) editor.endCompound(false);

        // Selektion nach Commit
        sel = {
          c0: target.col,
          r0: target.row,
          c1: target.col + floatData.w - 1,
          r1: target.row + floatData.h - 1,
        };

        // Cut-Clipboard ist verbraucht -> alles deselektieren & Clipboard löschen
        if (clipIsCut) {
          sel = null;
          clip = null;
          clipIsCut = false;
        }

        floating = false;
        floatData = null;
        ghostCanvas = null;
        ghostCtx = null;
        floatDragOffset = { dc: 0, dr: 0 };

        editor.requestRender();
        return;
      }

      // Klassisches Move (Cut+Paste) der bestehenden Auswahl
      if (draggingSel && hasSel()) {
        draggingSel = false;
        if (dragOffsetSel.dc !== 0 || dragOffsetSel.dr !== 0) {
          var s = sel,
            src = readRegion(s);
          if (editor.beginCompound) editor.beginCompound("move-selection");
          clearRegion(s);
          var base = clampToWorld(
            s.c0 + dragOffsetSel.dc,
            s.r0 + dragOffsetSel.dr
          );
          writeRegionAt(src, base.col, base.row); // -> auf aktuellem Level!
          if (editor.endCompound) editor.endCompound(false);
          sel = {
            c0: base.col,
            r0: base.row,
            c1: base.col + src.w - 1,
            r1: base.row + src.h - 1,
          };
        }
        dragOffsetSel = { dc: 0, dr: 0 };
        editor.requestRender();
      }

      selecting = false;
    });

    canvas.addEventListener("pointerleave", function () {
      selecting = false;
      draggingSel = false;
      floatDragging = false;
      dragOffsetSel = { dc: 0, dr: 0 };
      floatDragOffset = { dc: 0, dr: 0 };
      if (active) canvas.style.cursor = "";
    });

    // ===== Shortcuts =====
    window.addEventListener("keydown", function (e) {
      if (!active) return;
      var key = (e.key || "").toLowerCase();
      var mod = e.ctrlKey || e.metaKey;

      if (mod && key === "c") {
        if (hasSel()) copySelectionToClipboardOnly();
        e.preventDefault();
      } else if (mod && key === "x") {
        cutSelection();
        e.preventDefault();
      } else if (mod && key === "v") {
        var t = lastMouseTile;
        if (!t) {
          var r = canvas.getBoundingClientRect();
          t = editor.clientToTile({
            clientX: r.left + 10,
            clientY: r.top + 10,
          });
        }
        if (t) pasteClipboardAsFloating(t.col, t.row);
        e.preventDefault();
      } else if (key === "delete" || key === "backspace") {
        if (hasSel()) {
          if (editor.beginCompound) editor.beginCompound("delete-selection");
          clearRegion(sel);
          if (editor.endCompound) editor.endCompound(false);
          editor.requestRender();
        }
        e.preventDefault();
      } else if (key === "escape") {
        if (floating) {
          floating = false;
          floatData = null;
          ghostCanvas = null;
          ghostCtx = null;
        }
        sel = null;
        editor.requestRender();
        e.preventDefault();
      } else if (key === "enter" || key === "return") {
        if (floating && floatData) {
          if (editor.beginCompound)
            editor.beginCompound(clipIsCut ? "paste-from-cut" : "paste-copy");
          writeRegionAt(
            floatData,
            floatPos.col + floatDragOffset.dc,
            floatPos.row + floatDragOffset.dr
          );
          if (editor.endCompound) editor.endCompound(false);
          if (clipIsCut) {
            sel = null;
            clip = null;
            clipIsCut = false;
          } else {
            sel = {
              c0: floatPos.col + floatDragOffset.dc,
              r0: floatPos.row + floatDragOffset.dr,
              c1: floatPos.col + floatDragOffset.dc + floatData.w - 1,
              r1: floatPos.row + floatDragOffset.dr + floatData.h - 1,
            };
          }
          floating = false;
          floatData = null;
          ghostCanvas = null;
          ghostCtx = null;
          floatDragOffset = { dc: 0, dr: 0 };
          editor.requestRender();
          e.preventDefault();
        }
      }
    });

    // DPR/Resize
    editor.on &&
      editor.on("canvas:resize", function () {
        dpr = editor.getDpr ? editor.getDpr() : window.devicePixelRatio || 1;
        placeMiniToolbar();
      });

    // Externe Aktivierung (Toolbar)
    window.emSelectToolActivate = function () {
      var evt = null;
      try {
        evt = new CustomEvent("em:setTool", { detail: { tool: TOOL_NAME } });
      } catch (e) {}
      if (evt) window.dispatchEvent(evt);
    };

    function placeMiniToolbar() {
      if (!hasSel()) {
        hideMini();
        return;
      }
      var ts = editor.getTileSize();
      var wx = sel.c0 * ts,
        wy = sel.r0 * ts;
      var p = editor.worldToScreen(wx, wy);
      var rect = canvas.getBoundingClientRect();
      ui.style.left = rect.left + p.x + 6 + "px";
      ui.style.top = rect.top + p.y - 30 + "px";
      ui.style.display = active ? "block" : "none";
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
