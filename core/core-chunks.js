// core-chunks.js – per-layer chunk caching, dirty tracking, rendering (hover = highlight)
(function(){
  function install(editor){
    var CHUNK_TILES = (editor.opts && editor.opts.chunkTiles | 0) || 32;
    var WORLD = editor.getWorld();
    var layerChunks = new Map();
    var chunksDirtyAll = true;

    function tileToChunk(col,row){ return {cx:(col/CHUNK_TILES)|0, cy:(row/CHUNK_TILES)|0}; }
    function layerChunkKey(cx,cy,layer){ return cx + "," + cy + "," + layer; }
    function ensureLayerChunk(cx,cy,layer){
      var key = layerChunkKey(cx,cy,layer), ch = layerChunks.get(key);
      var pxSize = CHUNK_TILES * editor.getTileSize();
      if (!ch){
        var c = typeof OffscreenCanvas!=="undefined" ? new OffscreenCanvas(pxSize,pxSize) : (function(){ var t=document.createElement("canvas"); t.width=pxSize; t.height=pxSize; return t; })();
        ch = { canvas:c, ctx:c.getContext("2d"), cx:cx, cy:cy, layer:layer, dirty:true, cmin:null, rmin:null, cmax:null, rmax:null };
        layerChunks.set(key, ch);
      } else {
        if (ch.canvas.width !== pxSize || ch.canvas.height !== pxSize){
          ch.canvas.width=pxSize; ch.canvas.height=pxSize; ch.dirty=true; ch.cmin=0; ch.rmin=0; ch.cmax=CHUNK_TILES-1; ch.rmax=CHUNK_TILES-1;
        }
      }
      return ch;
    }

    function markLayerChunkDirtyAt(layer,col,row){
      var t = tileToChunk(col,row);
      var ch = ensureLayerChunk(t.cx, t.cy, layer);
      ch.dirty = true;
      var lc = col - t.cx*CHUNK_TILES;
      var lr = row - t.cy*CHUNK_TILES;
      if (ch.cmin==null || lc<ch.cmin) ch.cmin = lc;
      if (ch.cmax==null || lc>ch.cmax) ch.cmax = lc;
      if (ch.rmin==null || lr<ch.rmin) ch.rmin = lr;
      if (ch.rmax==null || lr>ch.rmax) ch.rmax = lr;
    }
    function markAllLayerChunksDirty(){
      layerChunks.forEach(function(ch){ ch.dirty=true; ch.cmin=ch.rmin=null; ch.cmax=ch.rmax=null; });
      chunksDirtyAll = true;
    }
    editor.markLayerChunkDirtyAt = markLayerChunkDirtyAt;
    editor.markAllLayerChunksDirty = markAllLayerChunksDirty;

    function redrawLayerChunk(cx,cy,layer,full){
      var ch = ensureLayerChunk(cx,cy,layer);
      var c2d = ch.ctx;
      var ts = editor.getTileSize();
      var pxSize = CHUNK_TILES * ts;
      var L = editor.levelsState;
      var buf = L.data[L.current|0][layer];

      var cmin=ch.cmin, cmax=ch.cmax, rmin=ch.rmin, rmax=ch.rmax;
      if (chunksDirtyAll || full || cmin==null){
        c2d.clearRect(0,0,pxSize,pxSize);
        cmin=0; rmin=0; cmax=CHUNK_TILES-1; rmax=CHUNK_TILES-1;
      } else {
        var rx = cmin*ts, ry=rmin*ts, rw=(cmax-cmin+1)*ts, rh=(rmax-rmin+1)*ts;
        c2d.clearRect(rx, ry, rw, rh);
      }

      var startCol = cx*CHUNK_TILES + cmin;
      var startRow = cy*CHUNK_TILES + rmin;
      var endCol = Math.min(WORLD.cols, cx*CHUNK_TILES + cmax + 1);
      var endRow = Math.min(WORLD.rows, cy*CHUNK_TILES + rmax + 1);

      // Tiles des Layers in den Chunk rendern (volle Deckkraft; Filter erst beim drawImage)
      for (var row=startRow; row<endRow; row++){
        for (var col=startCol; col<endCol; col++){
          var idx = row*(L.cols|0) + col;
          var id = buf[idx]|0;
          if (!id) continue;
          var x = (col - cx*CHUNK_TILES) * ts;
          var y = (row - cy*CHUNK_TILES) * ts;

          // Draw actual tile graphics instead of colored rectangles
          var tile = editor.getTileById ? editor.getTileById(id) : null;
          if (tile && tile.image) {
            // Calculate source position in tileset
            var tileset = editor.getTilesetById ? editor.getTilesetById(tile.tilesetId) : null;
            if (tileset && tileset.type === "atlas") {
              var srcX = (tile.col | 0) * (tileset.tileWidth | 0);
              var srcY = (tile.row | 0) * (tileset.tileHeight | 0);
              var srcW = tileset.tileWidth | 0;
              var srcH = tileset.tileHeight | 0;

              // Draw the tile from the tileset
              try {
                c2d.drawImage(tile.image, srcX, srcY, srcW, srcH, x, y, ts, ts);
              } catch (e) {
                console.warn("Failed to draw tile", id, ":", e);
                // Fallback: draw colored rectangle
                c2d.fillStyle = editor.colorForIdLayer(layer, id);
                c2d.fillRect(x, y, ts, ts);
              }
            } else {
              console.warn("No tileset found for tile", id, "tilesetId:", tile.tilesetId);
              // Fallback: draw colored rectangle if tile image not available
              c2d.fillStyle = editor.colorForIdLayer(layer, id);
              c2d.fillRect(x, y, ts, ts);
            }
          } else {
            console.warn("No tile found for id", id, "or no image available");
            // Fallback: draw colored rectangle if tile not found
            c2d.fillStyle = editor.colorForIdLayer(layer, id);
            c2d.fillRect(x, y, ts, ts);
          }
        }
      }
      ch.dirty=false; ch.cmin=ch.rmin=ch.cmax=ch.rmax=null;
    }

    function getVisibleChunkRect(){
      var vis = editor.getVisibleGridRect();
      var cx0 = (vis.c0 / CHUNK_TILES) | 0;
      var cx1 = (Math.max(vis.c1-1, vis.c0) / CHUNK_TILES) | 0;
      var cy0 = (vis.r0 / CHUNK_TILES) | 0;
      var cy1 = (Math.max(vis.r1-1, vis.r0) / CHUNK_TILES) | 0;
      var maxCx = ((WORLD.cols-1)/CHUNK_TILES)|0;
      var maxCy = ((WORLD.rows-1)/CHUNK_TILES)|0;
      cx0 = Math.max(0, Math.min(cx0, maxCx));
      cx1 = Math.max(0, Math.min(cx1, maxCx));
      cy0 = Math.max(0, Math.min(cy0, maxCy));
      cy1 = Math.max(0, Math.min(cy1, maxCy));
      return {cx0:cx0, cx1:cx1, cy0:cy0, cy1:cy1};
    }

    function renderDirtyChunks(ctx){
      var rect = getVisibleChunkRect();
      var L = editor.levelsState;
      var hover = (!editor.suppressHoverHighlight && L.hoverLayer) ? L.hoverLayer : null;

      for (var cy=rect.cy0; cy<=rect.cy1; cy++){
        for (var cx=rect.cx0; cx<=rect.cx1; cx++){
          for (var layerName in L.show){
            if (!L.show[layerName]) continue;
            var ch = ensureLayerChunk(cx,cy,layerName);
            if (ch.dirty) redrawLayerChunk(cx,cy,layerName);
            // Hover-Highlight: hovered Layer voll, andere gedimmt
            if (hover && layerName !== hover){
              ctx.globalAlpha = 0.20;
              ctx.drawImage(ch.canvas, cx*CHUNK_TILES*editor.getTileSize(), cy*CHUNK_TILES*editor.getTileSize());
              ctx.globalAlpha = 1.0;
            } else {
              ctx.drawImage(ch.canvas, cx*CHUNK_TILES*editor.getTileSize(), cy*CHUNK_TILES*editor.getTileSize());
            }
          }
        }
      }
      chunksDirtyAll = false;
    }

    editor.getVisibleChunkRect = getVisibleChunkRect;
    editor.redrawLayerChunk = redrawLayerChunk;
    editor.renderDirtyChunks = renderDirtyChunks;
  }
  window.EditorChunks = install;
})();