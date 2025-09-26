// core-tile-renderer.js - main rendering orchestration
(function () {
  function install(renderer) {
    var renderers = [];

    function render() {
      if (!renderer.getMapData()) return;

      // Only clear and re-render if map data changed
      var scene = renderer.getScene();
      var hasTiles = false;
      for (var i = 0; i < scene.children.length; i++) {
        var child = scene.children[i];
        if (child.userData && child.userData.type === 'tile') {
          hasTiles = true;
          break;
        }
      }

      if (!hasTiles) {
        renderAllLayers();
      }

      // Call custom renderers
      for (var j = 0; j < renderers.length; j++) {
        try {
          renderers[j]();
        } catch (e) {
          console.error('Renderer error:', e);
        }
      }

      // Render the scene
      renderer.getRenderer().render(renderer.getScene(), renderer.getCamera());
    }

    function renderAllLayers() {
      // Clear previous frame's tile meshes only when needed
      clearTileMeshes();

      // Render each level and layer
      var levels = renderer.getLevels();
      if (!levels) return;

      for (var levelIndex = 0; levelIndex < levels.length; levelIndex++) {
        var level = levels[levelIndex];
        var layers = level.layers;
        for (var layerName in layers) {
          if (layers.hasOwnProperty(layerName)) {
            var layerData = layers[layerName];
            if (layerData.visible) {
              renderLayer(levelIndex, layerName, layerData);
            }
          }
        }
      }
    }

    function clearTileMeshes() {
      var scene = renderer.getScene();
      var toRemove = [];

      for (var i = 0; i < scene.children.length; i++) {
        var child = scene.children[i];
        if (child.userData && child.userData.type === 'tile') {
          toRemove.push(child);
        }
      }

      for (var j = 0; j < toRemove.length; j++) {
        var child = toRemove[j];
        scene.remove(child);
        // Dispose geometry and material to free memory
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            for (var k = 0; k < child.material.length; k++) {
              child.material[k].dispose();
            }
          } else {
            child.material.dispose();
          }
        }
      }
    }

    function renderLayer(levelIndex, layerName, layerData) {
      var world = renderer.getWorld();
      if (!world) return;

      var tileSize = world.tileSize;
      var levelData = layerData.data;

      // Emit event for custom layer rendering
      var eventData = {
        levelIndex: levelIndex,
        layerName: layerName,
        layerData: layerData,
        world: world,
        skipDefault: false
      };

      renderer.emit("layer:render:before", eventData);

      if (eventData.skipDefault) return;

      // Default layer rendering
      var renderedTiles = 0;
      for (var i = 0; i < levelData.length; i++) {
        var tileId = levelData[i];
        if (tileId === 0) continue; // Skip empty tiles

        var col = i % world.cols;
        var row = Math.floor(i / world.cols);

        renderTile(levelIndex, layerName, tileId, col, row, tileSize);
        renderedTiles++;
      }

      console.log('Layer ' + layerName + ' (Level ' + levelIndex + '): ' + renderedTiles + ' tiles rendered');
    }

    function renderTile(levelIndex, layerName, tileId, col, row, tileSize) {
      var coords = renderer.worldToSceneCoords(col, row, levelIndex);
      var tileInfo = renderer.getTileById(tileId);

      // Emit event for custom tile rendering
      var eventData = {
        levelIndex: levelIndex,
        layerName: layerName,
        tileId: tileId,
        col: col,
        row: row,
        coords: coords,
        tileInfo: tileInfo,
        skipDefault: false
      };

      renderer.emit("tile:render:before", eventData);

      if (eventData.skipDefault) return;

      // Default tile rendering
      var geometry = new THREE.PlaneGeometry(tileSize, tileSize);
      var material = renderer.getMaterial(layerName, tileId);

      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(coords.x, coords.y, coords.z);
      mesh.rotation.x = -Math.PI / 2; // Lay flat
      mesh.userData = {
        type: 'tile',
        levelIndex: levelIndex,
        layerName: layerName,
        tileId: tileId,
        col: col,
        row: row,
        mapTile: true
      };

      // Add to scene
      renderer.getScene().add(mesh);

      // Debug logging for first few tiles
      var tileMeshes = [];
      for (var i = 0; i < renderer.getScene().children.length; i++) {
        var child = renderer.getScene().children[i];
        if (child.userData && child.userData.type === 'tile') {
          tileMeshes.push(child);
        }
      }

      if (tileMeshes.length <= 5) {
        console.log('Tile rendered: ' + layerName + ' at (' + col + ', ' + row + ', ' + levelIndex + ') with color ' + material.color.getHexString());
      }

      renderer.emit("tile:render:after", {
        levelIndex: levelIndex,
        layerName: layerName,
        tileId: tileId,
        col: col,
        row: row,
        mesh: mesh
      });
    }

    function registerRenderer(rendererFn) {
      if (typeof rendererFn === 'function') {
        renderers.push(rendererFn);
        return true;
      }
      return false;
    }

    function unregisterRenderer(rendererFn) {
      var index = renderers.indexOf(rendererFn);
      if (index > -1) {
        renderers.splice(index, 1);
        return true;
      }
      return false;
    }

    function getRenderStats() {
      var scene = renderer.getScene();
      var tileCount = 0;

      for (var i = 0; i < scene.children.length; i++) {
        var child = scene.children[i];
        if (child.userData && child.userData.type === 'tile') {
          tileCount++;
        }
      }

      return {
        tileMeshes: tileCount,
        customRenderers: renderers.length,
        cachedMaterials: renderer.getMaterialStats ? renderer.getMaterialStats().cached : 0
      };
    }

    // Override the main render function
    renderer.render = render;

    // Public API
    renderer.renderLayer = renderLayer;
    renderer.renderTile = renderTile;
    renderer.registerRenderer = registerRenderer;
    renderer.unregisterRenderer = unregisterRenderer;
    renderer.getRenderStats = getRenderStats;
    renderer.clearTileMeshes = clearTileMeshes;

    renderer.emit("tile-renderer:ready");
  }

  window.RendererTileRenderer = install;
})(window);