// plugin-texture-loader.js – texture loading and management plugin
(function () {
  function install(renderer) {
    const textureCache = new Map();
    let textureLoader = null;

    function initTextureLoader() {
      if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
      }
    }

    function loadTilesetTextures(tileset) {
      if (!tileset || !tileset.image) return Promise.resolve([]);

      return new Promise((resolve, reject) => {
        initTextureLoader();

        const textureUrl = tileset.image;
        const cacheKey = `tileset_${tileset.id}`;

        // Check cache first
        if (textureCache.has(cacheKey)) {
          resolve(textureCache.get(cacheKey));
          return;
        }

        textureLoader.load(
          textureUrl,
          (texture) => {
            // Configure texture
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            // Store texture info
            const textureInfo = {
              texture: texture,
              tileset: tileset,
              url: textureUrl
            };

            textureCache.set(cacheKey, textureInfo);
            renderer.emit('tileset-texture:loaded', textureInfo);
            resolve(textureInfo);
          },
          (progress) => {
            renderer.emit('tileset-texture:progress', {
              tileset: tileset,
              progress: progress
            });
          },
          (error) => {
            renderer.emit('tileset-texture:error', {
              tileset: tileset,
              error: error
            });
            reject(error);
          }
        );
      });
    }

    function createMaterialFromTileset(layerName, tileId, tilesetTexture) {
      const tileInfo = renderer.getTileById(tileId);
      if (!tileInfo || !tilesetTexture) {
        return renderer.getMaterial(layerName, tileId);
      }

      const tileset = tilesetTexture.tileset;
      const texture = tilesetTexture.texture;

      // Calculate UV coordinates for the specific tile
      const tileU = (tileInfo.col * tileset.tileWidth) / tileset.imageWidth;
      const tileV = (tileInfo.row * tileset.tileHeight) / tileset.imageHeight;
      const tileWidth = tileset.tileWidth / tileset.imageWidth;
      const tileHeight = tileset.tileHeight / tileset.imageHeight;

      // Create a canvas to extract the tile texture
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = tileset.tileWidth;
      canvas.height = tileset.tileHeight;

      // Draw the tile from the tileset
      ctx.drawImage(
        texture.image,
        tileInfo.col * tileset.tileWidth,
        tileInfo.row * tileset.tileHeight,
        tileset.tileWidth,
        tileset.tileHeight,
        0,
        0,
        tileset.tileWidth,
        tileset.tileHeight
      );

      // Create new texture from canvas
      const tileTexture = new THREE.CanvasTexture(canvas);
      tileTexture.wrapS = THREE.ClampToEdgeWrapping;
      tileTexture.wrapT = THREE.ClampToEdgeWrapping;
      tileTexture.minFilter = THREE.LinearFilter;

      const material = new THREE.MeshLambertMaterial({
        map: tileTexture,
        transparent: true
      });

      return material;
    }

    // Enhanced material provider that uses textures when available
    const textureMaterialProvider = {
      getMaterial: function(layerName, tileId) {
        const tileInfo = renderer.getTileById(tileId);
        if (!tileInfo) return null;

        const tileset = renderer.getTilesetById(tileInfo.tilesetId);
        if (!tileset || !tileset.image) return null;

        const cacheKey = `tileset_${tileset.id}`;
        const tilesetTexture = textureCache.get(cacheKey);

        if (tilesetTexture) {
          return createMaterialFromTileset(layerName, tileId, tilesetTexture);
        } else {
          // Try to load the tileset texture
          loadTilesetTextures(tileset).catch(error => {
            console.warn('Failed to load tileset texture:', error);
          });
        }

        return null; // Fall back to default material
      }
    };

    renderer.registerMaterialProvider(textureMaterialProvider);

    // Listen for map loaded event to preload tileset textures
    renderer.on("map:loaded", function(data) {
      const { tilesets } = data;

      // Preload all tileset textures
      tilesets.forEach(tileset => {
        if (tileset.image) {
          loadTilesetTextures(tileset).catch(error => {
            console.warn(`Failed to preload tileset ${tileset.id}:`, error);
          });
        }
      });
    });

    // Public API
    renderer.loadTilesetTextures = loadTilesetTextures;
    renderer.getTextureCache = () => new Map(textureCache); // Return copy
    renderer.clearTextureCache = () => {
      textureCache.clear();
      renderer.emit('texture-cache:cleared');
    };

    console.log('Texture Loader plugin installed');
  }

  window.TextureLoaderPlugin = install;
})(window);