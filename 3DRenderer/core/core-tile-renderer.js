// core-tile-renderer.js – main rendering orchestration
(function () {
  function install(renderer) {
    const meshCache = new Map();
    let renderers = [];

    function render() {
      if (!renderer.getMapData()) return;

      // Clear previous frame's tile meshes
      clearTileMeshes();

      // Render each level and layer
      const levels = renderer.getLevels();
      levels.forEach((level, levelIndex) => {
        Object.entries(level.layers).forEach(([layerName, layerData]) => {
          if (!layerData.visible) return;

          renderLayer(levelIndex, layerName, layerData);
        });
      });

      // Call custom renderers
      renderers.forEach(rendererFn => {
        try {
          rendererFn();
        } catch (e) {
          console.error('Renderer error:', e);
        }
      });

      // Render the scene
      renderer.getRenderer().render(renderer.getScene(), renderer.getCamera());
    }

    function clearTileMeshes() {
      const scene = renderer.getScene();
      const toRemove = [];

      scene.children.forEach(child => {
        if (child.userData && child.userData.type === 'tile') {
          toRemove.push(child);
        }
      });

      toRemove.forEach(child => {
        scene.remove(child);
        // Dispose geometry and material to free memory
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    function renderLayer(levelIndex, layerName, layerData) {
      const world = renderer.getWorld();
      if (!world) return;

      const tileSize = world.tileSize;
      const levelData = layerData.data;
      const tilesets = renderer.getTilesets();
      const tileCatalog = renderer.getTileCatalog();

      // Emit event for custom layer rendering
      const eventData = {
        levelIndex,
        layerName,
        layerData,
        world,
        skipDefault: false
      };

      renderer.emit("layer:render:before", eventData);

      if (eventData.skipDefault) return;

      // Default layer rendering
      for (let i = 0; i < levelData.length; i++) {
        const tileId = levelData[i];
        if (tileId === 0) continue; // Skip empty tiles

        const col = i % world.cols;
        const row = Math.floor(i / world.cols);

        renderTile(levelIndex, layerName, tileId, col, row, tileSize);
      }

      renderer.emit("layer:render:after", {levelIndex, layerName, layerData});
    }

    function renderTile(levelIndex, layerName, tileId, col, row, tileSize) {
      const coords = renderer.worldToSceneCoords(col, row, levelIndex);
      const tileInfo = renderer.getTileById(tileId);

      // Emit event for custom tile rendering
      const eventData = {
        levelIndex,
        layerName,
        tileId,
        col,
        row,
        coords,
        tileInfo,
        skipDefault: false
      };

      renderer.emit("tile:render:before", eventData);

      if (eventData.skipDefault) return;

      // Default tile rendering
      const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
      const material = renderer.getMaterial(layerName, tileId);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(coords.x, coords.y, coords.z);
      mesh.rotation.x = -Math.PI / 2; // Lay flat
      mesh.userData = {
        type: 'tile',
        levelIndex,
        layerName,
        tileId,
        col,
        row,
        mapTile: true
      };

      // Add to scene
      renderer.getScene().add(mesh);

      renderer.emit("tile:render:after", {
        levelIndex,
        layerName,
        tileId,
        col,
        row,
        mesh
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
      const index = renderers.indexOf(rendererFn);
      if (index > -1) {
        renderers.splice(index, 1);
        return true;
      }
      return false;
    }

    function getRenderStats() {
      const scene = renderer.getScene();
      let tileCount = 0;

      scene.children.forEach(child => {
        if (child.userData && child.userData.type === 'tile') {
          tileCount++;
        }
      });

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