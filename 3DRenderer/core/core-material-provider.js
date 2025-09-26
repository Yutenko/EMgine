// core-material-provider.js - material and texture management
(function () {
  function install(renderer) {
    var materials = {};
    var textures = {};
    var materialProviders = [];

    function getMaterial(layerName, tileId) {
      var key = String(layerName) + '_' + String(tileId);

      // Check cache first
      if (materials[key]) {
        return materials[key];
      }

      // Try custom providers first
      for (var i = 0; i < materialProviders.length; i++) {
        var provider = materialProviders[i];
        var material = provider.getMaterial(layerName, tileId);
        if (material) {
          materials[key] = material;
          return material;
        }
      }

      // Fall back to default material
      var material = createDefaultMaterial(layerName, tileId);
      materials[key] = material;
      return material;
    }

    function createDefaultMaterial(layerName, tileId) {
      var color = getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: false,
        opacity: 1.0
      });
    }

    function getLayerColor(layerName) {
      var colors = {
        floor: 0x4FC3F7,      // Light blue
        wall: 0xFF8A65,       // Orange
        decor: 0xBA68C8,      // Purple
        entities: 0xFFF176,   // Yellow
        ceiling: 0x81C784,    // Green
        liquid: 0x4FC3F7,     // Blue
        terrain: 0x8BC34A     // Light green
      };
      return colors[layerName] || 0x888888;
    }

    function loadTexture(url, name) {
      return new Promise(function(resolve, reject) {
        var loader = new THREE.TextureLoader();
        loader.load(
          url,
          function(texture) {
            textures[name] = texture;
            renderer.emit('texture:loaded', {name: name, texture: texture, url: url});
            resolve(texture);
          },
          undefined,
          function(error) {
            renderer.emit('texture:error', {name: name, url: url, error: error});
            reject(error);
          }
        );
      });
    }

    function getTexture(name) {
      return textures[name] || null;
    }

    function registerMaterialProvider(provider) {
      if (typeof provider.getMaterial === 'function') {
        materialProviders.push(provider);
        renderer.emit('material-provider:registered', provider);
        return true;
      }
      return false;
    }

    function unregisterMaterialProvider(provider) {
      var index = materialProviders.indexOf(provider);
      if (index > -1) {
        materialProviders.splice(index, 1);
        renderer.emit('material-provider:unregistered', provider);
        return true;
      }
      return false;
    }

    function createMaterialFromTexture(texture, color) {
      var material = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: false
      });

      if (color) {
        material.color.setHex(color);
      }

      return material;
    }

    function createWireframeMaterial(color) {
      return new THREE.MeshBasicMaterial({
        color: color || 0x333333,
        wireframe: true
      });
    }

    function clearMaterialCache() {
      materials = {};
      renderer.emit('materials:cleared');
    }

    function getMaterialStats() {
      var cachedCount = 0;
      for (var key in materials) {
        if (materials.hasOwnProperty(key)) cachedCount++;
      }

      var texturesCount = 0;
      for (var textureKey in textures) {
        if (textures.hasOwnProperty(textureKey)) texturesCount++;
      }

      return {
        cached: cachedCount,
        textures: texturesCount,
        providers: materialProviders.length
      };
    }

    // Public API
    renderer.getMaterial = getMaterial;
    renderer.getLayerColor = getLayerColor;
    renderer.loadTexture = loadTexture;
    renderer.getTexture = getTexture;
    renderer.registerMaterialProvider = registerMaterialProvider;
    renderer.unregisterMaterialProvider = unregisterMaterialProvider;
    renderer.createMaterialFromTexture = createMaterialFromTexture;
    renderer.createWireframeMaterial = createWireframeMaterial;
    renderer.clearMaterialCache = clearMaterialCache;
    renderer.getMaterialStats = getMaterialStats;

    renderer.emit("material-provider:ready");
  }

  window.RendererMaterialProvider = install;
})(window);