// core-loader.js - JSON map data loading and parsing
(function () {
  function install(renderer) {
    var mapData = null;
    var tilesets = [];
    var tileCatalog = [];
    var levels = [];

    function loadMapData(jsonData) {
      if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('Invalid map data format');
      }

      // Store raw data
      mapData = jsonData;
      tilesets = jsonData.tilesets || [];
      tileCatalog = jsonData.tileCatalog || [];
      levels = jsonData.levels || [];

      // Update world size based on loaded data
      var metadata = jsonData.metadata;
      if (metadata && metadata.world) {
        var world = metadata.world;
        renderer.setWorldSize(world.cols, world.rows, levels.length);
      }

      // Create tile lookup map for faster access
      createTileLookupMap();

      renderer.emit("map:loaded", {
        data: jsonData,
        tilesets: tilesets,
        tileCatalog: tileCatalog,
        levels: levels,
        metadata: metadata
      });

      renderer.requestRender();
      return jsonData;
    }

    function loadMapFile(file) {
      return new Promise(function(resolve, reject) {
        if (!file) {
          reject(new Error('No file provided'));
          return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var jsonData = JSON.parse(e.target.result);
            var result = loadMapData(jsonData);
            resolve(result);
          } catch (error) {
            reject(new Error('Failed to parse JSON file: ' + error.message));
          }
        };
        reader.onerror = function() {
          reject(new Error('Failed to read file'));
        };
        reader.readAsText(file);
      });
    }

    function loadMapFromUrl(url) {
      return fetch(url)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to fetch map data from URL');
          }
          return response.json();
        })
        .then(function(jsonData) {
          return loadMapData(jsonData);
        })
        .catch(function(error) {
          throw new Error('Failed to load map from URL: ' + error.message);
        });
    }

    function createTileLookupMap() {
      var lookup = {};
      for (var i = 0; i < tileCatalog.length; i++) {
        var tile = tileCatalog[i];
        lookup[tile.id] = tile;
      }
      renderer.tileLookup = lookup;
    }

    function getTileById(tileId) {
      return renderer.tileLookup ? renderer.tileLookup[tileId] : null;
    }

    function getTilesetById(tilesetId) {
      for (var i = 0; i < tilesets.length; i++) {
        var ts = tilesets[i];
        if (ts.id === tilesetId) return ts;
      }
      return null;
    }

    function getMapData() {
      return mapData;
    }

    function getTilesets() {
      return tilesets.slice(); // Return copy
    }

    function getTileCatalog() {
      return tileCatalog.slice(); // Return copy
    }

    function getLevels() {
      return levels.slice(); // Return copy
    }

    function clearMapData() {
      mapData = null;
      tilesets = [];
      tileCatalog = [];
      levels = [];

      if (renderer.tileLookup) {
        renderer.tileLookup = {};
      }

      // Clear scene
      var scene = renderer.getScene();
      var toRemove = [];
      for (var i = 0; i < scene.children.length; i++) {
        var child = scene.children[i];
        if (child.userData && child.userData.mapTile) {
          toRemove.push(child);
        }
      }
      for (var j = 0; j < toRemove.length; j++) {
        scene.remove(toRemove[j]);
      }

      renderer.emit("map:cleared");
      renderer.requestRender();
    }

    // Public API
    renderer.loadMapData = loadMapData;
    renderer.loadMapFile = loadMapFile;
    renderer.loadMapFromUrl = loadMapFromUrl;
    renderer.getTileById = getTileById;
    renderer.getTilesetById = getTilesetById;
    renderer.getMapData = getMapData;
    renderer.getTilesets = getTilesets;
    renderer.getTileCatalog = getTileCatalog;
    renderer.getLevels = getLevels;
    renderer.clearMapData = clearMapData;

    renderer.emit("loader:ready");
  }

  window.RendererLoader = install;
})(window);