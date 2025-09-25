// editor-rulers.js
(function () {
  // ---- Konstante Ruler-Größen (px, im CSS-Pixelraum) ----
  var RULER_H = 24; // Höhe top-ruler
  var RULER_W = 28; // Breite left-ruler

  // HTML-Elemente
  var canvasMain = null;
  var editor = null;
  var rulerTop = null;
  var rulerLeft = null;

  // DPR
  var dpr = window.devicePixelRatio || 1;

  // Mausmarker (Screen-Pixel relativ zum Canvas-Client)
  var mouseX = null,
    mouseY = null;

  // simple render-invalidator
  var needsDraw = true;
  var lastCam = null;
  var lastSize = { w: 0, h: 0 };

  function $(id) {
    return document.getElementById(id);
  }

  function ensureElems() {
    // Editor + Canvas aus globalem Scope
    canvasMain = document.getElementById('canvas');
    editor = window.editor;

    if (!canvasMain || !editor || typeof editor.getCamera !== "function") {
      console.warn("[rulers] canvas/editor nicht verfügbar.");
      return false;
    }

    // Ruler-Canvas erstellen, falls nicht vorhanden
    rulerTop = document.createElement("canvas");
    rulerLeft = document.createElement("canvas");
    rulerTop.id = "rulerTop";
    rulerLeft.id = "rulerLeft";

    // Positionierung: fixed; Main-Canvas verschieben, damit Ruler nicht überlagern
    styleRulersAndMain();

    // Anhängen
    document.body.appendChild(rulerTop);
    document.body.appendChild(rulerLeft);

    // Events
    window.addEventListener("resize", onResize, false);
    canvasMain.addEventListener("pointermove", onPointerMove, false);
    canvasMain.addEventListener("pointerleave", onPointerLeave, false);

    return true;
  }

  function styleRulersAndMain() {
    // Main Canvas: an Ruler-Offsets anpassen
    canvasMain.style.position = "fixed";
    canvasMain.style.left = RULER_W + "px";
    canvasMain.style.top = RULER_H + "px";
    canvasMain.style.width = "calc(100vw - " + RULER_W + "px)";
    canvasMain.style.height = "calc(100vh - " + RULER_H + "px)";

    // Top-Ruler
    rulerTop.style.position = "fixed";
    rulerTop.style.left = RULER_W + "px";
    rulerTop.style.top = "0";
    rulerTop.style.height = RULER_H + "px";
    rulerTop.style.width = "calc(100vw - " + RULER_W + "px)";
    rulerTop.style.zIndex = 10;
    rulerTop.style.background = "#101217";

    // Left-Ruler
    rulerLeft.style.position = "fixed";
    rulerLeft.style.left = "0";
    rulerLeft.style.top = RULER_H + "px";
    rulerLeft.style.width = RULER_W + "px";
    rulerLeft.style.height = "calc(100vh - " + RULER_H + "px)";
    rulerLeft.style.zIndex = 10;
    rulerLeft.style.background = "#101217";

    // Ecke oben links (zwischen den Linealen)
    var corner = document.createElement("div");
    corner.style.position = "fixed";
    corner.style.left = "0";
    corner.style.top = "0";
    corner.style.width = RULER_W + "px";
    corner.style.height = RULER_H + "px";
    corner.style.background = "#101217";
    corner.style.zIndex = 11;
    document.body.appendChild(corner);
  }

  function resizeCanvasBackingStore(c, cssW, cssH) {
    dpr = window.devicePixelRatio || 1;
    var needW = Math.max(1, Math.round(cssW * dpr));
    var needH = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== needW || c.height !== needH) {
      c.width = needW;
      c.height = needH;
    }
  }

  function onResize() {
    needsDraw = true;
  }

  function onPointerMove(e) {
    var rect = canvasMain.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    needsDraw = true;
  }
  function onPointerLeave() {
    mouseX = mouseY = null;
    needsDraw = true;
  }

  // Hilfsfunktionen
  function pickStep(tilePx) {
    // Wähle Tile-Schritt, so dass Abstand ~70–140px ist
    // Schritte als Potenzen/Vielfache von 2/5
    var candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    var target = 90;
    var best = candidates[0],
      bestDiff = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var px = candidates[i] * tilePx;
      var diff = Math.abs(px - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidates[i];
      }
    }
    return best;
  }

  function drawRulers() {
    if (!editor || !canvasMain) return;

    // Aktuelle Kamera & Welt
    var cam = editor.getCamera();
    var world = editor.getWorld();
    var tile = editor.getTileSize();

    // Größen
    var mainRect = canvasMain.getBoundingClientRect();
    var topRectW = mainRect.width;
    var leftRectH = mainRect.height;

    // Backing Stores
    resizeCanvasBackingStore(rulerTop, topRectW, RULER_H);
    resizeCanvasBackingStore(rulerLeft, RULER_W, leftRectH);

    var ctxT = rulerTop.getContext("2d");
    var ctxL = rulerLeft.getContext("2d");

    // Clear
    ctxT.setTransform(1, 0, 0, 1, 0, 0);
    ctxL.setTransform(1, 0, 0, 1, 0, 0);
    ctxT.clearRect(0, 0, rulerTop.width, rulerTop.height);
    ctxL.clearRect(0, 0, rulerLeft.width, rulerLeft.height);

    // DPI-Kompensation
    ctxT.scale(dpr, dpr);
    ctxL.scale(dpr, dpr);

    // Styles
    var bg = "#101217";
    var grid = "#2f3340";
    var text = "#bac2d6";
    var major = "#8892a8";
    var axisX =
      (editor.getGridStyle && editor.getGridStyle().axisX) || "#4caf50";
    var axisY =
      (editor.getGridStyle && editor.getGridStyle().axisY) || "#ff7043";

    // Fill BG
    ctxT.fillStyle = bg;
    ctxT.fillRect(0, 0, topRectW, RULER_H);
    ctxL.fillStyle = bg;
    ctxL.fillRect(0, 0, RULER_W, leftRectH);

    // Berechne sichtbaren Bereich in Weltkoords (für die Ruler)
    var tl = editor.screenToWorld(0, 0);
    var br = editor.screenToWorld(mainRect.width, mainRect.height);

    var tilePx = tile * cam.z; // px pro Tile (bildschirm)
    var stepTiles = pickStep(tilePx);
    var stepPx = stepTiles * tilePx;

    // --- TOP RULER (X) ---
    ctxT.fillStyle = text;
    ctxT.strokeStyle = grid;
    ctxT.lineWidth = 1;

    // Erste Tickposition am linken Rand ausrichten
    // Starttile = floor(visibleX / stepTiles) * stepTiles
    var startTileX = Math.floor(tl.x / tile / stepTiles) * stepTiles;
    var endTileX = Math.ceil(br.x / tile / stepTiles) * stepTiles;

    // Null-Achse (y=0) Marker im Top-Ruler (falls im Sichtfenster)
    var y0InScreen = (0 - tl.y) * cam.z; // nicht benötigt für top-ruler linie; wir heben x=0 im top mit farbe hervor
    // x=0 Position auf dem Top-Ruler:
    var x0 = (0 - tl.x) * cam.z;
    if (x0 >= 0 && x0 <= mainRect.width) {
      ctxT.strokeStyle = axisY;
      ctxT.beginPath();
      ctxT.moveTo(x0 + 0.5, 0);
      ctxT.lineTo(x0 + 0.5, RULER_H);
      ctxT.stroke();
    }

    // Ticks + Labels
    ctxT.strokeStyle = grid;
    ctxT.fillStyle = text;
    ctxT.font = "10px system-ui, sans-serif";
    ctxT.textAlign = "center";
    ctxT.textBaseline = "top";

    for (var tX = startTileX; tX <= endTileX; tX += stepTiles) {
      var wx = tX * tile;
      var sx = (wx - tl.x) * cam.z; // screen x in main-canvas-space
      // Major tick
      ctxT.beginPath();
      ctxT.moveTo(Math.round(sx) + 0.5, 0);
      ctxT.lineTo(Math.round(sx) + 0.5, RULER_H);
      ctxT.stroke();
      // Label (Tile-Index)
      if (sx >= 0 && sx <= mainRect.width) {
        ctxT.fillText("" + tX, Math.round(sx), 2);
      }
      // Optional: Minor Ticks zwischen den Majors
      var minorCount = 5;
      var minorStepPx = stepPx / minorCount;
      for (var m = 1; m < minorCount; m++) {
        var msx = sx + m * minorStepPx;
        if (msx < 0 || msx > mainRect.width) continue;
        ctxT.beginPath();
        ctxT.moveTo(Math.round(msx) + 0.5, RULER_H * 0.5);
        ctxT.lineTo(Math.round(msx) + 0.5, RULER_H);
        ctxT.stroke();
      }
    }

    // Mausmarker vertikal (wenn Maus über main-canvas ist)
    if (mouseX != null) {
      ctxT.strokeStyle = "#00e5ff";
      ctxT.beginPath();
      ctxT.moveTo(Math.round(mouseX) + 0.5, 0);
      ctxT.lineTo(Math.round(mouseX) + 0.5, RULER_H);
      ctxT.stroke();
    }

    // --- LEFT RULER (Y) ---
    ctxL.fillStyle = text;
    ctxL.strokeStyle = grid;
    ctxL.lineWidth = 1;

    // y=0 Linie in Left-Ruler
    var y0 = (0 - tl.y) * cam.z;
    if (y0 >= 0 && y0 <= mainRect.height) {
      ctxL.strokeStyle = axisX;
      ctxL.beginPath();
      ctxL.moveTo(0, Math.round(y0) + 0.5);
      ctxL.lineTo(RULER_W, Math.round(y0) + 0.5);
      ctxL.stroke();
    }

    // Ticks + Labels
    ctxL.strokeStyle = grid;
    ctxL.fillStyle = text;
    ctxL.font = "10px system-ui, sans-serif";
    ctxL.textAlign = "left";
    ctxL.textBaseline = "middle";

    var startTileY = Math.floor(tl.y / tile / stepTiles) * stepTiles;
    var endTileY = Math.ceil(br.y / tile / stepTiles) * stepTiles;

    for (var tY = startTileY; tY <= endTileY; tY += stepTiles) {
      var wy = tY * tile;
      var sy = (wy - tl.y) * cam.z;
      // Major tick
      ctxL.beginPath();
      ctxL.moveTo(0, Math.round(sy) + 0.5);
      ctxL.lineTo(RULER_W, Math.round(sy) + 0.5);
      ctxL.stroke();
      // Label
      if (sy >= 0 && sy <= leftRectH) {
        // kleine Einrückung, damit Text nicht am Rand klebt
        ctxL.fillText("" + tY, 2, Math.round(sy));
      }
      // Minor
      var minorCountY = 5;
      var minorStepPxY = stepPx / minorCountY;
      for (var n = 1; n < minorCountY; n++) {
        var msy = sy + n * minorStepPxY;
        if (msy < 0 || msy > leftRectH) continue;
        ctxL.beginPath();
        ctxL.moveTo(RULER_W * 0.5, Math.round(msy) + 0.5);
        ctxL.lineTo(RULER_W, Math.round(msy) + 0.5);
        ctxL.stroke();
      }
    }

    // Mausmarker horizontal
    if (mouseY != null) {
      ctxL.strokeStyle = "#00e5ff";
      ctxL.beginPath();
      ctxL.moveTo(0, Math.round(mouseY) + 0.5);
      ctxL.lineTo(RULER_W, Math.round(mouseY) + 0.5);
      ctxL.stroke();
    }
  }

  // Overlay erzeugen
  var coordBox = document.createElement("div");
  coordBox.style.position = "fixed";
  coordBox.style.left = "10px";
  coordBox.style.bottom = "10px";
  coordBox.style.padding = "4px 6px";
  coordBox.style.font = "12px monospace";
  coordBox.style.background = "rgba(0,0,0,0.6)";
  coordBox.style.color = "#fff";
  coordBox.style.pointerEvents = "none";
  coordBox.style.zIndex = 9999;
  document.body.appendChild(coordBox);

  // Mausbewegung → Koordinaten updaten
  canvas.addEventListener("pointermove", function (e) {
    var t = (editor && editor.clientToTile) ? editor.clientToTile(e) : null;
    if (t) {
      coordBox.textContent = "Tile: " + t.col + "," + t.row;
    } else {
      coordBox.textContent = "Außerhalb";
    }
  });

  function tick() {
    if (!editor || !canvasMain) return;

    var camNow = editor.getCamera();
    var rect = canvasMain.getBoundingClientRect();
    var changed =
      !lastCam ||
      camNow.x !== lastCam.x ||
      camNow.y !== lastCam.y ||
      camNow.z !== lastCam.z ||
      rect.width !== lastSize.w ||
      rect.height !== lastSize.h ||
      needsDraw;

    if (changed) {
      drawRulers();
      lastCam = { x: camNow.x, y: camNow.y, z: camNow.z };
      lastSize.w = rect.width;
      lastSize.h = rect.height;
      needsDraw = false;
    }
    requestAnimationFrame(tick);
  }

  function init() {
    if (!ensureElems()) {
      document.addEventListener('editor:ready', function(){ init(); }, { once: true });
      return;
    }
    needsDraw = true;
    tick();
    console.log("[rulers] initialisiert.");
  }

  // Start sobald der Rest bereit ist
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
