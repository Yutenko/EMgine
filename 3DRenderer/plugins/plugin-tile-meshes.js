// plugin-tile-meshes.js – basic tile mesh generation plugin
(function () {
  function install(renderer) {
    // Register material provider for enhanced tile materials
    const tileMaterialProvider = {
      getMaterial: function(layerName, tileId) {
        const tileInfo = renderer.getTileById(tileId);
        if (!tileInfo) return null;

        // Create materials based on tile properties
        switch (tileInfo.type) {
          case 'wall':
            return createWallMaterial(layerName, tileId);
          case 'floor':
            return createFloorMaterial(layerName, tileId);
          case 'decor':
            return createDecorMaterial(layerName, tileId);
          default:
            return createBasicMaterial(layerName, tileId);
        }
      }
    };

    renderer.registerMaterialProvider(tileMaterialProvider);

    function createWallMaterial(layerName, tileId) {
      const color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        opacity: 1.0
      });
    }

    function createFloorMaterial(layerName, tileId) {
      const color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
    }

    function createDecorMaterial(layerName, tileId) {
      const color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
    }

    function createBasicMaterial(layerName, tileId) {
      const color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        opacity: 0.85
      });
    }

    // Register custom tile renderer for special tile types
    renderer.registerRenderer(function() {
      // This renderer handles special rendering cases
      const scene = renderer.getScene();
      const levels = renderer.getLevels();

      if (!levels) return;

      // Add level separation planes for better visual distinction
      levels.forEach((level, levelIndex) => {
        if (levelIndex > 0) {
          addLevelSeparator(levelIndex);
        }
      });
    });

    function addLevelSeparator(levelIndex) {
      const world = renderer.getWorld();
      if (!world) return;

      const separatorGeometry = new THREE.PlaneGeometry(
        world.width + 10,
        world.height + 10
      );

      const separatorMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
      });

      const separator = new THREE.Mesh(separatorGeometry, separatorMaterial);
      separator.position.y = levelIndex * world.tileSize - 1;
      separator.rotation.x = -Math.PI / 2;
      separator.userData = { type: 'level-separator' };

      renderer.getScene().add(separator);
    }

    // Listen for tile render events to add special effects
    renderer.on("tile:render:after", function(data) {
      const { levelIndex, layerName, tileId, col, row, mesh } = data;

      // Add height variation for certain tile types
      const tileInfo = renderer.getTileById(tileId);
      if (tileInfo && tileInfo.type === 'wall') {
        // Make walls slightly taller
        mesh.scale.y = 1.1;
        mesh.position.y += 1;
      }
    });

    console.log('Tile Meshes plugin installed');
  }

  window.TileMeshesPlugin = install;
})(window);