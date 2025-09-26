// ui-rulers.js – Top/Left rulers + tile coordinate overlay (ES5, PlainJS)
(function () {
  // Constant sizes (CSS px)
  var RULER_H = 24;
  var RULER_W = 28;

  // Elements
  var canvasMain = null;
  var editor = null;
  var rulerTop = null;
  var rulerLeft = null;
  var cornerBox = null;
  var coordBox = null;

  // State
  var dpr = window.devicePixelRatio || 1;
  var mouseX = null, mouseY = null;
  var needsDraw = true;
  var lastCam = null;
  var lastSize = { w: 0, h: 0 };
  var initialized = false;

  function ensureElems() {
    if (initialized) return true;

    editor = window.editor;
    if (!editor) return false;

    canvasMain = (typeof editor.getCanvas === "function") ? editor.getCanvas() : document.getElementById("canvas");
    if (!canvasMain) return false;

    // Avoid double init
    if (document.getElementById("rulerTop") || document.getElementById("rulerLeft")) {
      rulerTop = document.getElementById("rulerTop");
      rulerLeft = document.getElementById("rulerLeft");
    } else {
      rulerTop = document.createElement("canvas");
      rulerLeft = document.createElement("canvas");
      rulerTop.id = "rulerTop";
      rulerLeft.id = "rulerLeft";
      document.body.appendChild(rulerTop);
      document.body.appendChild(rulerLeft);
    }

    if (!document.getElementById("rulerCorner")) {
      cornerBox = document.createElement("div");
      cornerBox.id = "rulerCorner";
      document.body.appendChild(cornerBox);
    } else {
      cornerBox = document.getElementById("rulerCorner");
    }

    if (!document.getElementById("coordBox")) {
      coordBox = document.createElement("div");
      coordBox.id = "coordBox";
      document.body.appendChild(coordBox);
    } else {
      coordBox = document.getElementById("coordBox");
    }

    styleRulersAndMain();
    attachEvents();

    initialized = true;
    return true;
  }

  function styleRulersAndMain() {
    // Main canvas placement
    canvasMain.style.position = "fixed";
    canvasMain.style.left = RULER_W + "px";
    canvasMain.style.top = RULER_H + "px";
    canvasMain.style.width = "calc(100vw - " + RULER_W + "px)";
    canvasMain.style.height = "calc(100vh - " + RULER_H + "px)";

    // Top ruler
    rulerTop.style.position = "fixed";
    rulerTop.style.left = RULER_W + "px";
    rulerTop.style.top = "0";
    rulerTop.style.height = RULER_H + "px";
    rulerTop.style.width = "calc(100vw - " + RULER_W + "px)";
    rulerTop.style.zIndex = 10;
    rulerTop.style.background = "#101217";

    // Left ruler
    rulerLeft.style.position = "fixed";
    rulerLeft.style.left = "0";
    rulerLeft.style.top = RULER_H + "px";
    rulerLeft.style.width = RULER_W + "px";
    rulerLeft.style.height = "calc(100vh - " + RULER_H + "px)";
    rulerLeft.style.zIndex = 10;
    rulerLeft.style.background = "#101217";

    // Corner (top-left)
    cornerBox.style.position = "fixed";
    cornerBox.style.left = "0";
    cornerBox.style.top = "0";
    cornerBox.style.width = RULER_W + "px";
    cornerBox.style.height = RULER_H + "px";
    cornerBox.style.background = "#101217";
    cornerBox.style.zIndex = 11;

    // Coords overlay
    coordBox.style.position = "fixed";
    coordBox.style.left = "10px";
    coordBox.style.bottom = "10px";
    coordBox.style.padding = "4px 6px";
    coordBox.style.font = "12px monospace";
    coordBox.style.background = "rgba(0,0,0,0.6)";
    coordBox.style.color = "#fff";
    coordBox.style.pointerEvents = "none";
    coordBox.style.zIndex = 9999;
  }

  function attachEvents() {
    window.addEventListener("resize", onResize, false);
    canvasMain.addEventListener("pointermove", onPointerMove, false);
    canvasMain.addEventListener("pointerleave", onPointerLeave, false);

    // Update coords overlay
    canvasMain.addEventListener("pointermove", function (e) {
      var t = (editor && editor.clientToTile) ? editor.clientToTile(e) : null;
      if (t) coordBox.textContent = "Tile: " + t.col + "," + t.row;
      else coordBox.textContent = "Außerhalb";
    }, false);

    if (typeof editor.on === "function") {
      editor.on("canvas:resize", function(){ needsDraw = true; });
      editor.on("world:resize", function(){ needsDraw = true; });
    }
  }

  function resizeBackingStore(c, cssW, cssH) {
    dpr = window.devicePixelRatio || 1;
    var needW = Math.max(1, Math.round(cssW * dpr));
    var needH = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== needW || c.height !== needH) {
      c.width = needW;
      c.height = needH;
    }
  }

  function pickStep(tilePx) {
    // Choose a tile step ~90px
    var candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    var target = 90;
    var best = candidates[0], bestDiff = 1e9;
    for (var i = 0; i < candidates.length; i++) {
      var px = candidates[i] * tilePx;
      var diff = Math.abs(px - target);
      if (diff < bestDiff) { bestDiff = diff; best = candidates[i]; }
    }
    return best;
  }

  function drawRulers() {
    if (!editor || !canvasMain) return;

    var cam = editor.getCamera();
    var tile = editor.getTileSize();
    var gs = (editor.getGridStyle && editor.getGridStyle()) || {};
    var axisX = gs.axisX || "#4caf50";
    var axisY = gs.axisY || "#ff7043";

    var mainRect = canvasMain.getBoundingClientRect();
    var topRectW = mainRect.width;
    var leftRectH = mainRect.height;

    resizeBackingStore(rulerTop, topRectW, RULER_H);
    resizeBackingStore(rulerLeft, RULER_W, leftRectH);

    var ctxT = rulerTop.getContext("2d");
    var ctxL = rulerLeft.getContext("2d");

    // reset + clear
    ctxT.setTransform(1, 0, 0, 1, 0, 0);
    ctxL.setTransform(1, 0, 0, 1, 0, 0);
    ctxT.clearRect(0, 0, rulerTop.width, rulerTop.height);
    ctxL.clearRect(0, 0, rulerLeft.width, rulerLeft.height);

    // scale to DPR
    ctxT.scale(dpr, dpr);
    ctxL.scale(dpr, dpr);

    var bg = "#101217";
    var grid = "#2f3340";
    var text = "#bac2d6";
    var major = "#8892a8";

    ctxT.fillStyle = bg; ctxT.fillRect(0, 0, topRectW, RULER_H);
    ctxL.fillStyle = bg; ctxL.fillRect(0, 0, RULER_W, leftRectH);

    // world viewport
    var tl = editor.screenToWorld(0, 0);
    var br = editor.screenToWorld(mainRect.width, mainRect.height);

    var tilePx = tile * cam.z;
    var stepTiles = pickStep(tilePx);
    var stepPx = stepTiles * tilePx;

    // --- TOP (X) ---
    ctxT.fillStyle = text;
    ctxT.strokeStyle = grid;
    ctxT.lineWidth = 1;

    // x=0 marker
    var x0 = (0 - tl.x) * cam.z;
    if (x0 >= 0 && x0 <= mainRect.width) {
      ctxT.strokeStyle = axisY;
      ctxT.beginPath();
      ctxT.moveTo(Math.round(x0) + 0.5, 0);
      ctxT.lineTo(Math.round(x0) + 0.5, RULER_H);
      ctxT.stroke();
    }

    ctxT.strokeStyle = grid;
    ctxT.fillStyle = text;
    ctxT.font = "10px system-ui, sans-serif";
    ctxT.textAlign = "center";
    ctxT.textBaseline = "middle";

    var startTileX = Math.floor(tl.x / tile / stepTiles) * stepTiles;
    var endTileX = Math.ceil(br.x / tile / stepTiles) * stepTiles;

    var tX, wx, sx, n, msx;
    for (tX = startTileX; tX <= endTileX; tX += stepTiles) {
      wx = tX * tile;
      sx = (wx - tl.x) * cam.z;

      // major tick
      ctxT.beginPath();
      ctxT.moveTo(Math.round(sx) + 0.5, 0);
      ctxT.lineTo(Math.round(sx) + 0.5, RULER_H);
      ctxT.stroke();

      // label
      if (sx >= 0 && sx <= topRectW) {
        ctxT.fillStyle = major;
        ctxT.fillText("" + tX, Math.round(sx), RULER_H * 0.5);
        ctxT.fillStyle = text;
      }

      // minor ticks
      var minorCount = 5;
      var minorStepPx = stepPx / minorCount;
      for (n = 1; n < minorCount; n++) {
        msx = sx + n * minorStepPx;
        if (msx < 0 || msx > topRectW) continue;
        ctxT.beginPath();
        ctxT.moveTo(Math.round(msx) + 0.5, RULER_H * 0.5);
        ctxT.lineTo(Math.round(msx) + 0.5, RULER_H);
        ctxT.stroke();
      }
    }

    // mouse marker vertical
    if (mouseX != null) {
      ctxT.strokeStyle = "#00e5ff";
      ctxT.beginPath();
      ctxT.moveTo(Math.round(mouseX) + 0.5, 0);
      ctxT.lineTo(Math.round(mouseX) + 0.5, RULER_H);
      ctxT.stroke();
    }

    // --- LEFT (Y) ---
    ctxL.fillStyle = text;
    ctxL.strokeStyle = grid;
    ctxL.lineWidth = 1;

    var y0 = (0 - tl.y) * cam.z;
    if (y0 >= 0 && y0 <= mainRect.height) {
      ctxL.strokeStyle = axisX;
      ctxL.beginPath();
      ctxL.moveTo(0, Math.round(y0) + 0.5);
      ctxL.lineTo(RULER_W, Math.round(y0) + 0.5);
      ctxL.stroke();
    }

    ctxL.strokeStyle = grid;
    ctxL.fillStyle = text;
    ctxL.font = "10px system-ui, sans-serif";
    ctxL.textAlign = "left";
    ctxL.textBaseline = "middle";

    var startTileY = Math.floor(tl.y / tile / stepTiles) * stepTiles;
    var endTileY = Math.ceil(br.y / tile / stepTiles) * stepTiles;

    var tY, wy, sy, n2, msy;
    for (tY = startTileY; tY <= endTileY; tY += stepTiles) {
      wy = tY * tile;
      sy = (wy - tl.y) * cam.z;

      ctxL.beginPath();
      ctxL.moveTo(0, Math.round(sy) + 0.5);
      ctxL.lineTo(RULER_W, Math.round(sy) + 0.5);
      ctxL.stroke();

      if (sy >= 0 && sy <= leftRectH) {
        ctxL.fillText("" + tY, 2, Math.round(sy));
      }

      var minorCountY = 5;
      var minorStepPxY = stepPx / minorCountY;
      for (n2 = 1; n2 < minorCountY; n2++) {
        msy = sy + n2 * minorStepPxY;
        if (msy < 0 || msy > leftRectH) continue;
        ctxL.beginPath();
        ctxL.moveTo(RULER_W * 0.5, Math.round(msy) + 0.5);
        ctxL.lineTo(RULER_W, Math.round(msy) + 0.5);
        ctxL.stroke();
      }
    }

    if (mouseY != null) {
      ctxL.strokeStyle = "#00e5ff";
      ctxL.beginPath();
      ctxL.moveTo(0, Math.round(mouseY) + 0.5);
      ctxL.lineTo(RULER_W, Math.round(mouseY) + 0.5);
      ctxL.stroke();
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
      document.addEventListener("editor:ready", function(){ init(); }, { once: true });
      return;
    }
    needsDraw = true;
    tick();
    // console.log("[rulers] ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();