/* ===========================================================
 * core-export.js  (ES5, UI-agnostisch)
 *
 * Map-Export/Import abgestimmt auf:
 * - editor.levelsState.{cols,rows,current,show,data}
 * - Tile-Daten liegen in: levelsState.data[levelIndex][layerName] (Array/TypedArray)
 *
 * Export:
 * {
 *   meta: {...},
 *   sections: {
 *     world:  { tileSize, cols, rows, levels },
 *     levels: [ { id, name?, z?, visible? }, ... ]   // generisch, falls vorhanden
 *     tiles:  {
 *       cols, rows,
 *       layers: ["floor","wall","deco", ...],
 *       levels: [
 *         { level: 0, layers: { floor:[...], wall:[...], deco:[...] } },
 *         ...
 *       ]
 *     },
 *     things: {...},   // ECS (falls vorhanden)
 *     keymap: {...}    // Keybinds (falls vorhanden)
 *   }
 * }
 *
 * Hinweise:
 * - Export konvertiert TypedArrays → normale Arrays (JSON-freundlich).
 * - Import schreibt Arrays 1:1 nach levelsState zurück (Plain Arrays sind ok).
 * - Keine Kopplung an den Chunk-Cache; Chunks sind reine Render-Caches.
 * =========================================================== */
(function (global) {
  function isTypedArray(a) {
    return a && (
      a instanceof Int8Array ||
      a instanceof Uint8Array ||
      a instanceof Uint8ClampedArray ||
      a instanceof Int16Array ||
      a instanceof Uint16Array ||
      a instanceof Int32Array ||
      a instanceof Uint32Array ||
      a instanceof Float32Array ||
      a instanceof Float64Array
    );
  }
  function toPlainArray(a) {
    if (!a) return a;
    if (isTypedArray(a)) return Array.prototype.slice.call(a);
    if (Array.isArray(a)) return a.slice();
    return a;
  }
  function tryCall(obj, names, args) {
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (obj && typeof obj[n] === "function") {
        try { return obj[n].apply(obj, args || []); } catch (e) {}
      }
    }
    return undefined;
  }

  function EditorExportPlugin(editor) {
    var exporters = {};
    editor.registerExporter = function (section, handler) {
      if (!section || !handler) return;
      exporters[section] = handler;
    };

    editor.exportMap = function (options) {
      options = options || {};
      var map = {
        meta: {
          format: "EMgine-Map",
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          app: "Editor Core"
        },
        sections: {}
      };
      for (var k in exporters) {
        if (!exporters.hasOwnProperty(k)) continue;
        var h = exporters[k];
        if (!h || typeof h.save !== "function") continue;
        try {
          var data = h.save(editor, options);
          if (data != null) map.sections[k] = data;
        } catch (e) {
          if (window && window.console && console.warn) {
            console.warn("Export-Fehler in Section '" + k + "':", e);
          }
        }
      }
      return options.stringify ? JSON.stringify(map) : map;
    };

    editor.importMap = function (map) {
      if (typeof map === "string") {
        try { map = JSON.parse(map); } catch (e) { return false; }
      }
      if (!map || !map.sections) return false;

      for (var k in map.sections) {
        if (!map.sections.hasOwnProperty(k)) continue;
        var h = exporters[k];
        if (h && typeof h.load === "function") {
          try {
            h.load(editor, map.sections[k]);
          } catch (e) {
            if (window && window.console && console.warn) {
              console.warn("Import-Fehler in Section '" + k + "':", e);
            }
          }
        }
      }
      return true;
    };

    /* ---------------- WORLD ---------------- */
    editor.registerExporter("world", {
      save: function (editor) {
        var w = editor.getWorld ? editor.getWorld() : editor.world;
        var L = editor.levelsState || {};
        if (!w && !L) return null;

        var tileSize = w ? (w.tileSize != null ? w.tileSize : tryCall(w, ["getTileSize"])) : editor.getTileSize && editor.getTileSize();
        var cols = w ? (w.cols != null ? w.cols : tryCall(w, ["getCols"])) : L.cols;
        var rows = w ? (w.rows != null ? w.rows : tryCall(w, ["getRows"])) : L.rows;
        var levels = (L && L.data && typeof L.data.length === "number") ? L.data.length : (w && w.levelCount != null ? w.levelCount : undefined);

        return { tileSize: tileSize|0, cols: cols|0, rows: rows|0, levels: levels|0 };
      },
      load: function (editor, data) {
        if (!data) return;
        var w = editor.getWorld ? editor.getWorld() : editor.world;
        if (!w) return;
        if (data.cols != null && data.rows != null) {
          if (typeof w.setSize === "function") w.setSize(data.cols|0, data.rows|0);
          else { w.cols = data.cols|0; w.rows = data.rows|0; }
        }
        if (data.tileSize != null) {
          if (typeof w.setTileSize === "function") w.setTileSize(data.tileSize|0);
          else w.tileSize = data.tileSize|0;
        }
        // Level-Anzahl verwaltet levels/import unten.
      }
    });

    /* ---------------- LEVELS (Meta) ---------------- */
    if (editor.levels) {
      editor.registerExporter("levels", {
        save: function (editor) {
          var s = tryCall(editor.levels, ["serialize"]);
          if (s != null) return s;

          // Fallback: minimal aus levelsState ableiten
          var L = editor.levelsState || {};
          var count = (L && L.data && L.data.length)|0;
          var out = [];
          for (var i = 0; i < count; i++) {
            out.push({ id: i, name: "Level " + i, z: i, visible: true });
          }
          return out;
        },
        load: function (editor, data) {
          if (!data) return;
          if (typeof editor.levels.deserialize === "function") { editor.levels.deserialize(data); return; }
          if (typeof editor.levels.load === "function") { editor.levels.load(data); return; }
          // andernfalls ignorieren (levelsState wird über tiles.load rekonstruiert)
        }
      });
    }

    /* ---------------- TILES aus levelsState ---------------- */
    editor.registerExporter("tiles", {
      save: function (editor) {
        var L = editor.levelsState;
        if (!L || !L.data || !L.data.length) return { cols: (L&&L.cols)|0, rows: (L&&L.rows)|0, layers: [], levels: [] };

        // Layer-Namen dynamisch aus dem ersten Level ableiten.
        var first = L.data[0] || {};
        var layerNames = [];
        for (var k in first) {
          if (!first.hasOwnProperty(k)) continue;
          // Wir nehmen nur numerische Arrays (Array oder TypedArray)
          var v = first[k];
          var isArr = Array.isArray(v) || isTypedArray(v);
          if (isArr) layerNames.push(k);
        }
        // Fallback falls leer: Standard-Layer
        if (!layerNames.length) layerNames = ["floor","wall","deco"];

        var outLevels = [];
        for (var li = 0; li < L.data.length; li++) {
          var byLayer = {};
          for (var j = 0; j < layerNames.length; j++) {
            var name = layerNames[j];
            var buf = (L.data[li] && L.data[li][name]) ? L.data[li][name] : null;
            if (buf != null) byLayer[name] = toPlainArray(buf);
          }
          outLevels.push({ level: li, layers: byLayer });
        }

        return {
          cols: L.cols|0,
          rows: L.rows|0,
          layers: layerNames.slice(),
          levels: outLevels
        };
      },

      load: function (editor, data) {
        if (!data) return;
        var L = editor.levelsState || (editor.levelsState = {});
        // Sicherstellen, dass Basisfelder existieren
        if (data.cols != null) L.cols = data.cols|0;
        if (data.rows != null) L.rows = data.rows|0;

        var layerNames = (data.layers && data.layers.length) ? data.layers.slice() : ["floor","wall","deco"];
        var levelCount = (data.levels && data.levels.length) ? data.levels.length : 0;

        // L.data neu aufbauen (ohne Chunks; Chunks sind Render-Cache und werden später invalidiert)
        L.data = new Array(levelCount);
        for (var i = 0; i < levelCount; i++) {
          var entry = data.levels[i] || {};
          var obj = {};
          for (var j = 0; j < layerNames.length; j++) {
            var lname = layerNames[j];
            var arr = entry.layers ? entry.layers[lname] : null;
            if (arr && Array.isArray(arr)) {
              obj[lname] = arr.slice(); // Plain Array reicht (core-chunks nutzt |0)
            } else {
              // Wenn Layer fehlt, initialisiere mit Nullen (optional)
              obj[lname] = new Array(L.cols * L.rows);
              for (var t = 0, n = obj[lname].length; t < n; t++) obj[lname][t] = 0;
            }
          }
          L.data[i] = obj;
        }

        // aktuellen Level clampen
        if (L.current == null) L.current = 0;
        if (L.current >= levelCount) L.current = levelCount - 1;

        // Sichtbarkeiten/L.show intakt lassen, ansonsten Standard auf true
        if (!L.show) {
          L.show = {};
          for (var s = 0; s < layerNames.length; s++) L.show[layerNames[s]] = true;
        }

        // Nach Import: Chunk-Cache invalidieren, damit alles neu aufgebaut wird
        if (typeof editor.markAllLayerChunksDirty === "function") editor.markAllLayerChunksDirty();
        editor.requestRender && editor.requestRender();
      }
    });

    /* ---------------- THINGS / ECS ---------------- */
    if (editor.ecs) {
      editor.registerExporter("things", {
        save: function (editor) {
          var s = tryCall(editor.ecs, ["serialize","save"]);
          if (s != null) return s;
          var entities = editor.ecs.entities || [];
          return { entities: entities };
        },
        load: function (editor, data) {
          if (!data) return;
          if (typeof editor.ecs.deserialize === "function") { editor.ecs.deserialize(data); return; }
          if (typeof editor.ecs.load === "function") { editor.ecs.load(data); return; }
          if (data.entities && typeof editor.ecs.addEntity === "function") {
            for (var i = 0; i < data.entities.length; i++) {
              try { editor.ecs.addEntity(data.entities[i]); } catch (e) {}
            }
          }
        }
      });
    }

    /* ---------------- KEYMAP ---------------- */
    if (editor.keybinds) {
      editor.registerExporter("keymap", {
        save: function (editor) {
          var s = tryCall(editor.keybinds, ["export","serialize"]);
          return (s != null) ? s : null;
        },
        load: function (editor, data) {
          if (!data) return;
          if (typeof editor.keybinds.import === "function") { editor.keybinds.import(data); return; }
          if (typeof editor.keybinds.deserialize === "function") { editor.keybinds.deserialize(data); }
        }
      });
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = EditorExportPlugin;
  } else {
    global.EditorExportPlugin = EditorExportPlugin;
  }
})(this);
