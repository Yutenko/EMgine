// core-levels.js – Levels/Layers, Sichtbarkeit, get/setTile (ES5)
(function () {
  function install(editor) {
    var LAYERS = ["floor", "wall", "decor", "entities"];
    var LAYER_TINT = {
      floor: "#4FC3F7",
      wall: "#FF8A65",
      decor: "#BA68C8",
      entities: "#FFF176",
    };
    var world = editor.getWorld();

    var LEVELS = {
      unitHeight: 1,
      count: 10,
      current: 0,
      hoverLayer: null,
      show: { floor: true, wall: true, decor: true, entities: true },
      cols: world.cols | 0,
      rows: world.rows | 0,
      size: (world.cols | 0) * (world.rows | 0),
      data: [],
    };

    var lastLayerByLevel = [];
    var lastLayerGlobal = "floor";

    function ensureLayerMemorySize() {
      var next = new Array(LEVELS.count | 0);
      for (var i = 0; i < next.length; i++)
        next[i] = lastLayerByLevel[i] || null;
      lastLayerByLevel = next;
    }

    function pickLayerForLevel(levelIndex) {
      var cand = lastLayerByLevel[levelIndex];
      if (cand && LAYERS.indexOf(cand) !== -1) return cand;
      if (lastLayerGlobal && LAYERS.indexOf(lastLayerGlobal) !== -1)
        return lastLayerGlobal;
      return "floor";
    }

    function levelsInit() {
      LEVELS.data.length = 0;
      LEVELS.cols = editor.getWorld().cols | 0;
      LEVELS.rows = editor.getWorld().rows | 0;
      LEVELS.size = LEVELS.cols * LEVELS.rows;
      for (var l = 0; l < LEVELS.count; l++) {
        var lvl = {};
        for (var i = 0; i < LAYERS.length; i++)
          lvl[LAYERS[i]] = new Uint16Array(LEVELS.size);
        LEVELS.data.push(lvl);
      }
      lastLayerByLevel = new Array(LEVELS.count);
      ensureLayerMemorySize();
      if (!LEVELS.layer || LAYERS.indexOf(LEVELS.layer) === -1) {
        LEVELS.layer = "floor";
        lastLayerGlobal = "floor";
      }
      if (editor.clearHistory) editor.clearHistory();
      editor.emit("levels:init", {});
    }
    levelsInit();

    editor.on("world:resize", function () {
      var w = editor.getWorld();
      var cols = w.cols | 0,
        rows = w.rows | 0;
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
      if (editor.markAllLayerChunksDirty) editor.markAllLayerChunksDirty();
      if (editor.clearHistory) editor.clearHistory();
      editor.emit("levels:resize", { cols: cols, rows: rows });
    });

    function getLevelsCount() {
      return LEVELS.count | 0;
    }
    function getCurrentLevel() {
      return LEVELS.current | 0;
    }
    function setCurrentLevel(i) {
      i = Math.max(0, Math.min((LEVELS.count | 0) - 1, i | 0));
      if (i === LEVELS.current) return;
      LEVELS.current = i;
      var mem = pickLayerForLevel(i);
      LEVELS.layer = mem;
      if (editor.markAllLayerChunksDirty) editor.markAllLayerChunksDirty();
      editor.emit("level:changed", { level: i });
      editor.requestRender();
    }

    function getCurrentLayer() {
      return LEVELS.layer;
    }
    function setCurrentLayer(name) {
      if (name && LAYERS.indexOf(name) !== -1) {
        LEVELS.layer = name;
        lastLayerByLevel[LEVELS.current | 0] = name;
        lastLayerGlobal = name;
        if (editor.markAllLayerChunksDirty) editor.markAllLayerChunksDirty();
        editor.emit("layer:changed", { layer: name });
        editor.requestRender();
      }
    }

    function isLayerVisible(name) {
      return !!LEVELS.show[name];
    }
    function setLayerVisible(name, on) {
      LEVELS.show[name] = !!on;
      editor.requestRender();
    }

    function inWorldBounds(col, row) {
      return !(
        col < 0 ||
        row < 0 ||
        col >= (LEVELS.cols | 0) ||
        row >= (LEVELS.rows | 0)
      );
    }

    function levelTileIndex(col, row) {
      return row * (LEVELS.cols | 0) + col;
    }
    function getActiveBuffer() {
      return LEVELS.data[LEVELS.current | 0];
    }

    function colorForIdLayer(layer, id) {
      var base = LAYER_TINT[layer] || "#9E9E9E";
      function hexToRgb(h) {
        var s = h.charAt(0) === "#" ? h.substring(1) : h;
        var n = parseInt(s, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }
      function rgbToHex(r, g, b) {
        return (
          "#" +
          (((1 << 24) + ((r & 255) << 16) + ((g & 255) << 8) + (b & 255)) >>> 0)
            .toString(16)
            .slice(1)
            .toUpperCase()
        );
      }
      function varyById(tintHex, idv) {
        var rgb = hexToRgb(tintHex);
        var f = 0.85 + (((idv * 1103515245 + 12345) >>> 0) % 300) / 1000;
        var r = Math.max(0, Math.min(255, (rgb.r * f) | 0));
        var g = Math.max(0, Math.min(255, (rgb.g * f) | 0));
        var b = Math.max(0, Math.min(255, (rgb.b * f) | 0));
        return rgbToHex(r, g, b);
      }
      return varyById(base, id | 0);
    }

    function getTile(col, row) {
      col = col | 0;
      row = row | 0;
      if (!inWorldBounds(col, row)) return 0;
      var buf = getActiveBuffer()[LEVELS.layer];
      return buf[levelTileIndex(col, row)] | 0;
    }

    function setTileRaw(level, layer, col, row, id) {
      col = col | 0;
      row = row | 0;
      if (!inWorldBounds(col, row)) return;
      var buf = LEVELS.data[level | 0][layer];
      var idx = levelTileIndex(col, row);
      buf[idx] = id | 0;

      // Underlay-Caches für *jedes* Level invalidieren
      if (editor.markLevelLayerChunkDirty) {
        editor.markLevelLayerChunkDirty(level | 0, layer, col, row);
      }

      // Sichtbare Layer-Chunks nur, wenn aktueller Level
      if ((level | 0) === (LEVELS.current | 0)) {
        if (editor.markLayerChunkDirtyAt)
          editor.markLayerChunkDirtyAt(layer, col, row);
      }
    }

    function setTile(col, row, id) {
      col = col | 0;
      row = row | 0;
      id = id | 0;
      if (!inWorldBounds(col, row)) return false;
      if (!LEVELS.show[LEVELS.layer]) return false;
      var prev = getTile(col, row);
      if (id === prev) return false;
      if (editor.pushAction) {
        editor.pushAction({
          type: "setTiles",
          changes: [
            {
              level: LEVELS.current | 0,
              layer: LEVELS.layer,
              col: col,
              row: row,
              prev: prev | 0,
              next: id | 0,
            },
          ],
        });
      }
      setTileRaw(LEVELS.current | 0, LEVELS.layer, col, row, id);
      editor.emit("tiles:changed", {
        col: col,
        row: row,
        layer: LEVELS.layer,
        level: LEVELS.current | 0,
      });
      editor.requestRender();
      return true;
    }

    function setHoverLayer(name) {
      LEVELS.hoverLayer = name || null;
      editor.requestRender();
    }

    editor.getLevelsCount = getLevelsCount;
    editor.getCurrentLevel = getCurrentLevel;
    editor.setCurrentLevel = setCurrentLevel;
    editor.getCurrentLayer = getCurrentLayer;
    editor.setCurrentLayer = setCurrentLayer;
    editor.isLayerVisible = isLayerVisible;
    editor.setLayerVisible = setLayerVisible;
    editor.getTile = getTile;
    editor.setTile = setTile;
    editor.setTileRaw = setTileRaw;
    editor.setHoverLayer = setHoverLayer;
    editor.levelsState = LEVELS;
    editor.colorForIdLayer = colorForIdLayer;
  }
  window.EditorLevels = install;
})();
