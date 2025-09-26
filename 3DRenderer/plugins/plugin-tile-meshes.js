// plugin-tile-meshes.js - basic tile mesh generation plugin
(function () {
  function install(renderer) {
    // Register material provider for enhanced tile materials
    var tileMaterialProvider = {
      getMaterial: function(layerName, tileId) {
        var tileInfo = renderer.getTileById(tileId);
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
      var color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: false,
        opacity: 1.0
      });
    }

    function createFloorMaterial(layerName, tileId) {
      var color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: false,
        opacity: 1.0
      });
    }

    function createDecorMaterial(layerName, tileId) {
      var color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: false,
        opacity: 1.0
      });
    }

    function createBasicMaterial(layerName, tileId) {
      var color = renderer.getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: false,
        opacity: 1.0
      });
    }

    // Register custom tile renderer for special tile types
    renderer.registerRenderer(function() {
      // This renderer handles special rendering cases
      var scene = renderer.getScene();
      var mapData = renderer.getMapData();

      if (!mapData) return;

      // Add a simple ground plane for reference
      addGroundPlane();

      // Add level separation planes for better visual distinction
      var levels = renderer.getLevels();
      if (levels) {
        for (var levelIndex = 0; levelIndex < levels.length; levelIndex++) {
          if (levelIndex > 0) {
            addLevelSeparator(levelIndex);
          }
        }
      }
    });

    function addGroundPlane() {
      var world = renderer.getWorld();
      if (!world) return;

      // Check if ground plane already exists
      var scene = renderer.getScene();
      var hasGroundPlane = false;
      for (var i = 0; i < scene.children.length; i++) {
        var child = scene.children[i];
        if (child.userData && child.userData.type === 'ground-plane') {
          hasGroundPlane = true;
          break;
        }
      }

      if (hasGroundPlane) return;

      var groundGeometry = new THREE.PlaneGeometry(
        world.width + 20,
        world.height + 20
      );

      var groundMaterial = new THREE.MeshLambertMaterial({
        color: 0x404040,
        transparent: true,
        opacity: 0.3
      });

      var ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.position.y = -1;
      ground.rotation.x = -Math.PI / 2;
      ground.userData = { type: 'ground-plane' };

      scene.add(ground);
    }

    function addLevelSeparator(levelIndex) {
      var world = renderer.getWorld();
      if (!world) return;

      var separatorGeometry = new THREE.PlaneGeometry(
        world.width + 10,
        world.height + 10
      );

      var separatorMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide
      });

      var separator = new THREE.Mesh(separatorGeometry, separatorMaterial);
      separator.position.y = levelIndex * world.tileSize - 1;
      separator.rotation.x = -Math.PI / 2;
      separator.userData = { type: 'level-separator' };

      renderer.getScene().add(separator);
    }

    // Listen for tile render events to add special effects
    renderer.on("tile:render:after", function(data) {
      var levelIndex = data.levelIndex;
      var layerName = data.layerName;
      var tileId = data.tileId;
      var col = data.col;
      var row = data.row;
      var mesh = data.mesh;

      // Add height variation for certain tile types
      var tileInfo = renderer.getTileById(tileId);
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