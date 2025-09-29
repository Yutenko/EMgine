// core-tool-paint.js – UI-agnostischer Paint-Pinsel (ES5)
// Usage:
//   editor.use(EditorCamera).use(EditorLevels).use(EditorHistory).use(EditorToolPaint);
//   // Pointer aus deiner UI/Adapter-Schicht:
//   editor.paintBegin(sx, sy, pointerId, buttonIndex); // 0=Links, 2=Rechts (Erase)
//   editor.paintMove (sx, sy, pointerId);              // koalesziert & nutzt Bresenham
//   editor.paintEnd  (pointerId);
// Config:
//   editor.setPaintCoalescing(true/false);   // default: true
//   editor.setEraseButton(2);                // default: 2 (Right)
//   editor.setBrushId(id);                   // default: 1
//   editor.setBrushPattern({w,h,ids});       // 2D-Muster; hat Vorrang vor BrushId
// Events (emit):
//   "tool:paint:start" { tile, btn }  | "tool:paint:move" { tile, btn } | "tool:paint:end" {}
// Notes:
//   - Keine DOM-Zugriffe. sx/sy sind Canvas-relative Screen-Pixel.
//   - Verwendet editor.screenToWorld + getTileSize, History via beginCompound/endCompound.
(function(){
  function install(editor){
    var coalesce = true;
    var eraseBtn = 2;   // 0=Left,1=Middle,2=Right
    var brushId  = 1;
    var brushPattern = null; // {w,h,ids:number[][]}

    var paintActive = false, activePid = null, paintBtn = 0;
    var lastCol = null, lastRow = null;
    var compoundOpen = false;

    var pendingMove = null, rafId = 0;

    function emit(n, d){ editor.emit && editor.emit(n, d||{}); }
    function getTs(){ return editor.getTileSize ? editor.getTileSize() : 32; }
    function s2t(sx, sy){
      if (!editor.screenToWorld) return null;
      var w = editor.screenToWorld(sx, sy); var ts = getTs();
      return { c: (w.x/ts)|0, r: (w.y/ts)|0 };
    }

    function beginCompound(){
      if (compoundOpen || !editor.beginCompound) return;
      editor.beginCompound("paint-stroke"); compoundOpen = true;
    }
    function endCompound(cancel){
      if (!compoundOpen || !editor.endCompound) return;
      editor.endCompound(!!cancel); compoundOpen = false;
    }

    // Bresenham
    function lineTiles(c0,r0,c1,r1,cb){
      var dx=Math.abs(c1-c0), sx=c0<c1?1:-1;
      var dy=-Math.abs(r1-r0), sy=r0<r1?1:-1;
      var err=dx+dy, e2, c=c0, r=r0;
      for(;;){
        cb(c,r);
        if (c===c1 && r===r1) break;
        e2=2*err;
        if (e2>=dy){ err+=dy; c+=sx; }
        if (e2<=dx){ err+=dx; r+=sy; }
      }
    }

    function paintAt(c, r, btn){
      if ((btn|0) === (eraseBtn|0)) { editor.setTile && editor.setTile(c|0,r|0,0); return; }
      var pat = brushPattern;
      if (pat && pat.w>0 && pat.h>0 && pat.ids){
        for (var rr=0; rr<pat.h; rr++) for (var cc=0; cc<pat.w; cc++){
          var id = pat.ids[rr][cc]|0; if (!id) continue;
          editor.setTile && editor.setTile((c+cc)|0, (r+rr)|0, id);
        }
      } else {
        editor.setTile && editor.setTile(c|0,r|0,brushId|0);
      }
    }

    function queuePaintMove(sx, sy, pid){
      if (!coalesce){ _applyMove(sx, sy, pid); return; }
      pendingMove = { sx:sx, sy:sy, pid:pid };
      if (!rafId) rafId = requestAnimationFrame(tick);
    }
    function tick(){
      rafId = 0;
      if (!pendingMove) return;
      var m = pendingMove; pendingMove = null;
      _applyMove(m.sx, m.sy, m.pid);
      if (pendingMove && !rafId) rafId = requestAnimationFrame(tick);
    }

    function _applyMove(sx, sy, pid){
      if (!paintActive || pid !== activePid) return;
      beginCompound();
      var t = s2t(sx, sy); if (!t) return;
      if (lastCol==null || lastRow==null){
        paintAt(t.c|0, t.r|0, paintBtn);
        lastCol=t.c|0; lastRow=t.r|0;
        emit("tool:paint:move", { tile:{c:lastCol,r:lastRow}, btn:paintBtn });
        editor.requestRender && editor.requestRender();
        return;
      }
      var c0=lastCol|0, r0=lastRow|0, c1=t.c|0, r1=t.r|0;
      if (c0===c1 && r0===r1) paintAt(c1,r1,paintBtn);
      else lineTiles(c0,r0,c1,r1,function(c,r){ paintAt(c,r,paintBtn); });
      lastCol=c1; lastRow=r1;
      emit("tool:paint:move", { tile:{c:c1,r:r1}, btn:paintBtn });
      editor.requestRender && editor.requestRender();
    }

    // Public API
    function paintBegin(sx, sy, pointerId, buttonIndex){
      if (paintActive) return false;
      paintActive = true; activePid = pointerId != null ? pointerId : 0;
      paintBtn = (buttonIndex|0)||0; lastCol = lastRow = null;
      beginCompound();
      var t = s2t(sx, sy); if (t){ paintAt(t.c|0, t.r|0, paintBtn); lastCol=t.c|0; lastRow=t.r|0; }
      emit("tool:paint:start", { tile:t, btn:paintBtn });
      editor.requestRender && editor.requestRender();
      return true;
    }
    function paintMove(sx, sy, pointerId){
      if (!paintActive || pointerId !== activePid) return false;
      queuePaintMove(sx, sy, pointerId); return true;
    }
    function paintEnd(pointerId){
      if (!paintActive || pointerId !== activePid) return false;
      paintActive=false; activePid=null; lastCol=lastRow=null; endCompound(false);
      emit("tool:paint:end", {}); editor.requestRender && editor.requestRender();
      return true;
    }

    function setPaintCoalescing(on){ coalesce = !!on; }
    function setEraseButton(btn){ eraseBtn = (btn|0); }
    function setBrushId(id){ brushId = (id|0)||0; }
    function setBrushPattern(p){ brushPattern = p && p.w>0 && p.h>0 && p.ids ? p : null; }

    // Export
    editor.paintBegin = paintBegin;
    editor.paintMove  = paintMove;
    editor.paintEnd   = paintEnd;

    editor.setPaintCoalescing = setPaintCoalescing;
    editor.setEraseButton     = setEraseButton;
    editor.setBrushId         = setBrushId;
    editor.setBrushPattern    = setBrushPattern;
  }
  window.EditorToolPaint = install;
})();
