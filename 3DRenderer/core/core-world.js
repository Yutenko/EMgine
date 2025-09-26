// core-world.js – world size and coordinate management
(function () {
  function install(renderer) {
    const WORLD = {
      tileSize: (renderer.opts && renderer.opts.tileSize | 0) || 32,
      cols:     (renderer.opts && renderer.opts.cols | 0) || 64,
      rows:     (renderer.opts && renderer.opts.rows | 0) || 64,
      levels:   (renderer.opts && renderer.opts.levels | 0) || 1
    };

    // Calculate world dimensions
    WORLD.width  = WORLD.cols * WORLD.tileSize;
    WORLD.height = WORLD.rows * WORLD.tileSize;
    WORLD.depth  = WORLD.levels * WORLD.tileSize;

    function getWorld(){ return WORLD; }
    function getTileSize(){ return WORLD.tileSize | 0; }

    function setWorldSize(cols, rows, levels) {
      cols = cols | 0; rows = rows | 0; levels = levels | 0;
      if (cols <= 0 || rows <= 0 || levels <= 0) return;

      const changed = (cols !== WORLD.cols || rows !== WORLD.rows || levels !== WORLD.levels);
      if (!changed) return;

      WORLD.cols = cols; WORLD.rows = rows; WORLD.levels = levels;
      WORLD.width  = WORLD.cols * WORLD.tileSize;
      WORLD.height = WORLD.rows * WORLD.tileSize;
      WORLD.depth  = WORLD.levels * WORLD.tileSize;

      renderer.emit("world:resize", {
        cols: cols,
        rows: rows,
        levels: levels,
        tileSize: WORLD.tileSize,
        width: WORLD.width,
        height: WORLD.height,
        depth: WORLD.depth
      });
      renderer.requestRender();
    }

    function worldToSceneCoords(col, row, level) {
      const world = getWorld();
      return {
        x: (col - world.cols / 2) * world.tileSize,
        y: level * world.tileSize,
        z: (row - world.rows / 2) * world.tileSize
      };
    }

    function sceneToWorldCoords(x, y, z) {
      const world = getWorld();
      return {
        col: Math.floor((x / world.tileSize) + world.cols / 2),
        row: Math.floor((z / world.tileSize) + world.rows / 2),
        level: Math.floor(y / world.tileSize)
      };
    }

    // Public API
    renderer.getWorld = getWorld;
    renderer.getTileSize = getTileSize;
    renderer.setWorldSize = setWorldSize;
    renderer.worldToSceneCoords = worldToSceneCoords;
    renderer.sceneToWorldCoords = sceneToWorldCoords;

    // Initialize with default world
    renderer.emit("world:ready", WORLD);
  }

  window.RendererWorld = install;
})(window);