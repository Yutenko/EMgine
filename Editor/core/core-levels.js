// core-levels.js – Levels/Layers + Tiles (History/Chunks integriert)
// Usage:
//   editor.use(EditorLevels);
//   editor.setCurrentLevel(1); editor.setCurrentLayer("tiles");
//   const id = editor.getTile(c,r); editor.setTile(c,r,newId); // pusht History + invalidiert Chunks
//   // Raw (für Undo/Redo/Import):
//   editor.setTileRaw(level, layer, c, r, id); // ohne History, invalidiert Caches
// API:
//   State: editor.levelsState, colorForIdLayer(layer,id)
//   Levels/Layers: getLevelsCount(), getCurrentLevel(), setCurrentLevel(i),
//                  getCurrentLayer(), setCurrentLayer(name),
//                  isLayerVisible(name), setLayerVisible(name,on)
//   Tiles: getTile(c,r), setTile(c,r,id), setTileRaw(level,layer,c,r,id)
// Events:
//   "level:changed", "layer:changed", "levels:resize", "tiles:changed"
// Notes:
//   world:resize kopiert Layerdaten auf neue Größe; History wird (falls vorhanden) geleert. 
//   setTileRaw() markiert Underlay- und (bei aktuellem Level) Layer-Chunks dirty. 


(function () {
  function install(editor) {
    // ---------- Konfiguration ----------
    // Falls nichts übergeben wird, greifen diese Defaults:
    var LAYERS = (editor.opts && editor.opts.tileLayers) || [
      "floor",
      "wall",
      "decor",
      "entities",
    ];
    var LAYER_TINT = (editor.opts && editor.opts.layerTints) || {
      floor: "#4FC3F7",
      wall: "#FF8A65",
      decor: "#BA68C8",
      entities: "#FFF176",
    };

    function defaultLayerName() {
      if (
        editor.opts &&
        editor.opts.defaultLayer &&
        LAYERS.indexOf(editor.opts.defaultLayer) !== -1
      ) {
        return editor.opts.defaultLayer;
      }
      return LAYERS.length ? LAYERS[0] : "floor";
    }

    // ---------- State ----------
    var world = editor.getWorld();
    var LEVELS = {
      unitHeight: 1,
      count: 10,
      current: 0,
      layer: defaultLayerName(), // aktuell aktiver Layer-Name
      hoverLayer: null, // UI-Hover (optional)
      show: (function () {
        // Sichtbarkeit je Layer
        var o = {};
        for (var i = 0; i < LAYERS.length; i++) o[LAYERS[i]] = true;
        return o;
      })(),
      cols: world.cols | 0,
      rows: world.rows | 0,
      size: (world.cols | 0) * (world.rows | 0),
      data: [], // Array pro Level: { [layerName]: Uint16Array(size) }
    };

    // "Letzten Layer pro Level" & global merken
    var lastLayerByLevel = [];
    var lastLayerGlobal = LEVELS.layer;

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
      return defaultLayerName();
    }

    // ---------- Initialisierung ----------
    function levelsInit() {
      LEVELS.data.length = 0;
      LEVELS.cols = editor.getWorld().cols | 0;
      LEVELS.rows = editor.getWorld().rows | 0;
      LEVELS.size = LEVELS.cols * LEVELS.rows;

      for (var l = 0; l < LEVELS.count; l++) {
        var lvl = {};
        for (var i = 0; i < LAYERS.length; i++) {
          lvl[LAYERS[i]] = new Uint16Array(LEVELS.size);
        }
        LEVELS.data.push(lvl);
      }

      lastLayerByLevel = new Array(LEVELS.count);
      ensureLayerMemorySize();

      // Layer-Startzustand absichern
      if (!LEVELS.layer || LAYERS.indexOf(LEVELS.layer) === -1) {
        LEVELS.layer = defaultLayerName();
        lastLayerGlobal = LEVELS.layer;
      }

      if (editor.clearHistory) editor.clearHistory();
      editor.emit("levels:init", {});
    }
    levelsInit();

    // ---------- Reaktion auf Welt-Resize ----------
    editor.on &&
      editor.on("world:resize", function () {
        var w = editor.getWorld();
        if ((w.cols | 0) === LEVELS.cols && (w.rows | 0) === LEVELS.rows)
          return;

        var newCols = w.cols | 0,
          newRows = w.rows | 0,
          newSize = newCols * newRows;
        var newData = [];

        for (var l = 0; l < LEVELS.count; l++) {
          var lvlOld = LEVELS.data[l];
          var lvlNew = {};
          for (var i = 0; i < LAYERS.length; i++) {
            var layerName = LAYERS[i];
            var arrNew = new Uint16Array(newSize);
            // so viel wie möglich rüberkopieren (Top-Left konservativ)
            var minCols = Math.min(LEVELS.cols, newCols);
            var minRows = Math.min(LEVELS.rows, newRows);
            var arrOld = lvlOld ? lvlOld[layerName] : null;
            if (arrOld) {
              for (var r = 0; r < minRows; r++) {
                var offOld = r * LEVELS.cols;
                var offNew = r * newCols;
                for (var c = 0; c < minCols; c++) {
                  arrNew[offNew + c] = arrOld[offOld + c];
                }
              }
            }
            lvlNew[layerName] = arrNew;
          }
          newData.push(lvlNew);
        }

        LEVELS.cols = newCols;
        LEVELS.rows = newRows;
        LEVELS.size = newSize;
        LEVELS.data = newData;

        if (editor.clearHistory) editor.clearHistory();
        editor.emit("levels:resize", { cols: newCols, rows: newRows });
        editor.requestRender && editor.requestRender();
      });

    // ---------- Utilities ----------
    function inBounds(col, row) {
      return col >= 0 && row >= 0 && col < LEVELS.cols && row < LEVELS.rows;
    }
    function idx(col, row) {
      return (row | 0) * LEVELS.cols + (col | 0);
    }

    // ---------- Sichtbarkeit ----------
    function isLayerVisible(layerName) {
      return !!LEVELS.show[layerName];
    }
    function setLayerVisible(layerName, visible) {
      if (LAYERS.indexOf(layerName) === -1) return;
      LEVELS.show[layerName] = !!visible;
      editor.emit &&
        editor.emit("layers:visibility", {
          layer: layerName,
          visible: !!visible,
        });
      editor.requestRender && editor.requestRender();
    }

    // ---------- Current Level / Layer ----------
    function getLevelsCount() {
      return LEVELS.count | 0;
    }
    function getCurrentLevel() {
      return LEVELS.current | 0;
    }
    function setCurrentLevel(i) {
      i = i | 0;
      if (i < 0) i = 0;
      if (i >= LEVELS.count) i = LEVELS.count - 1;
      if (i === LEVELS.current) return;
      // vor Wechsel: aktiven Layer pro Level merken
      lastLayerByLevel[LEVELS.current] = LEVELS.layer;
      LEVELS.current = i;
      // beim Betreten: passenden Layer herstellen
      var next = pickLayerForLevel(i);
      if (next !== LEVELS.layer) {
        LEVELS.layer = next;
        editor.emit &&
          editor.emit("levels:currentLayer", { layer: LEVELS.layer });
      }
      editor.emit &&
        editor.emit("levels:currentLevel", { level: LEVELS.current });
      editor.requestRender && editor.requestRender();
    }

    function getCurrentLayer() {
      return LEVELS.layer;
    }
    function setCurrentLayer(name) {
      if (LAYERS.indexOf(name) === -1) return;
      if (name === LEVELS.layer) return;
      LEVELS.layer = name;
      lastLayerGlobal = name;
      lastLayerByLevel[LEVELS.current] = name;
      editor.emit && editor.emit("levels:currentLayer", { layer: name });
      editor.requestRender && editor.requestRender();
    }

    function setHoverLayer(name) {
      LEVELS.hoverLayer = LAYERS.indexOf(name) !== -1 ? name : null;
      editor.emit &&
        editor.emit("levels:hoverLayer", { layer: LEVELS.hoverLayer });
      editor.requestRender && editor.requestRender();
    }

    // ---------- Tiles lesen/schreiben ----------
    function getTile(level, layerName, col, row) {
      level = level == null ? LEVELS.current : level | 0;
      if (layerName == null) layerName = LEVELS.layer;
      if (level < 0 || level >= LEVELS.count) return 0;
      if (LAYERS.indexOf(layerName) === -1) return 0;
      if (!inBounds(col | 0, row | 0)) return 0;
      var a = LEVELS.data[level][layerName];
      return a[idx(col, row)] | 0;
    }

    function setTileRaw(level, layerName, col, row, id) {
      level = level | 0;
      col = col | 0;
      row = row | 0;
      id = id | 0;
      if (level < 0 || level >= LEVELS.count) return false;
      if (LAYERS.indexOf(layerName) === -1) return false;
      if (!inBounds(col, row)) return false;
      var arr = LEVELS.data[level][layerName];
      arr[idx(col, row)] = id;
      // Chunks/Underlay über Dirtiness informieren (falls vorhanden)
      if (typeof editor.markLayerChunkDirtyAt === "function") {
        editor.markLayerChunkDirtyAt(layerName, col, row);
      }
      return true;
    }

    function setTile(level, layerName, col, row, id) {
      // Überladungen unterstützen:
      // setTile(col,row,id) -> aktueller Level & Layer
      // setTile(layer,col,row,id) -> aktueller Level
      // setTile(level,layer,col,row,id) -> vollständig
      var _level, _layer, _col, _row, _id;

      if (
        id == null &&
        row != null &&
        typeof layerName === "string" &&
        typeof level !== "number"
      ) {
        // (layer,col,row,id)
        _level = LEVELS.current;
        _layer = level;
        _col = layerName | 0;
        _row = col | 0;
        _id = row | 0;
      } else if (id == null && row == null) {
        // (col,row,id)
        _level = LEVELS.current;
        _layer = LEVELS.layer;
        _col = level | 0;
        _row = layerName | 0;
        _id = col | 0;
      } else {
        // (level,layer,col,row,id)
        _level = level | 0;
        _layer = layerName;
        _col = col | 0;
        _row = row | 0;
        _id = id | 0;
      }

      var prev = getTile(_level, _layer, _col, _row) | 0;
      if (prev === _id) return true;

      var ok = setTileRaw(_level, _layer, _col, _row, _id);
      if (!ok) return false;

      // History eintragen (falls Plugin vorhanden)
      if (typeof editor.pushAction === "function") {
        editor.pushAction({
          type: "tile",
          level: _level,
          layer: _layer,
          col: _col,
          row: _row,
          prev: prev,
          next: _id,
        });
      }

      // Event für sonstige Listener (z.B. Inspector, Minimap)
      editor.emit &&
        editor.emit("tile:changed", {
          level: _level,
          layer: _layer,
          col: _col,
          row: _row,
          prev: prev,
          next: _id,
        });

      editor.requestRender && editor.requestRender();
      return true;
    }

    // ---------- Farbe aus Layer-Tint ableiten (für Debug/Fallback) ----------
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

    // ---------- Laufzeit-Konfiguration ----------
    function configureTileLayers(cfg) {
      cfg = cfg || {};

      // Layerliste/Tints anpassen
      if (cfg.layers && cfg.layers.length) LAYERS = cfg.layers.slice(0);
      if (cfg.tints) LAYER_TINT = cfg.tints;
      if (cfg.defaultLayer) editor.opts.defaultLayer = cfg.defaultLayer;

      // Sichtbarkeiten neu aufbauen (Standard = true)
      LEVELS.show = {};
      for (var i = 0; i < LAYERS.length; i++) LEVELS.show[LAYERS[i]] = true;

      // Leveldaten mit neuer Layerliste neu initialisieren
      levelsInit();

      // Aktuellen Layer sicherstellen
      if (LAYERS.indexOf(LEVELS.layer) === -1) {
        LEVELS.layer = defaultLayerName();
      }

      editor.emit &&
        editor.emit("layers:reconfigured", { layers: LAYERS.slice(0) });
      editor.requestRender && editor.requestRender();
    }
    function getTileLayers() {
      return LAYERS.slice(0);
    }

    // ---------- API exportieren ----------
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

    // NEU:
    editor.configureTileLayers = configureTileLayers;
    editor.getTileLayers = getTileLayers;
  }
  window.EditorLevels = install;
})();
