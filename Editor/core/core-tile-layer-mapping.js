// core-tile-layer-mapping.js — Layer-to-tileset mapping system (ES5, PlainJS)
(function(){
  function install(editor){
    // State: layer -> array of tile IDs
    var layerMappings = {
      floor: [],
      wall: [],
      decor: [],
      entities: []
    };

    // Storage key for persistence
    var STORAGE_KEY = "editor_layer_mappings";

    // Utility functions
    function emitChanged(){ if (editor.emit) editor.emit("layer:mapping:changed", { mappings: layerMappings }); }
    function loadFromStorage(){
      try {
        var stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          var parsed = JSON.parse(stored);
          // Merge with defaults to ensure all layers exist
          for (var layer in layerMappings) {
            if (parsed.hasOwnProperty(layer)) {
              layerMappings[layer] = Array.isArray(parsed[layer]) ? parsed[layer] : [];
            }
          }
        }
      } catch(e) {
        console.warn("Failed to load layer mappings from storage:", e);
      }
    }
    function saveToStorage(){
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layerMappings));
      } catch(e) {
        console.warn("Failed to save layer mappings to storage:", e);
      }
    }

    // Initialize from storage
    loadFromStorage();

    // Initialize with default layer mappings if empty
    function initializeDefaultMappings(){
      var hasAnyMappings = false;
      for (var layer in layerMappings) {
        if (layerMappings[layer].length > 0) {
          hasAnyMappings = true;
          break;
        }
      }

      if (!hasAnyMappings) {
        // Populate layers with all available tiles initially
        // This ensures the palette has tiles to show
        var allTiles = editor.getAllTiles ? editor.getAllTiles() : [];
        if (allTiles.length > 0) {
          var tileIds = allTiles.map(function(tile) { return tile.id; });

          // Distribute tiles across layers
          var tilesPerLayer = Math.ceil(tileIds.length / 4);
          layerMappings.floor = tileIds.slice(0, tilesPerLayer);
          layerMappings.wall = tileIds.slice(tilesPerLayer, tilesPerLayer * 2);
          layerMappings.decor = tileIds.slice(tilesPerLayer * 2, tilesPerLayer * 3);
          layerMappings.entities = tileIds.slice(tilesPerLayer * 3);
        } else {
          // Fallback: Add placeholder IDs that will be updated when tiles load
          var placeholderIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
          layerMappings.floor = placeholderIds.slice(0, 5);
          layerMappings.wall = placeholderIds.slice(5, 10);
          layerMappings.decor = placeholderIds.slice(10, 15);
          layerMappings.entities = placeholderIds.slice(15, 20);
        }
        saveToStorage();
        emitChanged();
      }
    }

    // Initialize default mappings after a short delay to allow tiles to load
    setTimeout(initializeDefaultMappings, 100);

    // Update layer mappings when tiles catalog changes
    if (editor.on) {
      editor.on("tiles:catalog:changed", function() {
        // Re-initialize mappings with actual tile IDs when tiles are loaded
        initializeDefaultMappings();
      });
    }

    // Public API functions
    function getLayerMappings(){ return JSON.parse(JSON.stringify(layerMappings)); }
    function getTilesForLayer(layer){
      if (!layerMappings.hasOwnProperty(layer)) return [];
      var tileIds = layerMappings[layer];
      var allTiles = editor.getAllTiles ? editor.getAllTiles() : [];
      return allTiles.filter(function(tile){
        return tileIds.indexOf(tile.id) !== -1;
      });
    }

    function addTileToLayer(tileId, layer){
      tileId = tileId | 0;
      if (!layerMappings.hasOwnProperty(layer)) return false;
      if (layerMappings[layer].indexOf(tileId) === -1) {
        layerMappings[layer].push(tileId);
        saveToStorage();
        emitChanged();
        return true;
      }
      return false;
    }

    function removeTileFromLayer(tileId, layer){
      tileId = tileId | 0;
      if (!layerMappings.hasOwnProperty(layer)) return false;
      var idx = layerMappings[layer].indexOf(tileId);
      if (idx !== -1) {
        layerMappings[layer].splice(idx, 1);
        saveToStorage();
        emitChanged();
        return true;
      }
      return false;
    }

    function setLayerTiles(layer, tileIds){
      if (!layerMappings.hasOwnProperty(layer)) return false;
      layerMappings[layer] = Array.isArray(tileIds) ? tileIds.map(function(id){ return id | 0; }) : [];
      saveToStorage();
      emitChanged();
      return true;
    }

    function clearLayer(layer){
      if (!layerMappings.hasOwnProperty(layer)) return false;
      layerMappings[layer] = [];
      saveToStorage();
      emitChanged();
      return true;
    }

    function getAvailableLayers(){ return Object.keys(layerMappings); }
    function isTileInLayer(tileId, layer){
      tileId = tileId | 0;
      if (!layerMappings.hasOwnProperty(layer)) return false;
      return layerMappings[layer].indexOf(tileId) !== -1;
    }

    // Export functions to editor
    editor.getLayerMappings = getLayerMappings;
    editor.getTilesForLayer = getTilesForLayer;
    editor.addTileToLayer = addTileToLayer;
    editor.removeTileFromLayer = removeTileFromLayer;
    editor.setLayerTiles = setLayerTiles;
    editor.clearLayer = clearLayer;
    editor.getAvailableLayers = getAvailableLayers;
    editor.isTileInLayer = isTileInLayer;
  }
  window.EditorTileLayerMapping = install;
})();