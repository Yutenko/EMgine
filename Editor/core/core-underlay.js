// core-underlay.js – Vorschau unterer Levels (respektiert Layer-Visibility)
// Usage:
//   editor.use(EditorUnderlay);
//   editor.setUnderlayPreviewAlpha(0.25); editor.setUnderlayPreviewDepth(1);
//   editor.drawUnderlay(ctx); // vor Tiles/Chunks zeichnen
// API:
//   drawUnderlay(ctx), markLevelLayerChunkDirty(level,layer,c,r)
//   setUnderlayPreviewEnabled(on), setUnderlayPreviewAlpha(a), setUnderlayPreviewDepth(n)
// Notes:
//   Caches werden bei level/world/levels-Events geleert; zeichnet nur sichtbare Layer. 


(function(){
  function install(editor){
    var CHUNK_TILES = (editor.opts && editor.opts.chunkTiles | 0) || 32;
    var WORLD = editor.getWorld();
    var UNDERLAY_PREVIEW = { enabled: true, alpha: 0.25, depth: 1 };

    // Use plain object instead of Map (ES5-compatible)
    var levelLayerChunks = {}; // key -> chunk

    function chunksClear(){
      levelLayerChunks = {};
    }

    // React to changes that invalidate caches
    if (editor.on){
      editor.on("level:changed", function(){ chunksClear(); });
      editor.on("world:resize", function(){ WORLD = editor.getWorld(); chunksClear(); });
      editor.on("levels:resize", function(){ chunksClear(); });
    }

    function levelLayerChunkKey(level,cx,cy,layer){ return (level|0) + "|" + (cx|0) + "," + (cy|0) + "," + layer; }

    function ensureLevelLayerChunk(level,cx,cy,layer){
      var key = levelLayerChunkKey(level,cx,cy,layer);
      var ch = levelLayerChunks[key];
      var pxSize = CHUNK_TILES * editor.getTileSize();
      if (!ch){
        var c;
        if (typeof OffscreenCanvas !== "undefined"){
          c = new OffscreenCanvas(pxSize, pxSize);
        } else {
          c = document.createElement("canvas");
          c.width = pxSize; c.height = pxSize;
        }
        ch = { canvas:c, ctx:c.getContext("2d"), level:level|0, cx:cx|0, cy:cy|0, layer:layer, dirty:true, cmin:null, rmin:null, cmax:null, rmax:null };
        levelLayerChunks[key] = ch;
      } else {
        // Resize backing store if tile size or CHUNK_TILES changed
        if (ch.canvas.width !== pxSize || ch.canvas.height !== pxSize){
          ch.canvas.width = pxSize;
          ch.canvas.height = pxSize;
          ch.dirty = true;
          ch.cmin = 0; ch.rmin = 0; ch.cmax = CHUNK_TILES-1; ch.rmax = CHUNK_TILES-1;
        }
      }
      return ch;
    }

    function tileToChunk(col,row){ return {cx:(col/CHUNK_TILES)|0, cy:(row/CHUNK_TILES)|0}; }

    function markLevelLayerChunkDirty(level, layer, col, row){
      var t = tileToChunk(col,row);
      var ch = ensureLevelLayerChunk(level, t.cx, t.cy, layer);
      ch.dirty = true;
      var lc = col - t.cx*CHUNK_TILES;
      var lr = row - t.cy*CHUNK_TILES;
      if (ch.cmin==null || lc<ch.cmin) ch.cmin=lc;
      if (ch.cmax==null || lc>ch.cmax) ch.cmax=lc;
      if (ch.rmin==null || lr<ch.rmin) ch.rmin=lr;
      if (ch.rmax==null || lr>ch.rmax) ch.rmax=lr;
    }
    editor.markLevelLayerChunkDirty = markLevelLayerChunkDirty;

    function redrawLevelLayerChunk(level,cx,cy,layer,full){
      var ch = ensureLevelLayerChunk(level,cx,cy,layer);
      var c2d = ch.ctx;
      var ts = editor.getTileSize();
      var pxSize = CHUNK_TILES * ts;

      var L = editor.levelsState;
      var lvl = L.data[level|0];
      var buf = lvl[layer];

      var cmin=ch.cmin, cmax=ch.cmax, rmin=ch.rmin, rmax=ch.rmax;
      if (full || cmin==null){
        c2d.clearRect(0,0,pxSize,pxSize);
        cmin=0; rmin=0; cmax=CHUNK_TILES-1; rmax=CHUNK_TILES-1;
      } else {
        var rx=cmin*ts, ry=rmin*ts, rw=(cmax-cmin+1)*ts, rh=(rmax-rmin+1)*ts;
        c2d.clearRect(rx, ry, rw, rh);
      }

      var startCol = cx*CHUNK_TILES + cmin;
      var startRow = cy*CHUNK_TILES + rmin;
      var endCol = Math.min(WORLD.cols, cx*CHUNK_TILES + cmax + 1);
      var endRow = Math.min(WORLD.rows, cy*CHUNK_TILES + rmax + 1);

      for (var row=startRow; row<endRow; row++){
        var rowIdx = row*(L.cols|0);
        for (var col=startCol; col<endCol; col++){
          var id = buf[rowIdx + col] | 0;
          if (!id) continue;
          var x = (col - cx*CHUNK_TILES) * ts;
          var y = (row - cy*CHUNK_TILES) * ts;
          c2d.fillStyle = editor.colorForIdLayer(layer, id);
          c2d.globalAlpha = 1.0;
          c2d.fillRect(x,y,ts,ts);
        }
      }
      ch.dirty=false; ch.cmin=ch.rmin=ch.cmax=ch.rmax=null;
    }

    function setUnderlayPreviewEnabled(on){ UNDERLAY_PREVIEW.enabled = !!on; editor.requestRender(); }
    function setUnderlayPreviewAlpha(a){ UNDERLAY_PREVIEW.alpha = Math.max(0, Math.min(1, +a||0)); editor.requestRender(); }
    function setUnderlayPreviewDepth(n){ UNDERLAY_PREVIEW.depth = Math.max(0, n|0); editor.requestRender(); }

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

    function drawUnderlay(ctx){
      if (!UNDERLAY_PREVIEW.enabled) return;
      var depth = Math.max(1, UNDERLAY_PREVIEW.depth|0);
      var L = editor.levelsState;
      var rect = getVisibleChunkRect();
      ctx.save();
      ctx.globalAlpha = UNDERLAY_PREVIEW.alpha;
      for (var d=1; d<=depth; d++){
        var lvl = (L.current|0) - d;
        if (lvl < 0) break;
        for (var layerName in L.show){
          // Respect layer visibility
          if (!L.show[layerName]) continue;
          for (var cy=rect.cy0; cy<=rect.cy1; cy++){
            for (var cx=rect.cx0; cx<=rect.cx1; cx++){
              var ch = ensureLevelLayerChunk(lvl,cx,cy,layerName);
              if (ch.dirty) redrawLevelLayerChunk(lvl,cx,cy,layerName);
              ctx.drawImage(ch.canvas, cx*CHUNK_TILES*editor.getTileSize(), cy*CHUNK_TILES*editor.getTileSize());
            }
          }
        }
      }
      ctx.restore();
    }

    editor.setUnderlayPreviewEnabled = setUnderlayPreviewEnabled;
    editor.setUnderlayPreviewAlpha = setUnderlayPreviewAlpha;
    editor.setUnderlayPreviewDepth = setUnderlayPreviewDepth;
    editor.drawUnderlay = drawUnderlay;
  }
  window.EditorUnderlay = install;
})();