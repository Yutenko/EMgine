// core-world.js – world size + accessors
(function () {
  function install(editor) {
    var WORLD = {
      tileSize: (editor.opts && editor.opts.tileSize | 0) || 32,
      cols:     (editor.opts && editor.opts.cols | 0) || 64,
      rows:     (editor.opts && editor.opts.rows | 0) || 64
    };
    WORLD.width  = WORLD.cols * WORLD.tileSize;
    WORLD.height = WORLD.rows * WORLD.tileSize;

    function getWorld(){ return WORLD; }
    function getTileSize(){ return WORLD.tileSize | 0; }

    function resizeWorld(cols, rows) {
      cols = cols | 0; rows = rows | 0;
      if (cols<=0 || rows<=0) return;
      if (cols===WORLD.cols && rows===WORLD.rows) return;
      WORLD.cols = cols; WORLD.rows = rows;
      WORLD.width  = WORLD.cols * WORLD.tileSize;
      WORLD.height = WORLD.rows * WORLD.tileSize;
      editor.emit("world:resize", {cols:cols, rows:rows, tileSize: WORLD.tileSize});
      editor.requestRender();
    }

    editor.getWorld = getWorld;
    editor.getTileSize = getTileSize;
    editor.resizeWorld = resizeWorld;
  }
  window.EditorWorld = install;
})();
