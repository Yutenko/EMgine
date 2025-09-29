// core-world.js – Weltgröße/TileSize + Events
// Usage:
//   editor.use(EditorWorld);
//   const w = editor.getWorld(); // {tileSize, cols, rows, width, height}
//   editor.resizeWorld(128, 96); // emittiert "world:resize"
// API:
//   getWorld(), getTileSize(), resizeWorld(cols, rows)
// Notes:
//   width/height werden aus cols/rows*tileSize abgeleitet. "world:resize" triggert Re-Render. :contentReference[oaicite:9]{index=9}


(function () {
  function install(editor) {
    var WORLD = {
      tileSize: (editor.opts && editor.opts.tileSize | 0) || 32,
      cols: (editor.opts && editor.opts.cols | 0) || 64,
      rows: (editor.opts && editor.opts.rows | 0) || 64,
    };
    WORLD.width = WORLD.cols * WORLD.tileSize;
    WORLD.height = WORLD.rows * WORLD.tileSize;

    function getWorld() {
      return WORLD;
    }
    function getTileSize() {
      return WORLD.tileSize | 0;
    }

    function resizeWorld(cols, rows) {
      cols = cols | 0;
      rows = rows | 0;
      if (cols <= 0 || rows <= 0) return;
      if (cols === WORLD.cols && rows === WORLD.rows) return;
      WORLD.cols = cols;
      WORLD.rows = rows;
      WORLD.width = WORLD.cols * WORLD.tileSize;
      WORLD.height = WORLD.rows * WORLD.tileSize;
      editor.emit("world:resize", {
        cols: cols,
        rows: rows,
        tileSize: WORLD.tileSize,
      });
      editor.requestRender();
    }

    editor.getWorld = getWorld;
    editor.getTileSize = getTileSize;
    editor.resizeWorld = resizeWorld;
  }
  window.EditorWorld = install;
})();
