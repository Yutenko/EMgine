// core-assetpool.js — Assign tilesets to logical layers (floor, wall, decor, entities)
(function(){
  function install(editor){
    var LAYERS = ["floor","wall","decor","entities"];
    var pool = { floor:[], wall:[], decor:[], entities:[] }; // arrays of tilesetId
    var allTilesCache = null;

    function setAllowedTilesets(layer, ids){
      if (LAYERS.indexOf(layer)===-1) return false;
      var list = [];
      var i;
      for (i=0;i<ids.length;i++) if (typeof ids[i]==="number") list.push(ids[i]|0);
      pool[layer] = list;
      if (editor.emit) editor.emit("assetpool:changed", { layer:layer, ids:list.slice() });
      return true;
    }
    function addAllowedTileset(layer, id){
      if (LAYERS.indexOf(layer)===-1) return false;
      id = id|0;
      var a = pool[layer]; var i;
      for (i=0;i<a.length;i++) if (a[i]===id) return false;
      a.push(id);
      if (editor.emit) editor.emit("assetpool:changed", { layer:layer, ids:a.slice() });
      return true;
    }
    function removeAllowedTileset(layer, id){
      if (LAYERS.indexOf(layer)===-1) return false;
      id = id|0;
      var a = pool[layer]; var i;
      for (i=0;i<a.length;i++) if (a[i]===id){ a.splice(i,1); if (editor.emit) editor.emit("assetpool:changed",{layer:layer,ids:a.slice()}); return true; }
      return false;
    }
    function getAllowedTilesets(layer){
      if (LAYERS.indexOf(layer)===-1) return [];
      return pool[layer].slice();
    }

    function getTilesForLayer(layer){
      // if no assignment -> all tiles
      var tsIds = getAllowedTilesets(layer);
      var tiles = editor.getAllTiles ? editor.getAllTiles() : [];
      if (!tsIds || !tsIds.length) return tiles;
      var out = []; var i;
      for (i=0;i<tiles.length;i++){
        if (indexOf(tsIds, tiles[i].tilesetId)!==-1) out.push(tiles[i]);
      }
      return out;
    }
    function indexOf(a,v){ var i; for (i=0;i<a.length;i++) if (a[i]===v) return i; return -1; }

    // expose
    editor.setAllowedTilesets = setAllowedTilesets;
    editor.addAllowedTileset = addAllowedTileset;
    editor.removeAllowedTileset = removeAllowedTileset;
    editor.getAllowedTilesets = getAllowedTilesets;
    editor.getTilesForLayer = getTilesForLayer;
  }
  window.EditorAssetPool = install;
})();