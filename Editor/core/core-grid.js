// core-grid.js – Raster (sichtbarer Bereich, DPR-scharf)
// Usage:
//   editor.use(EditorGrid);
//   editor.drawGrid(ctx); // nach applyCamera(ctx)
//   editor.setGridStyle({ color:"#2f3340", bg:"#14171c" });
// API:
//   getVisibleGridRect() -> {c0,c1,r0,r1}
//   drawGrid(ctx), getGridStyle(), setGridStyle(style), setGridEnabled(on)
// Notes:
//   Nutzt screenToWorld + getWorld, zeichnet nur sichtbare Linien. :contentReference[oaicite:20]{index=20}


(function(){
  function install(editor){
    // ---- Defaults aus opts ziehen (alles optional) ----
    var opts = editor.opts || {};
    var GRID = {
      enabled: (typeof opts.gridEnabled === "boolean") ? opts.gridEnabled : true,
      color: opts.gridColor || "#2f3340",
      bg: opts.gridBg || "#14171c",
      axisX: opts.gridAxisX || null,   // z.B. "#4caf50" aktivieren, wenn du Achsen willst
      axisY: opts.gridAxisY || null,   // z.B. "#ff7043"
      spacing: (opts.gridSpacing|0) || 0,     // zusätzlicher Abstand zwischen Kanten (Weltpixel)
      offsetX: (opts.gridOffsetX|0) || 0,     // konstanter Offset (Weltpixel)
      offsetY: (opts.gridOffsetY|0) || 0,
      alpha: (typeof opts.gridAlpha === "number") ? opts.gridAlpha : 1
    };

    // ---- Hilfen ----
    function cssCanvasSize(){
      var canvas = editor.getCanvas();
      var dpr = editor.getDpr ? editor.getDpr() : (window.devicePixelRatio || 1);
      return { w: canvas.width / dpr, h: canvas.height / dpr };
    }

    function getVisibleGridRect() {
      var sz = cssCanvasSize();
      var tl = editor.screenToWorld(0, 0);
      var br = editor.screenToWorld(sz.w, sz.h);
      var ts = editor.getTileSize(), w = editor.getWorld();

      var c0 = Math.max(0, Math.floor(tl.x / ts) - 1);
      var r0 = Math.max(0, Math.floor(tl.y / ts) - 1);
      var c1 = Math.min(w.cols - 1, Math.ceil(br.x / ts) + 1);
      var r1 = Math.min(w.rows - 1, Math.ceil(br.y / ts) + 1);
      return { c0:c0, r0:r0, c1:c1, r1:r1 };
    }

    function setGridEnabled(on){
      GRID.enabled = !!on;
      editor.requestRender && editor.requestRender();
    }
    function setGridStyle(style){
      if (!style) return;
      if (typeof style.enabled === "boolean") GRID.enabled = style.enabled;
      if (style.color) GRID.color = style.color;
      if (style.bg) GRID.bg = style.bg;
      if ("axisX" in style) GRID.axisX = style.axisX;
      if ("axisY" in style) GRID.axisY = style.axisY;
      if ("spacing" in style) GRID.spacing = style.spacing|0;
      if ("offsetX" in style) GRID.offsetX = style.offsetX|0;
      if ("offsetY" in style) GRID.offsetY = style.offsetY|0;
      if ("alpha" in style && typeof style.alpha === "number") GRID.alpha = style.alpha;
      editor.requestRender && editor.requestRender();
    }
    function getGridStyle(){ return {
      enabled: GRID.enabled, color: GRID.color, bg: GRID.bg,
      axisX: GRID.axisX, axisY: GRID.axisY,
      spacing: GRID.spacing, offsetX: GRID.offsetX, offsetY: GRID.offsetY,
      alpha: GRID.alpha
    };}

    // Pixel-scharfe Linien: 0.5 im Geräteraum – hier in Weltkoordinaten umgerechnet
    function crispOffset(cam){
      // bei 1px-Linienbreite im Geräteraum verschiebt man um 0.5px
      // im Welt-Raum entspricht das 0.5 / cam.z
      return 0.5 / (cam && cam.z ? cam.z : 1);
    }

    function drawGrid(ctx){
      if (!GRID.enabled) return;

      var w = editor.getWorld(), ts = editor.getTileSize(), cam = editor.getCamera();

      // Hintergrund
      if (GRID.bg){
        ctx.save();
        ctx.globalAlpha = GRID.alpha;
        ctx.fillStyle = GRID.bg;
        ctx.fillRect(0,0,w.width,w.height);
        ctx.restore();
      }

      var r = getVisibleGridRect(), c0=r.c0, c1=r.c1, r0=r.r0, r1=r.r1;
      var k = ts + (GRID.spacing|0); // Schrittweite: Tilegröße + optionales Spacing
      if (k < 1) k = ts;             // Sicherheit

      var off = crispOffset(cam);
      var ox = ((GRID.offsetX|0) % k + k) % k;  // Offset sauber in Schrittweite normalisieren
      var oy = ((GRID.offsetY|0) % k + k) % k;

      ctx.save();
      ctx.globalAlpha = GRID.alpha;
      ctx.lineWidth = 1 / (cam && cam.z ? cam.z : 1);
      ctx.strokeStyle = GRID.color;

      // horizontale Linien
      var yStart = r0 * ts + oy + off;
      var yEndWorld = (r1+1) * ts + oy + off;
      var xLeft = c0 * ts + ox + off;
      var xRight = (c1+1) * ts + ox + off;

      var y;
      // Starte auf nächster Linie <= yStart, die zum Raster k passt
      var firstY = Math.floor(yStart / k) * k;
      for (y = firstY; y <= yEndWorld; y += k){
        ctx.beginPath(); ctx.moveTo(xLeft, y); ctx.lineTo(xRight, y); ctx.stroke();
      }

      // vertikale Linien
      var x;
      var xStart = c0 * ts + ox + off;
      var xEndWorld = (c1+1) * ts + ox + off;
      var firstX = Math.floor(xStart / k) * k;
      for (x = firstX; x <= xEndWorld; x += k){
        ctx.beginPath(); ctx.moveTo(x, r0 * ts + oy + off); ctx.lineTo(x, (r1+1) * ts + oy + off); ctx.stroke();
      }

      // (Optional) Achsen zeichnen – nur wenn Farben gesetzt
      if (GRID.axisX || GRID.axisY){
        // Weltursprung (0,0) – Kameraraum ist bereits angewandt
        if (GRID.axisX){
          ctx.strokeStyle = GRID.axisX;
          ctx.beginPath(); ctx.moveTo(xLeft, off); ctx.lineTo(xRight, off); ctx.stroke();
        }
        if (GRID.axisY){
          ctx.strokeStyle = GRID.axisY;
          ctx.beginPath(); ctx.moveTo(off, r0 * ts + oy + off); ctx.lineTo(off, (r1+1) * ts + oy + off); ctx.stroke();
        }
      }

      ctx.restore();
    }

    // ---- API an den Editor hängen ----
    editor.getGridStyle = getGridStyle;
    editor.setGridEnabled = setGridEnabled;
    editor.setGridStyle = setGridStyle;
    editor.getVisibleGridRect = getVisibleGridRect;
    editor.drawGrid = drawGrid;
  }
  window.EditorGrid = install;
})();
