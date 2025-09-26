// core-loader.js – JSON map data loading and parsing
(function () {
  function install(renderer) {
    let mapData = null;
    let tilesets = [];
    let tileCatalog = [];
    let levels = [];

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
      const metadata = jsonData.metadata;
      if (metadata && metadata.world) {
        const world = metadata.world;
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
      return new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('No file provided'));
          return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            const jsonData = JSON.parse(e.target.result);
            const result = loadMapData(jsonData);
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
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch map data from URL');
          }
          return response.json();
        })
        .then(jsonData => loadMapData(jsonData))
        .catch(error => {
          throw new Error('Failed to load map from URL: ' + error.message);
        });
    }

    function createTileLookupMap() {
      const lookup = new Map();

      tileCatalog.forEach(tile => {
        lookup.set(tile.id, tile);
      });

      renderer.tileLookup = lookup;
    }

    function getTileById(tileId) {
      return renderer.tileLookup ? renderer.tileLookup.get(tileId) : null;
    }

    function getTilesetById(tilesetId) {
      return tilesets.find(ts => ts.id === tilesetId) || null;
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
        renderer.tileLookup.clear();
      }

      // Clear scene
      const scene = renderer.getScene();
      const toRemove = [];
      scene.children.forEach(child => {
        if (child.userData && child.userData.mapTile) {
          toRemove.push(child);
        }
      });
      toRemove.forEach(child => scene.remove(child));

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