// core-material-provider.js – material and texture management
(function () {
  function install(renderer) {
    const materials = new Map();
    const textures = new Map();
    let materialProviders = [];

    function getMaterial(layerName, tileId) {
      const key = `${layerName}_${tileId}`;

      // Check cache first
      if (materials.has(key)) {
        return materials.get(key);
      }

      // Try custom providers first
      for (const provider of materialProviders) {
        const material = provider.getMaterial(layerName, tileId);
        if (material) {
          materials.set(key, material);
          return material;
        }
      }

      // Fall back to default material
      const material = createDefaultMaterial(layerName, tileId);
      materials.set(key, material);
      return material;
    }

    function createDefaultMaterial(layerName, tileId) {
      const color = getLayerColor(layerName);
      return new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
    }

    function getLayerColor(layerName) {
      const colors = {
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
      return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
          url,
          (texture) => {
            textures.set(name, texture);
            renderer.emit('texture:loaded', {name, texture, url});
            resolve(texture);
          },
          undefined,
          (error) => {
            renderer.emit('texture:error', {name, url, error});
            reject(error);
          }
        );
      });
    }

    function getTexture(name) {
      return textures.get(name) || null;
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
      const index = materialProviders.indexOf(provider);
      if (index > -1) {
        materialProviders.splice(index, 1);
        renderer.emit('material-provider:unregistered', provider);
        return true;
      }
      return false;
    }

    function createMaterialFromTexture(texture, color) {
      const material = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true
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
      materials.clear();
      renderer.emit('materials:cleared');
    }

    function getMaterialStats() {
      return {
        cached: materials.size,
        textures: textures.size,
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