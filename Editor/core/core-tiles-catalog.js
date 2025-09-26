// core-tiles-catalog.js — FAST: build catalog without alpha scans (ES5)
(function(){
  function install(editor){
    var entries = []; // { id, tilesetId, type, atlasIndex, col, row, tileWidth, tileHeight, image }
    var idByKey = {}; // stable ids
    var nextId = 2;
    var brushId = 1;
    var brushPattern = null; // {w,h,ids}

    function keyForAtlas(tilesetId, idx){ return "a:"+tilesetId+":"+idx; }
    function keyForImage(tilesetId, idx){ return "i:"+tilesetId+":"+idx; }

    function rebuild(){
      var tsArr = editor.getTilesets ? editor.getTilesets() : [];
      var list = [];
      var i, t, idx, cols, rows, c, r, id, key, img, tw, th;
      for (i=0;i<tsArr.length;i++){
        t = tsArr[i];
        if (t.type === "atlas"){
          cols = Math.max(1, t.columns|0);
          rows = Math.max(1, t.rows|0);
          tw = t.tileWidth|0; th = t.tileHeight|0;
          for (r=0; r<rows; r++){
            for (c=0; c<cols; c++){
              idx = r*cols + c;
              key = keyForAtlas(t.id, idx);
              id = idByKey[key];
              if (!id){ id = nextId++; idByKey[key] = id; }
              list.push({
                id:id, tilesetId:t.id, type:"atlas", atlasIndex:idx,
                col:c, row:r, tileWidth:tw, tileHeight:th, image:t.image
              });
            }
          }
        } else if (t.type === "imageCollection"){
          for (idx=0; idx<(t.images?t.images.length:0); idx++){
            key = keyForImage(t.id, idx);
            id = idByKey[key];
            if (!id){ id = nextId++; idByKey[key] = id; }
            img = t.images[idx];
            list.push({
              id:id, tilesetId:t.id, type:"image", atlasIndex:idx,
              col:0, row:0, tileWidth: img ? (img.width|0) : 0, tileHeight: img ? (img.height|0) : 0, image:img
            });
          }
        }
      }
      entries = list;
      if (editor.emit) editor.emit("tiles:catalog:changed", { count: entries.length });
    }

    function getAllTiles(){ return entries.slice(); }
    function getTileById(id){
      var i; for (i=0;i<entries.length;i++) if (entries[i].id === (id|0)) return entries[i];
      return null;
    }

    function setBrushId(id){ brushId = id|0; brushPattern = null; if (editor.emit) editor.emit("brush:changed", { id:brushId }); }
    function getBrushId(){ return brushId|0; }
    function setBrushPattern(p){ brushPattern = p || null; if (editor.emit) editor.emit("brush:changed", { pattern: !!brushPattern }); }
    function getBrushPattern(){ return brushPattern; }

    // Layer filtering function - delegates to layer mapping system
    function getTilesForLayer(layer){
      if (editor.getTilesForLayer) {
        return editor.getTilesForLayer(layer);
      }
      // Fallback: return all tiles if no layer mapping system
      return getAllTiles();
    }

    rebuild();
    if (editor.on){
      editor.on("tilesets:changed", function(data) {
        console.log("Tilesets changed:", data.tilesets.length, "tilesets loaded");
        rebuild();
      });
    }

    // Debug: log when tiles are rebuilt
    var originalRebuild = rebuild;
    rebuild = function() {
      originalRebuild();
      console.log("Tile catalog rebuilt:", entries.length, "tiles available");
      if (entries.length > 0) {
        console.log("First few tiles:", entries.slice(0, 5).map(t => ({id: t.id, col: t.col, row: t.row, tilesetId: t.tilesetId})));
      }
    };

    editor.getAllTiles = getAllTiles;
    editor.getTileById = getTileById;
    editor.getTilesForLayer = getTilesForLayer;
    editor.setBrushId = setBrushId;
    editor.getBrushId = getBrushId;
    editor.setBrushPattern = setBrushPattern;
    editor.getBrushPattern = getBrushPattern;
  }
  window.EditorTilesCatalog = install;
})();