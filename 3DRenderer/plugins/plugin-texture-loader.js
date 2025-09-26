// plugin-texture-loader.js - texture loading and management plugin
(function () {
  function install(renderer) {
    var textureCache = {};
    var textureLoader = null;

    function initTextureLoader() {
      if (!textureLoader) {
        textureLoader = new THREE.TextureLoader();
      }
    }

    function loadTilesetTextures(tileset) {
      if (!tileset || !tileset.image) return Promise.resolve([]);

      return new Promise(function(resolve, reject) {
        initTextureLoader();

        var textureUrl = tileset.image;
        var cacheKey = 'tileset_' + tileset.id;

        // Check cache first
        if (textureCache[cacheKey]) {
          resolve(textureCache[cacheKey]);
          return;
        }

        textureLoader.load(
          textureUrl,
          function(texture) {
            // Configure texture
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            // Store texture info
            var textureInfo = {
              texture: texture,
              tileset: tileset,
              url: textureUrl
            };

            textureCache[cacheKey] = textureInfo;
            renderer.emit('tileset-texture:loaded', textureInfo);
            resolve(textureInfo);
          },
          function(progress) {
            renderer.emit('tileset-texture:progress', {
              tileset: tileset,
              progress: progress
            });
          },
          function(error) {
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
      var tileInfo = renderer.getTileById(tileId);
      if (!tileInfo || !tilesetTexture) {
        return renderer.getMaterial(layerName, tileId);
      }

      var tileset = tilesetTexture.tileset;
      var texture = tilesetTexture.texture;

      // Calculate UV coordinates for the specific tile
      var tileU = (tileInfo.col * tileset.tileWidth) / tileset.imageWidth;
      var tileV = (tileInfo.row * tileset.tileHeight) / tileset.imageHeight;
      var tileWidth = tileset.tileWidth / tileset.imageWidth;
      var tileHeight = tileset.tileHeight / tileset.imageHeight;

      // Create a canvas to extract the tile texture
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
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
      var tileTexture = new THREE.CanvasTexture(canvas);
      tileTexture.wrapS = THREE.ClampToEdgeWrapping;
      tileTexture.wrapT = THREE.ClampToEdgeWrapping;
      tileTexture.minFilter = THREE.LinearFilter;

      var material = new THREE.MeshLambertMaterial({
        map: tileTexture,
        transparent: false
      });

      return material;
    }

    // Enhanced material provider that uses textures when available
    var textureMaterialProvider = {
      getMaterial: function(layerName, tileId) {
        var tileInfo = renderer.getTileById(tileId);
        if (!tileInfo) return null;

        var tileset = renderer.getTilesetById(tileInfo.tilesetId);
        if (!tileset || !tileset.image) return null;

        var cacheKey = 'tileset_' + tileset.id;
        var tilesetTexture = textureCache[cacheKey];

        if (tilesetTexture) {
          return createMaterialFromTileset(layerName, tileId, tilesetTexture);
        } else {
          // Try to load the tileset texture
          loadTilesetTextures(tileset).catch(function(error) {
            console.warn('Failed to load tileset texture:', error);
          });
        }

        return null; // Fall back to default material
      }
    };

    renderer.registerMaterialProvider(textureMaterialProvider);

    // Listen for map loaded event to preload tileset textures
    renderer.on("map:loaded", function(data) {
      var tilesets = data.tilesets;

      // Preload all tileset textures
      for (var i = 0; i < tilesets.length; i++) {
        var tileset = tilesets[i];
        if (tileset.image) {
          loadTilesetTextures(tileset).catch(function(error) {
            console.warn('Failed to preload tileset ' + tileset.id + ':', error);
          });
        }
      }
    });

    // Public API
    renderer.loadTilesetTextures = loadTilesetTextures;
    renderer.getTextureCache = function() {
      var copy = {};
      for (var key in textureCache) {
        if (textureCache.hasOwnProperty(key)) {
          copy[key] = textureCache[key];
        }
      }
      return copy;
    };
    renderer.clearTextureCache = function() {
      textureCache = {};
      renderer.emit('texture-cache:cleared');
    };

    console.log('Texture Loader plugin installed');
  }

  window.TextureLoaderPlugin = install;
})(window);