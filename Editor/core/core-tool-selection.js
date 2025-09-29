// core-tool-selection.js – UI-agnostisches Selektions-Plugin (ES5)
// Usage (mit Svelte/Adapter):
//   editor.use(EditorLevels).use(EditorHistory).use(EditorToolSelection);
//   // Rechteck-Auswahl (in Tile-Koordinaten):
//   editor.selBegin(col0, row0);
//   editor.selUpdate(col1, row1);
//   editor.selEnd();                        // finalisiert Auswahl
//   // Bewegen der Auswahl (klassischer Move-Ghost):
//   editor.selMoveBegin(hitCol, hitRow);    // nur wenn Cursor in aktueller Auswahl
//   editor.selMoveUpdate(col, row);         // versetzen relativ zum Start
//   editor.selMoveCommit();                 // commit (mit History)
//   editor.selMoveCancel();                 // abbrechen
//   // Floating (Copy/Paste-Ghost frei positionieren):
//   editor.selCopy();                       // kopiert aktuelle Auswahl in Clipboard & erzeugt Floating
//   editor.selCut();                        // ausschneiden -> Floating
//   editor.selPasteAt(col, row);            // Clipboard als Floating an Position
//   editor.selFloatBegin(hitCol, hitRow);   // Floating-Ghost greifen
//   editor.selFloatUpdate(col, row);        // verschieben
//   editor.selFloatCommit();                // einfügen (mit History) und Auswahl setzen
//   editor.selFloatCancel();                // Floating verwerfen
//   // Sonstiges:
//   editor.selRotateCW();                   // 90° drehen (Floating bevorzugt; sonst in-place)
//   editor.selDelete();                     // Inhalt der Auswahl löschen (History)
//   editor.getSelection();                  // {c0,r0,c1,r1} | null
//   editor.setSelection(rect|null);         // Auswahl extern setzen/löschen
//   // Overlay (im Renderpfad aufrufen, nach applyCamera):
//   editor.drawSelectionOverlay(ctx);
//
// Notes:
//   - Komplett UI-frei: Du lieferst nur Tile-Koordinaten aus deiner UI/Adapter-Schicht.
//   - Multi-Layer fähig: Operiert über alle sichtbaren Layer (levelsState.show === true).
//   - History integriert: nutzt pushAction / beginCompound / endCompound, setTileRaw fürs Replay.
//   - „Floating“ = temporäre Einfüge-Vorschau (Copy/Paste), „Move-Ghost“ = klassisches Verschieben.
//   - Keine DOM-Elemente, keine globalen Events. Farben via editor.colorForIdLayer(layer, id).
(function(){
  function install(editor){
    // --- State ---
    var active = true; // falls du später Tool-Enable/Disable brauchst
    var sel = null;           // {c0,r0,c1,r1}
    var selecting = false;
    var down0 = null;         // Startpunkt bei Rechteckauswahl

    // Classic Move-Ghost:
    var moving = false;
    var moveStart = null;     // {col,row} beim Klick in Auswahl
    var moveOffset = {dc:0, dr:0};
    var moveSrcRect = null;   // Auswahl-Snapshot beim Start
    var moveGhostData = null; // Region-Daten
    var moveGhostCanvas = null;

    // Floating Ghost (Copy/Paste):
    var floating = false;
    var floatData = null;     // {w,h,layers[],data{layer->rows[]}}
    var floatPos = {col:0,row:0};
    var floatDragging = false;
    var floatDragStart = null;
    var floatOffset = {dc:0, dr:0};

    // Clipboard:
    var clip = null;          // gleiches Format wie floatData
    var clipIsCut = false;

    // ---- Utils ----
    function emit(type, detail){ editor.emit && editor.emit(type, detail||{}); }
    function hasSel(){ return !!sel && sel.c1>=sel.c0 && sel.r1>=sel.r0; }
    function normRect(a,b){
      var c0 = Math.min(a.col|0, b.col|0), r0 = Math.min(a.row|0, b.row|0);
      var c1 = Math.max(a.col|0, b.col|0), r1 = Math.max(a.row|0, b.row|0);
      return {c0:c0,r0:r0,c1:c1,r1:r1};
    }
    function selSize(s){ return {w:(s.c1-s.c0+1), h:(s.r1-s.r0+1)}; }
    function insideRect(t,c0,r0,c1,r1){ if(!t) return false; return t.col>=c0 && t.col<=c1 && t.row>=r0 && t.row<=r1; }
    function insideSel(t){ return hasSel() && insideRect(t, sel.c0, sel.r0, sel.c1, sel.r1); }
    function world() { return editor.getWorld ? editor.getWorld() : {cols:0,rows:0}; }
    function clamp(col,row){
      var w = world();
      col = Math.max(0, Math.min((w.cols|0)-1, col|0));
      row = Math.max(0, Math.min((w.rows|0)-1, row|0));
      return {col:col,row:row};
    }
    function regionFits(col,row,w,h){
      var W = world();
      return col>=0 && row>=0 && (col+w)<=W.cols && (row+h)<=W.rows;
    }
    function findNearbyPlacement(baseC, baseR, w, h){
      if (regionFits(baseC, baseR, w, h)) return {col:baseC,row:baseR};
      var maxR = 6, r, dc, dr;
      for (r=1; r<=maxR; r++){
        for (dc=-r; dc<=r; dc++){
          var c1={col:baseC+dc,row:baseR-r}, c2={col:baseC+dc,row:baseR+r};
          if (regionFits(c1.col,c1.row,w,h)) return c1;
          if (regionFits(c2.col,c2.row,w,h)) return c2;
        }
        for (dr=-r+1; dr<=r-1; dr++){
          var c3={col:baseC-r,row:baseR+dr}, c4={col:baseC+r,row:baseR+dr};
          if (regionFits(c3.col,c3.row,w,h)) return c3;
          if (regionFits(c4.col,c4.row,w,h)) return c4;
        }
      }
      var cl = clamp(baseC, baseR);
      var W = world();
      cl.col = Math.min(cl.col, (W.cols|0) - w);
      cl.row = Math.min(cl.row, (W.rows|0) - h);
      if (cl.col<0) cl.col=0; if (cl.row<0) cl.row=0;
      return cl;
    }
    function visibleLayers(){
      var L = editor.levelsState, list = [];
      for (var name in L.show){ if (L.show[name]) list.push(name); }
      return list;
    }

    // ---- Region I/O ----
    function readRegion(rect){
      var s = rect, sz = selSize(s);
      var L = editor.levelsState, lvl = L.data[L.current|0], cols = L.cols|0;
      var layers = visibleLayers(), data = {}, li, layer, r, c, idx, rows;
      for (li=0; li<layers.length; li++){
        layer = layers[li]; rows = [];
        for (r=0; r<sz.h; r++){
          var arr = [];
          for (c=0; c<sz.w; c++){
            idx = (s.r0+r)*cols + (s.c0+c);
            arr.push(lvl[layer][idx]|0);
          }
          rows.push(arr);
        }
        data[layer] = rows;
      }
      return {w:sz.w, h:sz.h, layers:layers, data:data};
    }
    function writeRegionAt(reg, col, row){
      if (!reg) return false;
      var L = editor.levelsState, lvlIdx=L.current|0, cols=L.cols|0;
      var changes=[], li, layer, r, c, id, t, idx, prev;
      for (li=0; li<reg.layers.length; li++){
        layer=reg.layers[li];
        for (r=0;r<reg.h;r++){
          for (c=0;c<reg.w;c++){
            id = reg.data[layer][r][c]|0;
            if (!id) continue;
            t = clamp((col|0)+c, (row|0)+r);
            idx = (t.row*cols + t.col);
            prev = L.data[lvlIdx][layer][idx]|0;
            if (prev===id) continue;
            changes.push({level:lvlIdx,layer:layer,col:t.col,row:t.row,prev:prev,next:id});
          }
        }
      }
      if (!changes.length) return false;
      if (editor.pushAction) editor.pushAction({type:"setTiles",changes:changes});
      for (var i=0;i<changes.length;i++){
        var ch=changes[i]; editor.setTileRaw(ch.level, ch.layer, ch.col, ch.row, ch.next);
      }
      editor.requestRender && editor.requestRender();
      return true;
    }
    function clearRegion(rect){
      var s=rect, sz=selSize(s);
      var L=editor.levelsState, lvlIdx=L.current|0, cols=L.cols|0;
      var layers=visibleLayers(), changes=[], li, layer, r, c, idx, prev;
      for (li=0; li<layers.length; li++){
        layer=layers[li];
        var buf=L.data[lvlIdx][layer];
        for (r=0;r<sz.h;r++){
          for (c=0;c<sz.w;c++){
            idx=(s.r0+r)*cols+(s.c0+c);
            prev=buf[idx]|0;
            if (!prev) continue;
            changes.push({level:lvlIdx,layer:layer,col:(s.c0+c)|0,row:(s.r0+r)|0,prev:prev,next:0});
          }
        }
      }
      if (!changes.length) return false;
      if (editor.pushAction) editor.pushAction({type:"setTiles",changes:changes});
      for (var j=0;j<changes.length;j++){
        var ch=changes[j]; editor.setTileRaw(ch.level,ch.layer,ch.col,ch.row,ch.next);
      }
      editor.requestRender && editor.requestRender();
      return true;
    }
    function rotateCW(reg){
      if (!reg) return null;
      var out = {w: reg.h|0, h: reg.w|0, layers: reg.layers.slice(0), data:{}};
      var li, layer, r, c, id, nw=out.w, nh=out.h;
      for (li=0; li<reg.layers.length; li++){
        layer = reg.layers[li];
        var dst = new Array(nh);
        for (r=0;r<nh;r++) dst[r] = new Array(nw);
        for (r=0;r<reg.h;r++){
          for (c=0;c<reg.w;c++){
            id = reg.data[layer][r][c]|0;
            dst[c][nw-1-r] = id; // (r,c) -> (c, newW-1-r)
          }
        }
        out.data[layer] = dst;
      }
      return out;
    }
    function deepCopy(reg){
      if (!reg) return null;
      var out = {w: reg.w|0, h: reg.h|0, layers: reg.layers.slice(0), data:{}};
      for (var li=0; li<reg.layers.length; li++){
        var layer=reg.layers[li], rows=new Array(reg.h|0);
        for (var r=0;r<reg.h;r++) rows[r]=reg.data[layer][r].slice(0);
        out.data[layer]=rows;
      }
      return out;
    }
    function ghostCanvasFrom(reg){
      if (!reg) return null;
      var ts = editor.getTileSize ? editor.getTileSize() : 32;
      var wpx = (reg.w|0)*ts, hpx=(reg.h|0)*ts;
      var cv = (typeof OffscreenCanvas!=="undefined") ? new OffscreenCanvas(wpx,hpx)
               : (function(){ var t=document.createElement("canvas"); t.width=wpx; t.height=hpx; return t; })();
      var g = cv.getContext("2d"); var li,layer,r,c,id;
      for (li=0; li<reg.layers.length; li++){
        layer=reg.layers[li];
        for (r=0;r<reg.h;r++){
          for (c=0;c<reg.w;c++){
            id = reg.data[layer][r][c]|0;
            if (!id) continue;
            g.fillStyle = editor.colorForIdLayer ? editor.colorForIdLayer(layer, id) : "#999";
            g.fillRect(c*ts, r*ts, ts, ts);
          }
        }
      }
      return cv;
    }

    // ---- Public: Rechteck-Auswahl ----
    function selBegin(col,row){
      if (!active) return false;
      selecting = true;
      down0 = {col:col|0,row:row|0};
      sel = {c0:col|0,r0:row|0,c1:col|0,r1:row|0};
      emit("select:start", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selUpdate(col,row){
      if (!selecting) return false;
      sel = normRect(down0, {col:col|0,row:row|0});
      emit("select:update", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selEnd(){
      if (!selecting) return false;
      selecting = false;
      emit("select:end", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }

    function getSelection(){ return sel ? {c0:sel.c0,r0:sel.r0,c1:sel.c1,r1:sel.r1} : null; }
    function setSelection(rect){
      if (!rect){ sel=null; editor.requestRender&&editor.requestRender(); return; }
      sel = {c0:rect.c0|0,r0:rect.r0|0,c1:rect.c1|0,r1:rect.r1|0};
      editor.requestRender && editor.requestRender();
    }

    // ---- Public: Classic Move der Auswahl ----
    function selMoveBegin(hitCol, hitRow){
      if (!hasSel()) return false;
      if (!insideSel({col:hitCol|0,row:hitRow|0})) return false;
      moving = true;
      moveStart = {col:hitCol|0,row:hitRow|0};
      moveOffset = {dc:0,dr:0};
      moveSrcRect = {c0:sel.c0, r0:sel.r0, c1:sel.c1, r1:sel.r1};
      moveGhostData = readRegion(moveSrcRect);
      moveGhostCanvas = ghostCanvasFrom(moveGhostData);
      emit("select:move:start", {rect: moveSrcRect});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selMoveUpdate(col,row){
      if (!moving) return false;
      moveOffset.dc = (col|0) - moveStart.col;
      moveOffset.dr = (row|0) - moveStart.row;
      emit("select:move:update", {dc:moveOffset.dc, dr:moveOffset.dr});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selMoveCommit(){
      if (!moving) return false;
      moving = false;
      var changed = moveOffset.dc!==0 || moveOffset.dr!==0;
      if (changed){
        var s = moveSrcRect, src = moveGhostData;
        if (editor.beginCompound) editor.beginCompound("move-selection");
        clearRegion(s);
        var base = clamp(s.c0 + moveOffset.dc, s.r0 + moveOffset.dr);
        writeRegionAt(src, base.col, base.row);
        if (editor.endCompound) editor.endCompound(false);
        sel = {c0:base.col, r0:base.row, c1:base.col+src.w-1, r1:base.row+src.h-1};
      }
      moveOffset={dc:0,dr:0}; moveGhostData=null; moveGhostCanvas=null; moveSrcRect=null; moveStart=null;
      emit("select:move:end", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selMoveCancel(){
      if (!moving) return false;
      moving=false; moveOffset={dc:0,dr:0}; moveGhostData=null; moveGhostCanvas=null; moveSrcRect=null; moveStart=null;
      editor.requestRender && editor.requestRender();
      return true;
    }

    // ---- Public: Floating (Copy/Paste Vorschau) ----
    function selCopy(){
      if (!hasSel()) return false;
      clip = readRegion(sel);
      clipIsCut = false;
      // Floating unmittelbar erzeugen nahe an Auswahl:
      floatData = deepCopy(clip);
      floating = true; floatOffset={dc:0,dr:0};
      floatPos = {col:sel.c0, row:sel.r0};
      sel = {c0:floatPos.col, r0:floatPos.row, c1:floatPos.col+floatData.w-1, r1:floatPos.row+floatData.h-1};
      emit("select:copy", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selCut(){
      if (!hasSel()) return false;
      clip = readRegion(sel);
      clipIsCut = true;
      if (editor.beginCompound) editor.beginCompound("cut-selection");
      clearRegion(sel);
      if (editor.endCompound) editor.endCompound(false);
      // Floating an gleicher Stelle anzeigen:
      floatData = deepCopy(clip);
      floating = true; floatOffset={dc:0,dr:0};
      floatPos = {col:sel.c0, row:sel.r0};
      // Bei CUT lassen wir die Auswahl optisch auf dem Floating
      sel = {c0:floatPos.col, r0:floatPos.row, c1:floatPos.col+floatData.w-1, r1:floatPos.row+floatData.h-1};
      emit("select:cut", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selPasteAt(col,row){
      if (!clip) return false;
      floatData = deepCopy(clip);
      floating = true; clipIsCut=false; floatOffset={dc:0,dr:0};
      var start = findNearbyPlacement(col|0, row|0, floatData.w, floatData.h);
      floatPos = start;
      sel = {c0:start.col, r0:start.row, c1:start.col+floatData.w-1, r1:start.row+floatData.h-1};
      emit("select:paste:float", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selFloatBegin(hitCol, hitRow){
      if (!floating || !floatData) return false;
      var c0=floatPos.col, r0=floatPos.row, c1=c0+floatData.w-1, r1=r0+floatData.h-1;
      if (!insideRect({col:hitCol|0,row:hitRow|0}, c0,r0,c1,r1)) return false;
      floatDragging = true;
      floatDragStart = {col:hitCol|0,row:hitRow|0};
      floatOffset = {dc:0,dr:0};
      emit("select:float:start", {});
      return true;
    }
    function selFloatUpdate(col,row){
      if (!floatDragging) return false;
      floatOffset.dc = (col|0) - floatDragStart.col;
      floatOffset.dr = (row|0) - floatDragStart.row;
      sel = {c0:(floatPos.col+floatOffset.dc)|0, r0:(floatPos.row+floatOffset.dr)|0,
             c1:(floatPos.col+floatOffset.dc+floatData.w-1)|0, r1:(floatPos.row+floatOffset.dr+floatData.h-1)|0};
      emit("select:float:update", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selFloatCommit(){
      if (!floating || !floatData) return false;
      var target = { col: (floatPos.col + floatOffset.dc)|0, row: (floatPos.row + floatOffset.dr)|0 };
      if (editor.beginCompound) editor.beginCompound(clipIsCut ? "paste-from-cut" : "paste-copy");
      writeRegionAt(floatData, target.col, target.row);
      if (editor.endCompound) editor.endCompound(false);
      sel = {c0:target.col, r0:target.row, c1:target.col+floatData.w-1, r1:target.row+floatData.h-1};
      if (clipIsCut){ clip=null; clipIsCut=false; }
      floating=false; floatData=null; floatDragging=false; floatOffset={dc:0,dr:0};
      emit("select:float:commit", {rect: sel});
      editor.requestRender && editor.requestRender();
      return true;
    }
    function selFloatCancel(){
      if (!floating) return false;
      floating=false; floatData=null; floatDragging=false; floatOffset={dc:0,dr:0};
      editor.requestRender && editor.requestRender();
      return true;
    }

    // ---- Public: Edit-Ops ----
    function selRotateCW(){
      if (floating && floatData){
        floatData = rotateCW(floatData);
        sel = {c0:floatPos.col, r0:floatPos.row, c1:floatPos.col+floatData.w-1, r1:floatPos.row+floatData.h-1};
        editor.requestRender && editor.requestRender();
        return true;
      } else if (hasSel()){
        var src = readRegion(sel), rot = rotateCW(src);
        if (editor.beginCompound) editor.beginCompound("rotate-selection");
        clearRegion(sel); writeRegionAt(rot, sel.c0, sel.r0);
        if (editor.endCompound) editor.endCompound(false);
        sel = {c0:sel.c0, r0:sel.r0, c1:sel.c0+rot.w-1, r1:sel.r0+rot.h-1};
        editor.requestRender && editor.requestRender();
        return true;
      }
      return false;
    }
    function selDelete(){
      if (!hasSel()) return false;
      if (editor.beginCompound) editor.beginCompound("delete-selection");
      clearRegion(sel);
      if (editor.endCompound) editor.endCompound(false);
      editor.requestRender && editor.requestRender();
      return true;
    }

    // ---- Overlay-Zeichnung (Canvas 2D, nach applyCamera) ----
    function drawSelectionOverlay(ctx){
      if (!active) return;
      var ts = editor.getTileSize ? editor.getTileSize() : 32;
      ctx.save();

      // Floating Ghost
      if (floating && floatData){
        var fx = (floatPos.col + (floatOffset.dc|0)) * ts;
        var fy = (floatPos.row + (floatOffset.dr|0)) * ts;
        ctx.globalAlpha = 0.5;
        // Direkte Zeichnung ohne Offscreen (nur Kästchen)
        for (var li=0; li<floatData.layers.length; li++){
          var layer = floatData.layers[li];
          for (var r=0; r<floatData.h; r++){
            for (var c=0; c<floatData.w; c++){
              var id = floatData.data[layer][r][c]|0; if (!id) continue;
              ctx.fillStyle = editor.colorForIdLayer ? editor.colorForIdLayer(layer, id) : "#999";
              ctx.fillRect(fx + c*ts, fy + r*ts, ts, ts);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Move-Ghost (klassisch)
      if (moving && moveGhostCanvas){
        var mx = (moveSrcRect.c0 + (moveOffset.dc|0)) * ts;
        var my = (moveSrcRect.r0 + (moveOffset.dr|0)) * ts;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(moveGhostCanvas, mx, my);
        ctx.globalAlpha = 1.0;
      }

      // Marquee
      if (hasSel()){
        var s = sel, w = (s.c1-s.c0+1)*ts, h=(s.r1-s.r0+1)*ts;
        var x = s.c0*ts, y=s.r0*ts;
        ctx.lineWidth = 2 / (editor.getCamera ? (editor.getCamera().z||1) : 1);
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.fillStyle = "rgba(255,255,255,0.09)";
        ctx.fillRect(x,y,w,h);
        ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
      }

      ctx.restore();
    }

    // ---- API exportieren ----
    editor.getSelection        = getSelection;
    editor.setSelection        = setSelection;

    editor.selBegin            = selBegin;
    editor.selUpdate           = selUpdate;
    editor.selEnd              = selEnd;

    editor.selMoveBegin        = selMoveBegin;
    editor.selMoveUpdate       = selMoveUpdate;
    editor.selMoveCommit       = selMoveCommit;
    editor.selMoveCancel       = selMoveCancel;

    editor.selCopy             = selCopy;
    editor.selCut              = selCut;
    editor.selPasteAt          = selPasteAt;
    editor.selFloatBegin       = selFloatBegin;
    editor.selFloatUpdate      = selFloatUpdate;
    editor.selFloatCommit      = selFloatCommit;
    editor.selFloatCancel      = selFloatCancel;

    editor.selRotateCW         = selRotateCW;
    editor.selDelete           = selDelete;

    editor.drawSelectionOverlay= drawSelectionOverlay;

    // Optional: Aufräumen bei Welt-/Level-Resize
    if (typeof editor.on === "function"){
      editor.on("world:resize", function(){ moving=false; floating=false; moveGhostCanvas=null; });
      editor.on("levels:resize", function(){ moving=false; floating=false; moveGhostCanvas=null; });
      editor.on("level:changed", function(){ /* Auswahl behalten ist ok; Floating bleibt relativ */ });
    }
  }

  window.EditorToolSelection = install;
})();
