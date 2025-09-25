// core-underlay.js – underlay preview of lower levels
(function(){
  function install(editor){
    var CHUNK_TILES = (editor.opts && editor.opts.chunkTiles | 0) || 32;
    var WORLD = editor.getWorld();
    var UNDERLAY_PREVIEW = { enabled: true, alpha: 0.25, depth: 1 };
    var levelLayerChunks = new Map();

    // Cache bei relevanten Änderungen leeren
    editor.on && editor.on("level:changed", function(){
      levelLayerChunks = new Map();
    });
    editor.on && editor.on("world:resize", function(){
      levelLayerChunks = new Map();
    });
    editor.on && editor.on("levels:resize", function(){
      levelLayerChunks = new Map();
    });

    function levelLayerChunkKey(level,cx,cy,layer){ return level + "|" + cx + "," + cy + "," + layer; }
    function ensureLevelLayerChunk(level,cx,cy,layer){
      var key = levelLayerChunkKey(level,cx,cy,layer);
      var ch = levelLayerChunks.get(key);
      var pxSize = CHUNK_TILES * editor.getTileSize();
      if (!ch){
        var c = typeof OffscreenCanvas!=="undefined" ? new OffscreenCanvas(pxSize,pxSize) : (function(){ var t=document.createElement("canvas"); t.width=pxSize; t.height=pxSize; return t; })();
        ch = { canvas:c, ctx:c.getContext("2d"), level:level, cx:cx, cy:cy, layer:layer, dirty:true, cmin:null,rmin:null,cmax:null,rmax:null };
        levelLayerChunks.set(key, ch);
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
        for (var col=startCol; col<endCol; col++){
          var idx = row*(L.cols|0) + col;
          var id = buf[idx]|0;
          if (!id) continue;
          var x = (col - cx*CHUNK_TILES) * ts;
          var y = (row - cy*CHUNK_TILES) * ts;
          ch.ctx.fillStyle = editor.colorForIdLayer(layer, id);
          ch.ctx.globalAlpha = 1.0;
          ch.ctx.fillRect(x,y,ts,ts);
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
