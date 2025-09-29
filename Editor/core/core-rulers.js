// core-rulers.js – Top/Left rulers + tile coordinate overlay as Core plugin (ES5)
// Usage:
//   editor.use(EditorRulers)
//   editor.setRulersEnabled(true/false)
//   editor.setRulersStyle({ height:24, width:28, bg:"#101217", grid:"#2f3340", text:"#bac2d6", major:"#8892a8" })
// Notes:
// - Erstellt zwei Canvas-Elemente (oben/links), eine Ecke (div) und eine Koordinaten-Box (div).
// - Positioniert dein Main-Canvas so, dass es unten/rechts neben den Linealen sitzt (optional abschaltbar).
// - DPR-sicher, reagiert auf Camera/World/Canvas-Resize, zeigt Mausposition in Tiles an.
(function(){
  function install(editor){
    // ----- Options (können via setRulersStyle geändert werden) -----
    var opts = editor.opts || {};
    var R = {
      enabled: (typeof opts.rulersEnabled === "boolean") ? opts.rulersEnabled : true,
      height: (opts.rulerHeight|0) || 24,  // px (CSS)
      width:  (opts.rulerWidth|0)  || 28,  // px (CSS)
      bg:     opts.rulerBg   || "#101217",
      grid:   opts.rulerGrid || "#2f3340",
      text:   opts.rulerText || "#bac2d6",
      major:  opts.rulerMajor|| "#8892a8",
      axisX:  ("rulerAxisX" in opts) ? opts.rulerAxisX : "#4caf50",
      axisY:  ("rulerAxisY" in opts) ? opts.rulerAxisY : "#ff7043",
      mouse:  opts.rulerMouse|| "#00e5ff",
      placeMainCanvas: (typeof opts.rulerPlaceMainCanvas === "boolean") ? opts.rulerPlaceMainCanvas : true
    };

    // ----- State & DOM -----
    var dpr = window.devicePixelRatio || 1;
    var main = editor.getCanvas();
    var topC = null, leftC = null, cornerBox = null, coordBox = null;
    var mouseX = null, mouseY = null;
    var lastCam = null;
    var lastSize = { w: 0, h: 0 };
    var needsDraw = true;
    var rafId = 0;

    // ----- Helpers -----
    function cssSize() {
      var rect = main.getBoundingClientRect();
      return { w: rect.width, h: rect.height };
    }
    function resizeBacking(c, cssW, cssH) {
      dpr = window.devicePixelRatio || 1;
      var needW = Math.max(1, Math.round(cssW * dpr));
      var needH = Math.max(1, Math.round(cssH * dpr));
      if (c.width !== needW || c.height !== needH) {
        c.width = needW; c.height = needH;
      }
    }
    function pickStep(tilePx) {
      // ~90px Visiergröße
      var candidates = [1,2,5,10,20,50,100,200,500,1000];
      var target = 90, best = candidates[0], diffB = 1e9, i;
      for (i=0;i<candidates.length;i++){
        var px = candidates[i]*tilePx, d = Math.abs(px-target);
        if (d < diffB){ diffB=d; best=candidates[i]; }
      }
      return best;
    }

    function layout() {
      // Main-Canvas platzieren, falls gewünscht
      if (R.placeMainCanvas) {
        main.style.position = "fixed";
        main.style.left = R.width + "px";
        main.style.top = R.height + "px";
        main.style.width = "calc(100vw - " + R.width + "px)";
        main.style.height = "calc(100vh - " + R.height + "px)";
      }

      // Top Ruler
      topC.style.position = "fixed";
      topC.style.left = R.width + "px";
      topC.style.top = "0";
      topC.style.height = R.height + "px";
      topC.style.width = "calc(100vw - " + R.width + "px)";
      topC.style.zIndex = 10;
      topC.style.background = R.bg;

      // Left Ruler
      leftC.style.position = "fixed";
      leftC.style.left = "0";
      leftC.style.top = R.height + "px";
      leftC.style.width = R.width + "px";
      leftC.style.height = "calc(100vh - " + R.height + "px)";
      leftC.style.zIndex = 10;
      leftC.style.background = R.bg;

      // Corner (oben links)
      cornerBox.style.position = "fixed";
      cornerBox.style.left = "0";
      cornerBox.style.top = "0";
      cornerBox.style.width = R.width + "px";
      cornerBox.style.height = R.height + "px";
      cornerBox.style.background = R.bg;
      cornerBox.style.zIndex = 11;

      // Koordinaten-Overlay
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

    function ensureDom() {
      // bereits vorhanden?
      topC = document.getElementById("rulerTop");
      leftC = document.getElementById("rulerLeft");
      cornerBox = document.getElementById("rulerCorner");
      coordBox = document.getElementById("coordBox");
      if (!topC){ topC = document.createElement("canvas"); topC.id="rulerTop"; document.body.appendChild(topC); }
      if (!leftC){ leftC = document.createElement("canvas"); leftC.id="rulerLeft"; document.body.appendChild(leftC); }
      if (!cornerBox){ cornerBox = document.createElement("div"); cornerBox.id="rulerCorner"; document.body.appendChild(cornerBox); }
      if (!coordBox){ coordBox = document.createElement("div"); coordBox.id="coordBox"; document.body.appendChild(coordBox); }
      layout();
      needsDraw = true;
    }

    function draw() {
      if (!R.enabled) return;

      var cam = editor.getCamera();
      var tile = editor.getTileSize();

      // CSS Größen bestimmen
      var mainRect = main.getBoundingClientRect();
      var topW = mainRect.width;
      var leftH = mainRect.height;

      // Backing stores
      resizeBacking(topC, topW, R.height);
      resizeBacking(leftC, R.width, leftH);

      var ctxT = topC.getContext("2d");
      var ctxL = leftC.getContext("2d");

      // Reset + DPR
      ctxT.setTransform(1,0,0,1,0,0); ctxT.clearRect(0,0,topC.width, topC.height); ctxT.scale(dpr,dpr);
      ctxL.setTransform(1,0,0,1,0,0); ctxL.clearRect(0,0,leftC.width,leftC.height); ctxL.scale(dpr,dpr);

      // Farben
      var bg = R.bg, grid = R.grid, text = R.text, major = R.major;

      // Flächen füllen
      ctxT.fillStyle = bg; ctxT.fillRect(0,0,topW,R.height);
      ctxL.fillStyle = bg; ctxL.fillRect(0,0,R.width,leftH);

      // Welt-Viewport (Weltkoordinaten der Main-Canvas-Ecken)
      var tl = editor.screenToWorld(0, 0);
      var br = editor.screenToWorld(mainRect.width, mainRect.height);

      var tilePx = tile * cam.z;
      var stepTiles = pickStep(tilePx);
      var stepPx = stepTiles * tilePx;

      // --- TOP (X-Achse) ---
      ctxT.fillStyle = text;
      ctxT.strokeStyle = grid;
      ctxT.lineWidth = 1;
      ctxT.font = "10px system-ui, sans-serif";
      ctxT.textAlign = "center";
      ctxT.textBaseline = "middle";

      // y-Achse (x=0)
      var x0 = (0 - tl.x) * cam.z;
      if (x0 >= 0 && x0 <= mainRect.width && R.axisY) {
        ctxT.strokeStyle = R.axisY;
        ctxT.beginPath();
        ctxT.moveTo(Math.round(x0)+0.5, 0);
        ctxT.lineTo(Math.round(x0)+0.5, R.height);
        ctxT.stroke();
      }
      ctxT.strokeStyle = grid;

      var startTileX = Math.floor(tl.x / tile / stepTiles) * stepTiles;
      var endTileX   = Math.ceil (br.x / tile / stepTiles) * stepTiles;

      var tX, wx, sx, n, msx;
      for (tX = startTileX; tX <= endTileX; tX += stepTiles) {
        wx = tX * tile;
        sx = (wx - tl.x) * cam.z;

        // Major tick
        ctxT.beginPath();
        ctxT.moveTo(Math.round(sx)+0.5, 0);
        ctxT.lineTo(Math.round(sx)+0.5, R.height);
        ctxT.stroke();

        // Label
        if (sx >= 0 && sx <= topW) {
          ctxT.fillStyle = major;
          ctxT.fillText(""+tX, Math.round(sx), R.height*0.5);
          ctxT.fillStyle = text;
        }

        // Minor ticks
        var minorCount = 5, minorStepPx = stepPx / minorCount;
        for (n=1;n<minorCount;n++){
          msx = sx + n*minorStepPx;
          if (msx < 0 || msx > topW) continue;
          ctxT.beginPath();
          ctxT.moveTo(Math.round(msx)+0.5, R.height*0.5);
          ctxT.lineTo(Math.round(msx)+0.5, R.height);
          ctxT.stroke();
        }
      }

      // Maus-Marker vertikal
      if (mouseX != null && R.mouse) {
        ctxT.strokeStyle = R.mouse;
        ctxT.beginPath();
        ctxT.moveTo(Math.round(mouseX)+0.5, 0);
        ctxT.lineTo(Math.round(mouseX)+0.5, R.height);
        ctxT.stroke();
      }

      // --- LEFT (Y-Achse) ---
      ctxL.fillStyle = text;
      ctxL.strokeStyle = grid;
      ctxL.lineWidth = 1;
      ctxL.font = "10px system-ui, sans-serif";
      ctxL.textAlign = "left";
      ctxL.textBaseline = "middle";

      // x-Achse (y=0)
      var y0 = (0 - tl.y) * cam.z;
      if (y0 >= 0 && y0 <= mainRect.height && R.axisX) {
        ctxL.strokeStyle = R.axisX;
        ctxL.beginPath();
        ctxL.moveTo(0, Math.round(y0)+0.5);
        ctxL.lineTo(R.width, Math.round(y0)+0.5);
        ctxL.stroke();
      }
      ctxL.strokeStyle = grid;

      var startTileY = Math.floor(tl.y / tile / stepTiles) * stepTiles;
      var endTileY   = Math.ceil (br.y / tile / stepTiles) * stepTiles;

      var tY, wy, sy, n2, msy;
      for (tY = startTileY; tY <= endTileY; tY += stepTiles) {
        wy = tY * tile;
        sy = (wy - tl.y) * cam.z;

        ctxL.beginPath();
        ctxL.moveTo(0, Math.round(sy)+0.5);
        ctxL.lineTo(R.width, Math.round(sy)+0.5);
        ctxL.stroke();

        if (sy >= 0 && sy <= leftH) {
          ctxL.fillText(""+tY, 2, Math.round(sy));
        }

        var minorCountY = 5, minorStepPxY = stepPx / minorCountY;
        for (n2=1;n2<minorCountY;n2++){
          msy = sy + n2*minorStepPxY;
          if (msy < 0 || msy > leftH) continue;
          ctxL.beginPath();
          ctxL.moveTo(R.width*0.5, Math.round(msy)+0.5);
          ctxL.lineTo(R.width, Math.round(msy)+0.5);
          ctxL.stroke();
        }
      }

      // Maus-Marker horizontal
      if (mouseY != null && R.mouse) {
        ctxL.strokeStyle = R.mouse;
        ctxL.beginPath();
        ctxL.moveTo(0, Math.round(mouseY)+0.5);
        ctxL.lineTo(R.width, Math.round(mouseY)+0.5);
        ctxL.stroke();
      }
    }

    // ----- Events / Loop -----
    function onResize(){ needsDraw = true; }
    function onPointerMove(e){
      var rect = main.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      // Koordinaten-Overlay aktualisieren
      if (coordBox){
        var t = (editor && editor.clientToTile) ? editor.clientToTile(e) : null;
        coordBox.textContent = t ? ("Tile: " + t.col + "," + t.row) : "Außerhalb";
      }
      needsDraw = true;
    }
    function onPointerLeave(){ mouseX = mouseY = null; needsDraw = true; }

    function tick(){
      if (!R.enabled){ rafId = requestAnimationFrame(tick); return; }
      var cam = editor.getCamera();
      var size = cssSize();
      var changed =
        !lastCam ||
        cam.x !== lastCam.x ||
        cam.y !== lastCam.y ||
        cam.z !== lastCam.z ||
        size.w !== lastSize.w ||
        size.h !== lastSize.h ||
        needsDraw;

      if (changed){
        draw();
        lastCam = { x: cam.x, y: cam.y, z: cam.z };
        lastSize.w = size.w; lastSize.h = size.h;
        needsDraw = false;
      }
      rafId = requestAnimationFrame(tick);
    }

    function attach(){
      ensureDom();
      window.addEventListener("resize", onResize, false);
      main.addEventListener("pointermove", onPointerMove, false);
      main.addEventListener("pointerleave", onPointerLeave, false);

      if (typeof editor.on === "function"){
        editor.on("canvas:resize", function(){ needsDraw = true; });
        editor.on("world:resize", function(){ needsDraw = true; });
      }
      if (!rafId) tick();
    }

    function detach(){
      window.removeEventListener("resize", onResize, false);
      if (main){
        main.removeEventListener("pointermove", onPointerMove, false);
        main.removeEventListener("pointerleave", onPointerLeave, false);
      }
      if (rafId){ cancelAnimationFrame(rafId); rafId = 0; }
    }

    // ----- Public API -----
    function setRulersEnabled(on){
      var now = !!on;
      if (now === R.enabled) return;
      R.enabled = now;
      if (R.enabled){ attach(); }
      else { detach(); }
      editor.requestRender && editor.requestRender();
    }
    function setRulersStyle(style){
      if (!style) return;
      if ("height" in style) R.height = style.height|0;
      if ("width"  in style) R.width  = style.width|0;
      if ("bg"     in style) R.bg     = style.bg;
      if ("grid"   in style) R.grid   = style.grid;
      if ("text"   in style) R.text   = style.text;
      if ("major"  in style) R.major  = style.major;
      if ("axisX"  in style) R.axisX  = style.axisX;
      if ("axisY"  in style) R.axisY  = style.axisY;
      if ("mouse"  in style) R.mouse  = style.mouse;
      if ("placeMainCanvas" in style) R.placeMainCanvas = !!style.placeMainCanvas;
      layout();
      needsDraw = true;
      editor.requestRender && editor.requestRender();
    }
    function getRulersStyle(){
      return {
        enabled: R.enabled,
        height: R.height, width: R.width,
        bg: R.bg, grid: R.grid, text: R.text, major: R.major,
        axisX: R.axisX, axisY: R.axisY, mouse: R.mouse,
        placeMainCanvas: R.placeMainCanvas
      };
    }

    // API an den Editor hängen
    editor.setRulersEnabled = setRulersEnabled;
    editor.setRulersStyle = setRulersStyle;
    editor.getRulersStyle = getRulersStyle;

    // Initial aktiviert?
    if (R.enabled) attach();
  }

  window.EditorRulers = install;
})();
