# 3DRenderer - Three.js Plugin Architecture

A modular 3D renderer built with Three.js that uses the same plugin architecture as your tile editor. This renderer can load JSON map files exported from the editor and display them in 3D space with full extensibility through plugins.

## Architecture Overview

The 3DRenderer follows the same plugin pattern as your editor, where each core module is a function that extends the main renderer instance. This provides identical flexibility and modularity for 3D rendering.

```
┌─────────────────────────────────────────────────────────┐
│                    ThreeRenderer                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                Core Plugins                         │ │
│  │  • Base      - Core Three.js setup & plugin system │ │
│  │  • World     - World dimensions & coordinates      │ │
│  │  • Camera    - Camera controls & positioning       │ │
│  │  • Loader    - JSON loading & parsing              │ │
│  │  • Materials - Material & texture management       │ │
│  │  • Renderer  - Main rendering orchestration        │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Render Plugins                         │ │
│  │  • TileMeshes    - Basic tile mesh generation     │ │
│  │  • TextureLoader - Texture loading & management   │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Custom Plugins                         │ │
│  │  • User-defined rendering extensions               │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

### Plugin System

The renderer uses the same `use()` method as your editor:

```javascript
const renderer = new ThreeRenderer(container);

// Install plugins
renderer.use(RendererWorld);
renderer.use(RendererCamera);
renderer.use(RendererLoader);
// ... more plugins
```

### Event System

Identical event system for communication between plugins:

```javascript
// Listen for events
renderer.on('map:loaded', (data) => {
  console.log('Map loaded:', data);
});

// Emit events
renderer.emit('custom:event', {data: 'value'});
```

### Coordinate System

World coordinates are converted to Three.js scene coordinates:

```javascript
// World coords (col, row, level) -> Scene coords (x, y, z)
const sceneCoords = renderer.worldToSceneCoords(col, row, level);
// Result: {x: number, y: number, z: number}
```

## Core Plugin Reference

### Base Plugin (`core-base.js`)

Provides the main `ThreeRenderer` class with:
- Three.js scene, camera, and renderer setup
- Plugin system (`use()` method)
- Event system (`on()`, `off()`, `emit()`)
- Render loop management
- Basic lighting setup

### World Plugin (`core-world.js`)

Manages world dimensions and coordinate conversion:
- World size (cols, rows, levels)
- Tile size configuration
- Coordinate system conversion
- World resize events

**API:**
```javascript
renderer.getWorld()           // Get world info
renderer.setWorldSize(c, r, l) // Resize world
renderer.worldToSceneCoords(c, r, l) // Convert coords
renderer.sceneToWorldCoords(x, y, z) // Convert back
```

### Camera Plugin (`core-camera.js`)

Handles camera positioning and controls:
- Preset camera positions (orbit, isometric, top-down, side)
- OrbitControls integration
- Camera fitting to world bounds

**API:**
```javascript
renderer.setCameraPreset('orbit')     // Set camera preset
renderer.setCameraPosition(x, y, z)   // Set position
renderer.enableOrbitControls(options) // Enable mouse controls
renderer.fitCameraToWorld(padding)    // Fit camera to world
```

### Loader Plugin (`core-loader.js`)

Handles JSON map data loading:
- File loading (drag & drop, file input)
- URL loading
- Data parsing and validation
- Tileset and tile catalog management

**API:**
```javascript
renderer.loadMapFile(file)        // Load from file
renderer.loadMapFromUrl(url)      // Load from URL
renderer.getMapData()             // Get loaded data
renderer.getTilesets()            // Get tilesets
renderer.getTileCatalog()         // Get tile definitions
```

### Material Provider Plugin (`core-material-provider.js`)

Manages materials and textures:
- Material caching
- Layer-based color system
- Texture loading
- Custom material providers

**API:**
```javascript
renderer.getMaterial(layer, tileId)     // Get material
renderer.loadTexture(url, name)         // Load texture
renderer.registerMaterialProvider(provider) // Add provider
```

### Tile Renderer Plugin (`core-tile-renderer.js`)

Main rendering orchestration:
- Tile mesh generation
- Layer-based rendering
- Custom renderer registration
- Performance statistics

**API:**
```javascript
renderer.registerRenderer(fn)     // Add custom renderer
renderer.getRenderStats()         // Get render statistics
```

## Plugin Development

### Creating a Custom Plugin

```javascript
function MyCustomPlugin(renderer) {
  // Plugin initialization code here

  // Register event listeners
  renderer.on('map:loaded', (data) => {
    // Handle map loaded
  });

  // Add custom methods to renderer
  renderer.myCustomMethod = function() {
    // Custom functionality
  };

  // Register material provider
  renderer.registerMaterialProvider({
    getMaterial: function(layerName, tileId) {
      // Return custom material or null to use default
      return customMaterial;
    }
  });

  // Register custom renderer
  renderer.registerRenderer(function() {
    // Custom rendering logic
  });
}

// Install the plugin
renderer.use(MyCustomPlugin);
```

### Material Provider Interface

```javascript
const materialProvider = {
  getMaterial: function(layerName, tileId) {
    // Return a THREE.Material or null to use default
    // layerName: 'floor', 'wall', 'decor', 'entities'
    // tileId: numeric tile identifier
    return new THREE.MeshLambertMaterial({
      color: 0xFF0000
    });
  }
};

renderer.registerMaterialProvider(materialProvider);
```

### Custom Renderer Interface

```javascript
function customRenderer() {
  // This function is called every frame
  // Access renderer.getScene() to add/remove objects
  // Access renderer.getMapData() for map information
}

renderer.registerRenderer(customRenderer);
```

## Example Usage

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
    <title>3DRenderer Example</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
    <div id="renderer"></div>

    <!-- Core plugins -->
    <script src="core/core-base.js"></script>
    <script src="core/core-world.js"></script>
    <script src="core/core-camera.js"></script>
    <script src="core/core-loader.js"></script>
    <script src="core/core-material-provider.js"></script>
    <script src="core/core-tile-renderer.js"></script>

    <script>
        const renderer = new ThreeRenderer(document.getElementById('renderer'));

        // Install all core plugins
        renderer.use(RendererWorld);
        renderer.use(RendererCamera);
        renderer.use(RendererLoader);
        renderer.use(RendererMaterialProvider);
        renderer.use(RendererTileRenderer);

        // Load a map
        renderer.loadMapFile(mapFile);
    </script>
</body>
</html>
```

### Advanced Setup with Plugins

```javascript
// Create renderer with options
const renderer = new ThreeRenderer(document.body, {
    antialias: true,
    alpha: false
});

// Install core plugins
renderer.use(RendererWorld);
renderer.use(RendererCamera);
renderer.use(RendererLoader);
renderer.use(RendererMaterialProvider);
renderer.use(RendererTileRenderer);

// Install example plugins
renderer.use(TileMeshesPlugin);
renderer.use(TextureLoaderPlugin);

// Set up camera
renderer.setCameraPreset('isometric');
renderer.enableOrbitControls({
    damping: true,
    dampingFactor: 0.05
});

// Handle file loading
document.getElementById('fileInput').addEventListener('change', (e) => {
    renderer.loadMapFile(e.target.files[0]);
});
```

## File Structure

```
3DRenderer/
├── core/                          # Core plugins (required)
│   ├── core-base.js              # Main renderer class
│   ├── core-world.js             # World management
│   ├── core-camera.js            # Camera controls
│   ├── core-loader.js            # JSON loading
│   ├── core-material-provider.js # Material management
│   └── core-tile-renderer.js     # Main rendering
├── plugins/                       # Optional plugins
│   ├── plugin-tile-meshes.js     # Basic tile rendering
│   ├── plugin-texture-loader.js  # Texture loading
│   └── ...                       # Custom plugins
├── index.html                     # Example implementation
└── README.md                      # This file
```

## Performance Considerations

- **Mesh Caching**: Materials are cached to avoid recreation
- **Geometry Reuse**: Tile geometries are reused when possible
- **Event Management**: Use `renderer.off()` to remove event listeners
- **Memory Management**: Dispose of geometries and materials when no longer needed

## Migration from Editor

The architecture is designed to be familiar if you're coming from the tile editor:

- Same `use()` plugin pattern
- Same event system (`on`, `off`, `emit`)
- Similar coordinate system
- Compatible JSON export format
- Modular plugin development

## Browser Support

- Modern browsers with WebGL support
- Three.js r128+ recommended
- ES5 compatible for broader browser support

## License

This 3DRenderer follows the same architecture patterns as your tile editor for consistency and maintainability.