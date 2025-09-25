function Editor(canvas, opts) {
  // =========================
  // EMgine Editor – Lite v0.6.0
  // Canvas + DPR + Kamera + Grid
  // TileMap + Chunks (Offscreen) + Dirty-ROI
  // Undo/Redo (delta-basiert, mit Compound-Actions)
  // =========================

  // ---------- Options ----------
  opts = opts || {};

  // ---------- Context ----------
  var ctx = canvas.getContext("2d", { alpha: false });

  // ---------- Welt ----------
  var WORLD = {
    tileSize: opts.tileSize | 0 || 32,
    cols: opts.cols | 0 || 64,
    rows: opts.rows | 0 || 64,
  };
  WORLD.width = WORLD.cols * WORLD.tileSize;
  WORLD.height = WORLD.rows * WORLD.tileSize;

  // ---------- View / Gutters ----------
  var VIEW = { gutterTiles: opts.gutterTiles | 0 || 4 };
  function getGutterPx() {
    return (VIEW.gutterTiles | 0) * (WORLD.tileSize | 0);
  }

  // ---------- Kamera ----------
  var cam = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    z: 1,
    min: 0.25,
    max: 4,
  };
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function clampCamera() {
    var vw = canvas.clientWidth / cam.z,
      vh = canvas.clientHeight / cam.z;
    var hw = vw / 2,
      hh = vh / 2,
      G = getGutterPx();
    var minX = -G + hw,
      maxX = WORLD.width + G - hw;
    var minY = -G + hh,
      maxY = WORLD.height + G - hh;
    cam.x =
      vw >= WORLD.width + 2 * G ? WORLD.width / 2 : clamp(cam.x, minX, maxX);
    cam.y =
      vh >= WORLD.height + 2 * G ? WORLD.height / 2 : clamp(cam.y, minY, maxY);
  }

  // ===== Layer-Farben (Default) & Farb-Helfer =====
  var LAYER_TINT = {
    floor: "#4FC3F7", // blau
    wall: "#FF8A65", // orange
    decor: "#BA68C8", // lila
    entities: "#FFF176", // gelb
  };
  function hexToRgb(h) {
    var s = h.charAt(0) === "#" ? h.substring(1) : h;
    var n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    return (
      "#" +
      ((1 << 24) + ((r & 255) << 16) + ((g & 255) << 8) + (b & 255))
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  }
  function varyById(tintHex, id) {
    var rgb = hexToRgb(tintHex);
    var f = 0.85 + (((id * 1103515245 + 12345) >>> 0) % 300) / 1000; // 0.85..1.15
    var r = Math.max(0, Math.min(255, (rgb.r * f) | 0));
    var g = Math.max(0, Math.min(255, (rgb.g * f) | 0));
    var b = Math.max(0, Math.min(255, (rgb.b * f) | 0));
    return rgbToHex(r, g, b);
  }
  function colorForIdLayer(layer, id) {
    var base = LAYER_TINT[layer] || "#9E9E9E";
    return varyById(base, id | 0);
  }

  // Merker außerhalb der Funktion (einmalig im Modul):

  var lastLayerByLevel = lastLayerByLevel || [];
  var lastLayerGlobal = "floor"; // Start-Default
  function ensureLayerMemorySize() {
    var next = new Array(LEVELS.count | 0);
    for (var i = 0; i < next.length; i++) next[i] = lastLayerByLevel[i] || null;
    lastLayerByLevel = next;
  }
  function pickLayerForLevel(levelIndex) {
    var cand = lastLayerByLevel[levelIndex];
    if (cand && LAYERS.indexOf(cand) !== -1) return cand;
    if (lastLayerGlobal && LAYERS.indexOf(lastLayerGlobal) !== -1)
      return lastLayerGlobal;
    return "floor";
  }

  // ---------- Koordinaten ----------
  function screenToWorld(sx, sy) {
    return {
      x: (sx - canvas.clientWidth / 2) / cam.z + cam.x,
      y: (sy - canvas.clientHeight / 2) / cam.z + cam.y,
    };
  }
  function worldToScreen(wx, wy) {
    return {
      x: (wx - cam.x) * cam.z + canvas.clientWidth / 2,
      y: (wy - cam.y) * cam.z + canvas.clientHeight / 2,
    };
  }
  function inWorldBoundsColRow(col, row) {
    return col >= 0 && row >= 0 && col < WORLD.cols && row < WORLD.rows;
  }
  function worldToTile(wx, wy) {
    var col = (wx / WORLD.tileSize) | 0,
      row = (wy / WORLD.tileSize) | 0;
    if (!inWorldBoundsColRow(col, row)) return null;
    return { col: col, row: row };
  }
  function screenToTile(sx, sy) {
    var w = screenToWorld(sx, sy);
    return worldToTile(w.x, w.y);
  }
  function clientToTile(evt) {
    var r = canvas.getBoundingClientRect();
    return screenToTile(evt.clientX - r.left, evt.clientY - r.top);
  }

  // ---------- Kamera-Transform ----------
  function applyCamera() {
    ctx.translate(canvas.clientWidth / 2, canvas.clientHeight / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);
  }

  // ---------- DPR / Resize ----------
  var dpr = window.devicePixelRatio || 1;
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clampCamera();
    requestRender();
  }

  // ---------- Dirty-Loop ----------
  var needsRender = true;
  function requestRender() {
    needsRender = true;
  }
  function frame() {
    if (needsRender) {
      draw();
      needsRender = false;
    }
    requestAnimationFrame(frame);
  }

  // ---------- GRID ----------
  var GRID = {
    enabled: true,
    color: "#2f3340",
    axisX: "#4caf50",
    axisY: "#ff7043",
    bg: "#14171c",
  };
  function getVisibleGridRect() {
    var tl = screenToWorld(0, 0),
      br = screenToWorld(canvas.clientWidth, canvas.clientHeight);
    var c0 = Math.max(0, Math.floor(tl.x / WORLD.tileSize));
    var c1 = Math.min(WORLD.cols, Math.ceil(br.x / WORLD.tileSize));
    var r0 = Math.max(0, Math.floor(tl.y / WORLD.tileSize));
    var r1 = Math.min(WORLD.rows, Math.ceil(br.y / WORLD.tileSize));
    if (c1 < c0) c1 = c0;
    if (r1 < r0) r1 = r0;
    return { c0: c0, c1: c1, r0: r0, r1: r1 };
  }
  function getGridInfo() {
    var rect = getVisibleGridRect();
    var vc = Math.max(0, rect.c1 - rect.c0),
      vr = Math.max(0, rect.r1 - rect.r0);
    return {
      totalCols: WORLD.cols,
      totalRows: WORLD.rows,
      visibleCols: vc,
      visibleRows: vr,
      visibleCells: vc * vr,
      rect: rect,
    };
  }
  function setGridEnabled(on) {
    GRID.enabled = !!on;
    requestRender();
  }
  function setGridStyle(obj) {
    if (!obj) return;
    if (obj.color) GRID.color = obj.color;
    if (obj.axisX) GRID.axisX = obj.axisX;
    if (obj.axisY) GRID.axisY = obj.axisY;
    if (obj.bg) GRID.bg = obj.bg;
    requestRender();
  }
  function getGridStyle() {
    return {
      enabled: !!GRID.enabled,
      color: GRID.color,
      axisX: GRID.axisX,
      axisY: GRID.axisY,
      bg: GRID.bg,
    };
  }
  function drawGrid() {
    ctx.fillStyle = GRID.bg;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    var r = getVisibleGridRect(),
      c0 = r.c0,
      c1 = r.c1,
      r0 = r.r0,
      r1 = r.r1;
    ctx.lineWidth = 1 / cam.z;
    ctx.strokeStyle = GRID.color;
    var x, y, c, row;
    for (row = r0; row <= r1; row++) {
      y = row * WORLD.tileSize;
      ctx.beginPath();
      ctx.moveTo(c0 * WORLD.tileSize, y);
      ctx.lineTo(c1 * WORLD.tileSize, y);
      ctx.stroke();
    }
    for (c = c0; c <= c1; c++) {
      x = c * WORLD.tileSize;
      ctx.beginPath();
      ctx.moveTo(x, r0 * WORLD.tileSize);
      ctx.lineTo(x, r1 * WORLD.tileSize);
      ctx.stroke();
    }
  }

  // ---------- TILEMAP (legacy single) ----------
  var tiles = new Uint16Array(WORLD.cols * WORLD.rows);
  function tileIndex(col, row) {
    return row * WORLD.cols + col;
  }
  function getTile(col, row) {
    if (!inWorldBoundsColRow(col, row)) return 0;
    return tiles[tileIndex(col, row)] | 0;
  }

  // ===== Layers & Levels (ES5) =====
  var LAYERS = ["floor", "wall", "decor", "entities"];
  var LAYER_OPACITY = { floor: 1.0, wall: 1.0, decor: 1.0, entities: 1.0 };

  var UNDERLAY_SCALE = 0.65;

  var LEVELS = {
    unitHeight: 1,
    count: 10,
    current: 0,
    hoverLayer: null,
    show: { floor: true, wall: true, decor: true, entities: true },
    cols: WORLD.cols | 0,
    rows: WORLD.rows | 0,
    size: (WORLD.cols | 0) * (WORLD.rows | 0),
    data: [],
  };

  // ---------- Undo/Redo (vor levelsInit platzieren!) ----------
  var history = {
    undo: [],
    redo: [],
    limit: 200,
    compound: null, // {type:'compound',label,actions:[]}
  };

  function clearHistory() {
    history.undo.length = 0;
    history.redo.length = 0;
    history.compound = null;
  }
  function setUndoLimit(n) {
    history.limit = Math.max(1, n | 0);
    while (history.undo.length > history.limit) history.undo.shift();
    while (history.redo.length > history.limit) history.redo.shift();
  }
  function canUndo() {
    return history.undo.length > 0;
  }
  function canRedo() {
    return history.redo.length > 0;
  }
  function getUndoInfo() {
    return {
      undo: history.undo.length,
      redo: history.redo.length,
      limit: history.limit,
      inCompound: !!history.compound,
    };
  }
  function beginCompound(label) {
    if (history.compound) return false;
    history.compound = { type: "compound", label: label || "", actions: [] };
    return true;
  }
  function endCompound(cancel) {
    if (!history.compound) return false;
    var comp = history.compound;
    history.compound = null;
    if (cancel || !comp.actions.length) return false;
    history.undo.push(comp);
    if (history.undo.length > history.limit) history.undo.shift();
    history.redo.length = 0;
    return true;
  }
  function pushAction(act) {
    if (history.compound) {
      history.compound.actions.push(act);
    } else {
      history.undo.push(act);
      if (history.undo.length > history.limit) history.undo.shift();
      history.redo.length = 0;
    }
  }
  function applyChange(change, useNext) {
    var level = change.level | 0;
    var layer = change.layer;
    var col = change.col | 0;
    var row = change.row | 0;
    var id = useNext ? change.next : change.prev;
    setTileRaw(level, layer, col, row, id | 0);
  }
  function applyAction(act, direction /* 'undo' | 'redo' */) {
    if (!act) return;
    if (act.type === "setTiles") {
      var useNext = direction === "redo";
      // Bei Undo in umgekehrter Reihenfolge anwenden
      if (direction === "undo") {
        for (var i = act.changes.length - 1; i >= 0; i--)
          applyChange(act.changes[i], useNext);
      } else {
        for (var j = 0; j < act.changes.length; j++)
          applyChange(act.changes[j], useNext);
      }
    } else if (act.type === "compound" && act.actions && act.actions.length) {
      if (direction === "undo") {
        for (var k = act.actions.length - 1; k >= 0; k--)
          applyAction(act.actions[k], "undo");
      } else {
        for (var m = 0; m < act.actions.length; m++)
          applyAction(act.actions[m], "redo");
      }
    }
  }
  function undo() {
    if (!history.undo.length) return false;
    var act = history.undo.pop();
    applyAction(act, "undo");
    history.redo.push(act);
    if (history.redo.length > history.limit) history.redo.shift();
    requestRender();
    return true;
  }
  function redo() {
    if (!history.redo.length) return false;
    var act = history.redo.pop();
    applyAction(act, "redo");
    history.undo.push(act);
    if (history.undo.length > history.limit) history.undo.shift();
    requestRender();
    return true;
  }

  // ---------- Offscreen pro Layer/Chunk ----------
  var layerChunks = new Map();

  function levelsInit() {
    LEVELS.data.length = 0;
    LEVELS.cols = WORLD.cols | 0;
    LEVELS.rows = WORLD.rows | 0;
    LEVELS.size = LEVELS.cols * LEVELS.rows;
    for (var l = 0; l < LEVELS.count; l++) {
      var lvl = {};
      for (var i = 0; i < LAYERS.length; i++) {
        lvl[LAYERS[i]] = new Uint16Array(LEVELS.size);
      }
      LEVELS.data.push(lvl);
    }
    lastLayerByLevel = new Array(LEVELS.count); // Einträge bleiben zunächst undefined
    ensureLayerMemorySize();

    if (!LEVELS.layer || LAYERS.indexOf(LEVELS.layer) === -1) {
      LEVELS.layer = "floor";
      lastLayerGlobal = "floor";
    }

    // neue Map-Daten -> History leeren (neuer Zustand)
    clearHistory();
  }
  levelsInit();

  function levelsResize(cols, rows) {
    cols = cols | 0;
    rows = rows | 0;
    if (cols <= 0 || rows <= 0) return;
    if (cols === LEVELS.cols && rows === LEVELS.rows) return;
    var newSize = cols * rows;
    for (var l = 0; l < LEVELS.data.length; l++) {
      var lvl = LEVELS.data[l];
      for (var i = 0; i < LAYERS.length; i++) {
        var name = LAYERS[i];
        var old = lvl[name];
        var next = new Uint16Array(newSize);
        var copyCols = Math.min(LEVELS.cols, cols);
        var copyRows = Math.min(LEVELS.rows, rows);
        for (var r = 0; r < copyRows; r++) {
          var o = r * LEVELS.cols,
            n = r * cols;
          for (var c = 0; c < copyCols; c++) next[n + c] = old[o + c];
        }
        lvl[name] = next;
      }
    }
    LEVELS.cols = cols;
    LEVELS.rows = rows;
    LEVELS.size = newSize;
    layerChunks = new Map(); // Offscreen neu aufbauen
    levelLayerChunks = new Map(); // Unterlay-Cache ebenfalls resetten
    clearHistory(); // Strukturbruch -> History leeren
  }

  function levelTileIndex(col, row) {
    return row * LEVELS.cols + col;
  }
  function getActiveBuffer() {
    return LEVELS.data[LEVELS.current];
  }

  // ---------- CHUNKING + OFFSCREEN ----------
  var CHUNK_TILES = opts.chunkTiles | 0 || 32;
  var chunks = new Map(); // key -> chunk
  var chunksDirtyAll = true;
  var CHUNK_RING = opts.chunkAvgWindow | 0 || 60; // rolling window for avg per chunk

  function tileToChunk(col, row) {
    return { cx: (col / CHUNK_TILES) | 0, cy: (row / CHUNK_TILES) | 0 };
  }
  function chunkKey(cx, cy) {
    return cx + "," + cy;
  }

  function ensureChunk(cx, cy) {
    var key = chunkKey(cx, cy),
      ch = chunks.get(key);
    var pxSize = CHUNK_TILES * WORLD.tileSize;
    if (!ch) {
      var c =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(pxSize, pxSize)
          : (function () {
              var t = document.createElement("canvas");
              t.width = pxSize;
              t.height = pxSize;
              return t;
            })();
      var c2d = c.getContext("2d");
      ch = {
        canvas: c,
        ctx: c2d,
        cx: cx,
        cy: cy,
        dirty: true,
        rmin: null,
        rmax: null,
        cmin: null,
        cmax: null,
        stats: {
          ring: new Float32Array(CHUNK_RING),
          idx: 0,
          count: 0,
          sum: 0,
          lastMs: 0,
          avgMs: 0,
          lastTiles: 0,
          avgTiles: 0,
          tilesRing: new Uint32Array(CHUNK_RING),
          tilesSum: 0,
        },
      };
      chunks.set(key, ch);
    } else {
      if (ch.canvas.width !== pxSize || ch.canvas.height !== pxSize) {
        ch.canvas.width = pxSize;
        ch.canvas.height = pxSize;
        ch.dirty = true;
        ch.cmin = 0;
        ch.rmin = 0;
        ch.cmax = CHUNK_TILES - 1;
        ch.rmax = CHUNK_TILES - 1;
      }
    }
    return ch;
  }

  function layerChunkKey(cx, cy, layer) {
    return cx + "," + cy + "," + layer;
  }

  function ensureLayerChunk(cx, cy, layer) {
    var key = layerChunkKey(cx, cy, layer);
    var ch = layerChunks.get(key);
    if (ch) return ch;

    var pxSize = CHUNK_TILES * WORLD.tileSize;
    var c =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(pxSize, pxSize)
        : (function () {
            var t = document.createElement("canvas");
            t.width = pxSize;
            t.height = pxSize;
            return t;
          })();
    var c2d = c.getContext("2d");
    ch = {
      canvas: c,
      ctx: c2d,
      cx: cx,
      cy: cy,
      layer: layer,
      dirty: true,
      rmin: null,
      rmax: null,
      cmin: null,
      cmax: null,
    };
    layerChunks.set(key, ch);
    return ch;
  }

  // ===== Unterlay-Vorschau (darunterliegende Levels) =====
  var UNDERLAY_PREVIEW = {
    enabled: true,
    alpha: 0.25,
    depth: 1,
  };

  var levelLayerChunks = new Map();
  function levelLayerChunkKey(level, cx, cy, layer) {
    return level + "|" + cx + "," + cy + "," + layer;
  }
  function ensureLevelLayerChunk(level, cx, cy, layer) {
    var key = levelLayerChunkKey(level, cx, cy, layer);
    var ch = levelLayerChunks.get(key);
    if (ch) return ch;

    var pxSize = CHUNK_TILES * WORLD.tileSize;
    var c =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(pxSize, pxSize)
        : (function () {
            var t = document.createElement("canvas");
            t.width = pxSize;
            t.height = pxSize;
            return t;
          })();
    var c2d = c.getContext("2d");

    ch = {
      canvas: c,
      ctx: c2d,
      level: level,
      cx: cx,
      cy: cy,
      layer: layer,
      dirty: true,
      cmin: null,
      rmin: null,
      cmax: null,
      rmax: null,
    };
    levelLayerChunks.set(key, ch);
    return ch;
  }
  function markLevelLayerChunkDirty(level, layer, col, row) {
    var t = tileToChunk(col, row);
    var key = levelLayerChunkKey(level, t.cx, t.cy, layer);
    var ch = levelLayerChunks.get(key);
    if (!ch) return;
    ch.dirty = true;
    var lc = col - t.cx * CHUNK_TILES;
    var lr = row - t.cy * CHUNK_TILES;
    if (ch.cmin == null || lc < ch.cmin) ch.cmin = lc;
    if (ch.cmax == null || lc > ch.cmax) ch.cmax = lc;
    if (ch.rmin == null || lr < ch.rmin) ch.rmin = lr;
    if (ch.rmax == null || lr > ch.rmax) ch.rmax = lr;
  }
  function redrawLevelLayerChunk(level, cx, cy, layer, full) {
    var ch = ensureLevelLayerChunk(level, cx, cy, layer);
    var c2d = ch.ctx;
    var pxSize = CHUNK_TILES * WORLD.tileSize;

    var cmin = ch.cmin,
      cmax = ch.cmax,
      rmin = ch.rmin,
      rmax = ch.rmax;
    if (full || cmin == null) {
      c2d.clearRect(0, 0, pxSize, pxSize);
      cmin = 0;
      rmin = 0;
      cmax = CHUNK_TILES - 1;
      rmax = CHUNK_TILES - 1;
    } else {
      var rx = cmin * WORLD.tileSize,
        ry = rmin * WORLD.tileSize;
      var rw = (cmax - cmin + 1) * WORLD.tileSize,
        rh = (rmax - rmin + 1) * WORLD.tileSize;
      c2d.clearRect(rx, ry, rw, rh);
    }

    var startCol = cx * CHUNK_TILES;
    var startRow = cy * CHUNK_TILES;
    var endCol = Math.min(startCol + CHUNK_TILES - 1, WORLD.cols - 1);
    var endRow = Math.min(startRow + CHUNK_TILES - 1, WORLD.rows - 1);

    var lvl = LEVELS.data[level];
    var buf = lvl[layer];

    for (
      var row = Math.max(startRow, startRow + rmin);
      row <= endRow && row <= startRow + rmax;
      row++
    ) {
      for (
        var col = Math.max(startCol, startCol + cmin);
        col <= endCol && col <= startCol + cmax;
        col++
      ) {
        var id = buf[levelTileIndex(col, row)] | 0;
        if (!id) continue;
        var x = (col - startCol) * WORLD.tileSize;
        var y = (row - startRow) * WORLD.tileSize;
        c2d.fillStyle = colorForIdLayer(layer, id);
        c2d.fillRect(x, y, WORLD.tileSize, WORLD.tileSize);
      }
    }

    ch.dirty = false;
    ch.cmin = ch.rmin = ch.cmax = ch.rmax = null;
  }

  function markLayerChunkDirtyAt(layer, col, row) {
    var t = tileToChunk(col, row);
    var ch = ensureLayerChunk(t.cx, t.cy, layer);
    ch.dirty = true;
    var lc = col - t.cx * CHUNK_TILES;
    var lr = row - t.cy * CHUNK_TILES;
    if (ch.cmin == null || lc < ch.cmin) ch.cmin = lc;
    if (ch.cmax == null || lc > ch.cmax) ch.cmax = lc;
    if (ch.rmin == null || lr < ch.rmin) ch.rmin = lr;
    if (ch.rmax == null || lr > ch.rmax) ch.rmax = lr;
  }
  function markAllLayerChunksDirty() {
    layerChunks.forEach(function (ch) {
      ch.dirty = true;
      ch.cmin = ch.rmin = null;
      ch.cmax = ch.rmax = null;
    });
  }

  function chunkRingPush(ch, ms, tilesPainted) {
    var s = ch.stats;
    var i = s.idx,
      N = s.ring.length;

    var prevMs = s.ring[i];
    var prevTiles = s.tilesRing[i];

    if (s.count < N) {
      s.count++;
      s.sum += ms;
      s.tilesSum += tilesPainted;
    } else {
      s.sum += ms - prevMs;
      s.tilesSum += tilesPainted - prevTiles;
    }
    s.ring[i] = ms;
    s.tilesRing[i] = tilesPainted;
    s.idx = (i + 1) % N;

    s.lastMs = ms;
    s.avgMs = s.sum / s.count;
    s.lastTiles = tilesPainted;
    s.avgTiles = s.tilesSum / s.count;
  }

  function markChunkDirtyAt(col, row) {
    var t = tileToChunk(col, row);
    var ch = ensureChunk(t.cx, t.cy);
    ch.dirty = true;
    var lc = col - t.cx * CHUNK_TILES;
    var lr = row - t.cy * CHUNK_TILES;
    if (ch.cmin == null || lc < ch.cmin) ch.cmin = lc;
    if (ch.cmax == null || lc > ch.cmax) ch.cmax = lc;
    if (ch.rmin == null || lr < ch.rmin) ch.rmin = lr;
    if (ch.rmax == null || lr > ch.rmax) ch.rmax = lr;
  }
  function markAllChunksDirty() {
    chunksDirtyAll = true;
    chunks.forEach(function (ch) {
      ch.dirty = true;
      ch.cmin = 0;
      ch.rmin = 0;
      ch.cmax = CHUNK_TILES - 1;
      ch.rmax = CHUNK_TILES - 1;
    });
  }

  function getVisibleChunkRect() {
    var vis = getVisibleGridRect();
    var cx0 = (vis.c0 / CHUNK_TILES) | 0;
    var cx1 = (Math.max(vis.c1 - 1, vis.c0) / CHUNK_TILES) | 0;
    var cy0 = (vis.r0 / CHUNK_TILES) | 0;
    var cy1 = (Math.max(vis.r1 - 1, vis.r0) / CHUNK_TILES) | 0;
    var maxCx = ((WORLD.cols - 1) / CHUNK_TILES) | 0;
    var maxCy = ((WORLD.rows - 1) / CHUNK_TILES) | 0;
    cx0 = Math.max(0, Math.min(cx0, maxCx));
    cx1 = Math.max(0, Math.min(cx1, maxCx));
    cy0 = Math.max(0, Math.min(cy0, maxCy));
    cy1 = Math.max(0, Math.min(cy1, maxCy));
    return { cx0: cx0, cx1: cx1, cy0: cy0, cy1: cy1 };
  }

  var TILE_PALETTE = [
    "#90caf9",
    "#80cbc4",
    "#ffcc80",
    "#a5d6a7",
    "#f48fb1",
    "#ce93d8",
    "#b0bec5",
    "#ffab91",
    "#e6ee9c",
    "#ffccbc",
  ];
  function colorForId(id) {
    return id > 0 ? TILE_PALETTE[(id - 1) % TILE_PALETTE.length] : null;
  }

  function renderChunk(ch) {
    var c2d = ch.ctx;
    var pxSize = CHUNK_TILES * WORLD.tileSize;

    var cmin = ch.cmin,
      cmax = ch.cmax,
      rmin = ch.rmin,
      rmax = ch.rmax;
    var full = cmin == null || cmax == null || rmin == null || rmax == null;

    if (chunksDirtyAll || full) {
      c2d.clearRect(0, 0, pxSize, pxSize);
      cmin = 0;
      rmin = 0;
      cmax = CHUNK_TILES - 1;
      rmax = CHUNK_TILES - 1;
    } else {
      var rx = cmin * WORLD.tileSize,
        ry = rmin * WORLD.tileSize;
      var rw = (cmax - cmin + 1) * WORLD.tileSize,
        rh = (rmax - rmin + 1) * WORLD.tileSize;
      c2d.clearRect(rx, ry, rw, rh);
    }

    var startCol = ch.cx * CHUNK_TILES + cmin;
    var startRow = ch.cy * CHUNK_TILES + rmin;
    var endCol = Math.min(WORLD.cols, ch.cx * CHUNK_TILES + cmax + 1);
    var endRow = Math.min(WORLD.rows, ch.cy * CHUNK_TILES + rmax + 1);

    var tilesPainted = 0;

    for (var row = startRow; row < endRow; row++) {
      var runStart = -1,
        runColor = null;
      for (var col = startCol; col <= endCol; col++) {
        var id = col < endCol ? getTile(col, row) : 0;
        var clr = colorForId(id);

        if (clr) {
          if (runColor === clr) {
            // continue
          } else {
            if (runStart >= 0) {
              var dx = (runStart - ch.cx * CHUNK_TILES) * WORLD.tileSize;
              var dy = (row - ch.cy * CHUNK_TILES) * WORLD.tileSize;
              var wtiles = col - runStart;
              c2d.fillStyle = runColor;
              c2d.fillRect(dx, dy, wtiles * WORLD.tileSize, WORLD.tileSize);
              tilesPainted += wtiles;
            }
            runStart = col;
            runColor = clr;
          }
        } else if (runStart >= 0) {
          var dx2 = (runStart - ch.cx * CHUNK_TILES) * WORLD.tileSize;
          var dy2 = (row - ch.cy * CHUNK_TILES) * WORLD.tileSize;
          var wtiles2 = col - runStart;
          c2d.fillStyle = runColor;
          c2d.fillRect(dx2, dy2, wtiles2 * WORLD.tileSize, WORLD.tileSize);
          tilesPainted += wtiles2;
          runStart = -1;
          runColor = null;
        }
      }
    }

    ch.dirty = false;
    ch.cmin = ch.rmin = ch.cmax = ch.rmax = null;
    chunkRingPush(ch, 0, tilesPainted);
  }

  function renderDirtyChunks() {
    if (chunksDirtyAll) {
      chunks.forEach(function (ch) {
        ch.dirty = true;
        ch.cmin = 0;
        ch.rmin = 0;
        ch.cmax = CHUNK_TILES - 1;
        ch.rmax = CHUNK_TILES - 1;
      });
      chunksDirtyAll = false;
    }
    chunks.forEach(function (ch) {
      if (ch.dirty) renderChunk(ch);
    });
  }

  function redrawLayerChunk(cx, cy, layer, full) {
    var ch = ensureLayerChunk(cx, cy, layer);
    var c2d = ch.ctx;
    var pxSize = CHUNK_TILES * WORLD.tileSize;

    var cmin = ch.cmin,
      cmax = ch.cmax,
      rmin = ch.rmin,
      rmax = ch.rmax;
    if (full || cmin == null) {
      c2d.clearRect(0, 0, pxSize, pxSize);
      cmin = 0;
      rmin = 0;
      cmax = CHUNK_TILES - 1;
      rmax = CHUNK_TILES - 1;
    } else {
      var rx = cmin * WORLD.tileSize,
        ry = rmin * WORLD.tileSize;
      var rw = (cmax - cmin + 1) * WORLD.tileSize,
        rh = (rmax - rmin + 1) * WORLD.tileSize;
      c2d.clearRect(rx, ry, rw, rh);
    }

    var startCol = cx * CHUNK_TILES,
      startRow = cy * CHUNK_TILES;
    var endCol = Math.min(startCol + CHUNK_TILES - 1, WORLD.cols - 1);
    var endRow = Math.min(startRow + CHUNK_TILES - 1, WORLD.rows - 1);

    var lvl = LEVELS.data[LEVELS.current];
    var buf = lvl[layer];

    for (
      var row = Math.max(startRow, startRow + rmin);
      row <= endRow && row <= startRow + rmax;
      row++
    ) {
      for (
        var col = Math.max(startCol, startCol + cmin);
        col <= endCol && col <= startCol + cmax;
        col++
      ) {
        var id = buf[levelTileIndex(col, row)] | 0;
        if (!id) continue;
        var x = (col - startCol) * WORLD.tileSize;
        var y = (row - startRow) * WORLD.tileSize;
        c2d.fillStyle = colorForIdLayer(layer, id);
        c2d.fillRect(x, y, WORLD.tileSize, WORLD.tileSize);
      }
    }

    ch.dirty = false;
    ch.cmin = ch.rmin = null;
    ch.cmax = ch.rmax = null;
  }

  function drawDebugOverlay() {
    // optional: entfernt/auskommentiert, falls nicht benötigt
  }

  function compositeChunks() {
    var rect = getVisibleChunkRect();
    for (var cy = rect.cy0; cy <= rect.cy1; cy++) {
      for (var cx = rect.cx0; cx <= rect.cx1; cx++) {
        var sx = cx * CHUNK_TILES * WORLD.tileSize;
        var sy = cy * CHUNK_TILES * WORLD.tileSize;

        // Unterlay (Level darunter, alle Layer)
        if (UNDERLAY_PREVIEW.enabled && (LEVELS.current | 0) > 0) {
          var lower = (LEVELS.current | 0) - 1;
          if (LEVELS.data && LEVELS.data[lower]) {
            for (var ui = 0; ui < LAYERS.length; ui++) {
              var lnameU = LAYERS[ui];
              var llc = ensureLevelLayerChunk(lower, cx, cy, lnameU);
              if (llc.dirty)
                redrawLevelLayerChunk(lower, cx, cy, lnameU, false);

              ctx.save();
              var ua =
                UNDERLAY_PREVIEW.alpha != null ? UNDERLAY_PREVIEW.alpha : 0.25;
              ctx.globalAlpha = Math.max(0, Math.min(1, ua));
              ctx.drawImage(llc.canvas, sx, sy);
              ctx.restore();
            }
          }
        }

        // Aktueller Level – Offscreens aktualisieren
        for (var li = 0; li < LAYERS.length; li++) {
          var lname = LAYERS[li];
          if (!LEVELS.show[lname]) continue;
          var lch = ensureLayerChunk(cx, cy, lname);
          if (lch.dirty) redrawLayerChunk(cx, cy, lname, false);
        }

        // Zeichnen mit Hover-Alpha
        var isHover = !!LEVELS.hoverLayer;
        var hovered = LEVELS.hoverLayer;

        for (var li2 = 0; li2 < LAYERS.length; li2++) {
          var lname2 = LAYERS[li2];
          if (!LEVELS.show[lname2]) continue;
          var alpha = isHover ? (lname2 === hovered ? 1.0 : 0.25) : 1.0;
          if (LAYER_OPACITY[lname2] != null) alpha *= LAYER_OPACITY[lname2];
          if (alpha <= 0.01) continue;

          var lch2 = ensureLayerChunk(cx, cy, lname2);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.drawImage(lch2.canvas, sx, sy);
          ctx.restore();
        }
      }
    }
  }

  // ---------- Tile-API ----------
  function ensureLevelsReady() {
    if (!LEVELS) return false;
    if ((LEVELS.count | 0) <= 0) LEVELS.count = 1;
    if ((LEVELS.current | 0) < 0) LEVELS.current = 0;
    if ((LEVELS.current | 0) >= (LEVELS.count | 0))
      LEVELS.current = (LEVELS.count | 0) - 1;
    if (!LEVELS.layer || (LAYERS && LAYERS.indexOf(LEVELS.layer) === -1)) {
      LEVELS.layer = LAYERS && LAYERS.length ? LAYERS[0] : "floor";
    }
    if (!LEVELS.data || !LEVELS.data.length || !LEVELS.data[LEVELS.current]) {
      levelsInit();
    }
    if (
      (LEVELS.cols | 0) !== (WORLD.cols | 0) ||
      (LEVELS.rows | 0) !== (WORLD.rows | 0)
    ) {
      levelsResize(WORLD.cols | 0, WORLD.rows | 0);
    }
    if (!layerChunks || typeof layerChunks.forEach !== "function") {
      layerChunks = new Map();
    }
    return !!(
      LEVELS.data &&
      LEVELS.data.length &&
      LEVELS.data[LEVELS.current] &&
      LEVELS.data[LEVELS.current][LEVELS.layer]
    );
  }
  function getActiveBufferSafe() {
    if (!ensureLevelsReady()) return null;
    var lvl = LEVELS.data[LEVELS.current];
    var buf = lvl[LEVELS.layer];
    if (!buf || buf.length !== (LEVELS.cols | 0) * (LEVELS.rows | 0)) {
      levelsResize(WORLD.cols | 0, WORLD.rows | 0);
      lvl = LEVELS.data[LEVELS.current];
      buf = lvl[LEVELS.layer];
    }
    return buf || null;
  }

  // Roh-Schreibzugriff ohne History/Visibility-Check (für Undo/Redo)
  function setTileRaw(levelIndex, layerName, col, row, id) {
    if (LAYERS.indexOf(layerName) === -1) return false;
    if (levelIndex < 0 || levelIndex >= LEVELS.count) return false;
    if (!inWorldBoundsColRow(col, row)) return false;

    var lvl = LEVELS.data[levelIndex];
    var buf = lvl[layerName];
    var idx = row * (LEVELS.cols | 0) + col;
    var prev = buf[idx] | 0;
    var next = id | 0;
    if (prev === next) return false;

    buf[idx] = next;

    // Chunks dirty markieren (für das Level, in dem wir geschrieben haben)
    if (levelIndex === (LEVELS.current | 0)) {
      markLayerChunkDirtyAt(layerName, col, row);
    } else {
      // Unterlay wurde verändert -> seinen Cache invalidieren
      markLevelLayerChunkDirty(levelIndex, layerName, col, row);
    }
    requestRender();
    return true;
  }

  function setTile(col, row, id) {
    // nicht zeichnen, wenn aktueller Layer ausgeblendet ist
    if (!LEVELS.show[LEVELS.layer]) return false;
    if (!inWorldBoundsColRow(col, row)) return false;

    var lvl = LEVELS.current | 0;
    var layer = LEVELS.layer;
    var buf = getActiveBufferSafe();
    if (!buf) return false;

    var idx = row * (LEVELS.cols | 0) + col;
    var prev = buf[idx] | 0;
    var next = id | 0;
    if (prev === next) return false;

    // History-Eintrag pushen
    pushAction({
      type: "setTiles",
      changes: [
        {
          level: lvl,
          layer: layer,
          col: col,
          row: row,
          prev: prev,
          next: next,
        },
      ],
    });

    // Tatsächlich schreiben
    return setTileRaw(lvl, layer, col, row, next);
  }

  function clearTiles() {
    var buf = getActiveBufferSafe();
    if (!buf) return;
    var lvl = LEVELS.current | 0;
    var layer = LEVELS.layer;

    // sammle Deltas
    var changes = [];
    for (var i = 0; i < buf.length; i++) {
      var prev = buf[i] | 0;
      if (prev === 0) continue;
      var col = i % (LEVELS.cols | 0);
      var row = (i / (LEVELS.cols | 0)) | 0;
      changes.push({
        level: lvl,
        layer: layer,
        col: col,
        row: row,
        prev: prev,
        next: 0,
      });
    }
    if (changes.length) {
      pushAction({ type: "setTiles", changes: changes });
      for (var k = 0; k < changes.length; k++) {
        var chg = changes[k];
        setTileRaw(chg.level, chg.layer, chg.col, chg.row, chg.next);
      }
    }
  }

  function rebuildTileMap(newCols, newRows) {
    var old = tiles,
      oldCols = WORLD.cols,
      oldRows = WORLD.rows;
    var next = new Uint16Array(newCols * newRows);
    var copyCols = Math.min(oldCols, newCols),
      copyRows = Math.min(oldRows, newRows);
    for (var r = 0; r < copyRows; r++) {
      var o = r * oldCols,
        n = r * newCols;
      for (var c = 0; c < copyCols; c++) next[n + c] = old[o + c];
    }
    tiles = next;
  }

  // ---------- Draw ----------
  function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    applyCamera();

    var G = getGutterPx();
    ctx.fillStyle = GRID.bg;
    ctx.fillRect(-G, -G, WORLD.width + 2 * G, WORLD.height + 2 * G);

    if (GRID.enabled) drawGrid();
    compositeChunks();
    drawDebugOverlay();

    ctx.restore();
  }

  // ---------- Public API ----------
  function getCamera() {
    return { x: cam.x, y: cam.y, z: cam.z, min: cam.min, max: cam.max };
  }
  function setCamera(x, y, z) {
    if (typeof x === "number") cam.x = x;
    if (typeof y === "number") cam.y = y;
    if (typeof z === "number") cam.z = clamp(z, cam.min, cam.max);
    clampCamera();
    requestRender();
  }
  function setZoomLimits(minZ, maxZ) {
    cam.min = Math.max(0.01, minZ || cam.min);
    cam.max = Math.max(cam.min, maxZ || cam.max);
    cam.z = clamp(cam.z, cam.min, cam.max);
    clampCamera();
    requestRender();
  }
  function zoomTo(z) {
    setCamera(cam.x, cam.y, z);
  }
  function zoomBy(factor, sx, sy) {
    var before = null,
      after = null;
    if (typeof sx === "number" && typeof sy === "number")
      before = screenToWorld(sx, sy);
    cam.z = clamp(cam.z * (factor || 1), cam.min, cam.max);
    if (before) {
      after = screenToWorld(sx, sy);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
    }
    clampCamera();
    requestRender();
  }
  function centerOn(wx, wy) {
    cam.x = +wx;
    cam.y = +wy;
    clampCamera();
    requestRender();
  }

  function setWorld(cols, rows) {
    cols = cols | 0 || WORLD.cols;
    rows = rows | 0 || WORLD.rows;
    WORLD.cols = cols;
    WORLD.rows = rows;
    WORLD.width = WORLD.cols * WORLD.tileSize;
    WORLD.height = WORLD.rows * WORLD.tileSize;
    rebuildTileMap(WORLD.cols, WORLD.rows);
    levelsResize(WORLD.cols | 0, WORLD.rows | 0);
    markAllLayerChunksDirty();
    levelLayerChunks = new Map();

    chunks = new Map();
    chunksDirtyAll = true;
    clampCamera();
    requestRender();
  }
  function setTileSize(px) {
    WORLD.tileSize = Math.max(1, px | 0);
    WORLD.width = WORLD.cols * WORLD.tileSize;
    WORLD.height = WORLD.rows * WORLD.tileSize;
    chunks.forEach(function (ch) {
      var pxSize = CHUNK_TILES * WORLD.tileSize;
      ch.canvas.width = pxSize;
      ch.canvas.height = pxSize;
      ch.dirty = true;
      ch.cmin = 0;
      ch.rmin = 0;
      ch.cmax = CHUNK_TILES - 1;
      ch.rmax = CHUNK_TILES - 1;
    });
    chunksDirtyAll = true;
    layerChunks = new Map();
    levelLayerChunks = new Map();

    clampCamera();
    requestRender();
  }
  function getTileSize() {
    return WORLD.tileSize | 0;
  }
  function getWorld() {
    return {
      cols: WORLD.cols | 0,
      rows: WORLD.rows | 0,
      tileSize: WORLD.tileSize | 0,
      width: WORLD.width | 0,
      height: WORLD.height | 0,
    };
  }

  function getChunkTiles() {
    return CHUNK_TILES | 0;
  }
  function setChunkTiles(n) {
    var v = n | 0 || CHUNK_TILES;
    v = Math.max(4, Math.min(256, v));
    if (v === CHUNK_TILES) return false;
    CHUNK_TILES = v;
    chunks = new Map();
    chunksDirtyAll = true;
    requestRender();
    return true;
  }

  function screenToWorldAPI(sx, sy) {
    return screenToWorld(sx, sy);
  }
  function worldToScreenAPI(wx, wy) {
    return worldToScreen(wx, wy);
  }
  function redraw() {
    requestRender();
  }

  // Grid API
  function getGrid() {
    return getGridInfo();
  }
  function getGridStyleAPI() {
    return getGridStyle();
  }
  function setGridEnabledAPI(on) {
    setGridEnabled(on);
  }
  function setGridStyleAPI(obj) {
    setGridStyle(obj);
  }

  // Tile mapping
  function worldToTileAPI(wx, wy) {
    return worldToTile(wx, wy);
  }
  function screenToTileAPI(sx, sy) {
    return screenToTile(sx, sy);
  }
  function clientToTileAPI(evt) {
    return clientToTile(evt);
  }

  // View / Gutter
  function getViewGutterTiles() {
    return VIEW.gutterTiles | 0;
  }
  function setViewGutterTiles(n) {
    var v = n | 0;
    if (v < 0) v = 0;
    VIEW.gutterTiles = v;
    clampCamera();
    requestRender();
  }

  // ===== Public API: Levels/Layers =====
  function getLevelsCount() {
    return LEVELS.count | 0;
  }
  function setLevelsCount(n) {
    n = n | 0;
    if (n <= 0) n = 1;
    LEVELS.count = n;
    levelsInit();
    ensureLayerMemorySize();

    markAllLayerChunksDirty();
    requestRender();
  }
  function getCurrentLevel() {
    return LEVELS.current | 0;
  }
  function setCurrentLevel(i) {
    i = i | 0;
    if (i < 0) i = 0;
    if (i >= LEVELS.count) i = LEVELS.count - 1;
    if (i !== LEVELS.current) {
      LEVELS.current = i;

      // Ziel-Layer = zuletzt global genutzter Layer (falls gültig), sonst "floor"
      var target =
        lastLayerGlobal && LAYERS.indexOf(lastLayerGlobal) !== -1
          ? lastLayerGlobal
          : "floor";
      if (target !== LEVELS.layer) LEVELS.layer = target;

      markAllLayerChunksDirty();
      requestRender();
    }
  }

  function getCurrentLayer() {
    return LEVELS.layer;
  }
  function setCurrentLayer(name) {
    if (LAYERS.indexOf(name) === -1) return;
    if (name !== LEVELS.layer) {
      LEVELS.layer = name;
      lastLayerGlobal = name; // global merken
      markAllLayerChunksDirty();
      requestRender();
    }
  }

  function setLayerVisible(name, vis) {
    if (LAYERS.indexOf(name) === -1) return;
    LEVELS.show[name] = !!vis;
    requestRender();
  }
  function isLayerVisible(name) {
    if (LAYERS.indexOf(name) === -1) return false;
    return !!LEVELS.show[name];
  }
  function setHoverLayer(name) {
    LEVELS.hoverLayer = name && LAYERS.indexOf(name) !== -1 ? name : null;
    requestRender();
  }
  function getHoverLayer() {
    return LEVELS.hoverLayer;
  }
  function setUnderlayPreviewEnabled(on) {
    UNDERLAY_PREVIEW.enabled = !!on;
    requestRender();
  }
  function setUnderlayPreviewAlpha(a) {
    UNDERLAY_PREVIEW.alpha = Math.max(0, Math.min(1, +a || 0));
    requestRender();
  }
  function setUnderlayPreviewDepth(n) {
    UNDERLAY_PREVIEW.depth = Math.max(0, n | 0);
    requestRender();
  }

  // ---------- Init ----------
  function init() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    frame();
  }
  init();

  // ---------- Return API ----------
  return {
    // Kamera
    getCamera,
    setCamera,
    setZoomLimits,
    zoomTo,
    zoomBy,
    centerOn,
    // Welt / Tiles
    setWorld,
    getWorld,
    setTileSize,
    getTileSize,
    // Chunks
    getChunkTiles,
    setChunkTiles,
    // Koordinaten
    screenToWorld: screenToWorldAPI,
    worldToScreen: worldToScreenAPI,
    // Grid
    getGrid,
    getGridStyle: getGridStyleAPI,
    setGridEnabled: setGridEnabledAPI,
    setGridStyle: setGridStyleAPI,
    // Tile mapping
    worldToTile: worldToTileAPI,
    screenToTile: screenToTileAPI,
    clientToTile: clientToTileAPI,
    // TileMap
    getTile,
    setTile,
    clearTiles,
    // View / Gutter
    getViewGutterTiles,
    setViewGutterTiles,
    // Zeichensteuerung
    redraw,
    // Levels/Layers
    getLevelsCount: getLevelsCount,
    setLevelsCount: setLevelsCount,
    getCurrentLevel: getCurrentLevel,
    setCurrentLevel: setCurrentLevel,
    getCurrentLayer: getCurrentLayer,
    setCurrentLayer: setCurrentLayer,
    setLayerVisible: setLayerVisible,
    isLayerVisible: isLayerVisible,
    setHoverLayer: setHoverLayer,
    getHoverLayer: getHoverLayer,
    setUnderlayPreviewEnabled: setUnderlayPreviewEnabled,
    setUnderlayPreviewAlpha: setUnderlayPreviewAlpha,
    setUnderlayPreviewDepth: setUnderlayPreviewDepth,

    // Undo/Redo API
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    clearHistory: clearHistory,
    setUndoLimit: setUndoLimit,
    beginCompound: beginCompound,
    endCompound: endCompound,
    getUndoInfo: getUndoInfo,

    // intern nützlich
    ctxRef: ctx,
    applyCameraRef: applyCamera,
  };
}
