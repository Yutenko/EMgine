// ui-selection.js – Selection tool (ES5), stable marquee rendering, repeated copy, paste button
(function(){
  var TOOL_NAME = "select";

  function onReady(){
    var editor = window.editor;
    if (!editor){ document.addEventListener("editor:ready", onReady, {once:true}); return; }

    var canvas = editor.getCanvas();
    var active = false;

    // Selection state
    var sel = null;                    // {c0,r0,c1,r1}
    var selecting = false;

    // Classic move of selection (cut+paste on release)
    var draggingSel = false;
    var dragStartSel = null;           // {col,row}
    var dragOffsetSel = {dc:0, dr:0};
    var moveGhostData = null;          // region data captured at move start
    var moveGhostCanvas = null;        // rendered ghost for move
    var selStartForMove = null;        // selection rect snapshot at move start

    // Floating selection (copy/paste ghost not yet committed to world)
    var floating = false;
    var floatData = null;              // {w,h,layers[],data{}}
    var floatPos = {col:0,row:0};
    var floatDragging = false;
    var floatDragStart = null;
    var floatDragOffset = {dc:0,dr:0};

    // Clipboard
    var clip = null;
    var clipIsCut = false;

    var lastMouseTile = null;

    // ---- Helpers ----
    function normSel(a,b){
      var c0 = Math.min(a.col|0, b.col|0);
      var r0 = Math.min(a.row|0, b.row|0);
      var c1 = Math.max(a.col|0, b.col|0);
      var r1 = Math.max(a.row|0, b.row|0);
      return {c0:c0,r0:r0,c1:c1,r1:r1};
    }
    function hasSel(){ return !!sel && sel.c1>=sel.c0 && sel.r1>=sel.r0; }
    function selSize(s){ return {w:(s.c1-s.c0+1), h:(s.r1-s.r0+1)}; }
    function tileFromEvent(e){ return editor.clientToTile ? editor.clientToTile(e) : null; }
    function insideRect(t, c0,r0,c1,r1){ if(!t) return false; return t.col>=c0 && t.col<=c1 && t.row>=r0 && t.row<=r1; }
    function insideSel(t){ return hasSel() && insideRect(t, sel.c0, sel.r0, sel.c1, sel.r1); }
    function insideFloat(t){
      if (!floating || !floatData) return false;
      var c0=floatPos.col, r0=floatPos.row, c1=c0+floatData.w-1, r1=r0+floatData.h-1;
      return insideRect(t, c0,r0,c1,r1);
    }
    function clampToWorld(col,row){
      var w = editor.getWorld();
      col = Math.max(0, Math.min((w.cols|0)-1, col|0));
      row = Math.max(0, Math.min((w.rows|0)-1, row|0));
      return {col:col,row:row};
    }
    function regionFits(col,row,w,h){
      var WW = editor.getWorld();
      return col>=0 && row>=0 && (col+w)<=WW.cols && (row+h)<=WW.rows;
    }
    function findNearbyPlacement(baseC, baseR, w, h){
      if (regionFits(baseC, baseR, w, h)) return {col:baseC,row:baseR};
      var maxRadius = 6, r, dc, dr;
      for (r=1; r<=maxRadius; r++){
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
      var cl = clampToWorld(baseC, baseR);
      var WW = editor.getWorld();
      cl.col = Math.min(cl.col, (WW.cols|0) - w);
      cl.row = Math.min(cl.row, (WW.rows|0) - h);
      if (cl.col<0) cl.col=0;
      if (cl.row<0) cl.row=0;
      return cl;
    }
    function visibleLayerNames(){
      var L = editor.levelsState, list = [];
      for (var name in L.show){ if (L.show[name]) list.push(name); }
      return list;
    }

    // ---- Data I/O (multi-layer) ----
    function readRegion(rect){
      var s = rect, sz = selSize(s);
      var L = editor.levelsState, lvl = L.data[L.current|0];
      var layers = visibleLayerNames();
      var data = {}, li, layer, r, c, idx, rows;
      for (li=0; li<layers.length; li++){
        layer = layers[li];
        rows = [];
        for (r=0; r<sz.h; r++){
          var arr = [];
          for (c=0; c<sz.w; c++){
            idx = (s.r0+r)*(L.cols|0) + (s.c0+c);
            arr.push(lvl[layer][idx]|0);
          }
          rows.push(arr);
        }
        data[layer] = rows;
      }
      return {w:sz.w, h:sz.h, layers:layers, data:data};
    }
    function clearRegion(rect){
      var s=rect, sz=selSize(s);
      var L=editor.levelsState, lvlIdx=L.current|0, cols=L.cols|0;
      var layers=visibleLayerNames(), changes=[], li, layer, r, c, idx, prev;
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
      for (var i=0;i<changes.length;i++){ var ch=changes[i]; editor.setTileRaw(ch.level, ch.layer, ch.col, ch.row, ch.next); }
      editor.requestRender();
      return true;
    }
    function writeRegionAt(reg, col, row){
      if (!reg) return false;
      var L=editor.levelsState, lvlIdx=L.current|0, cols=L.cols|0;
      var changes=[], li, layer, r, c, id, t, idx, prev;
      for (li=0; li<reg.layers.length; li++){
        layer=reg.layers[li];
        for (r=0;r<reg.h;r++){
          for (c=0;c<reg.w;c++){
            id = reg.data[layer][r][c]|0;
            t = clampToWorld((col|0)+c, (row|0)+r);
            idx = (t.row*(cols|0) + t.col);
            prev = L.data[lvlIdx][layer][idx]|0;
            if (prev===id) continue;
            changes.push({level:lvlIdx,layer:layer,col:t.col,row:t.row,prev:prev,next:id});
          }
        }
      }
      if (!changes.length) return false;
      if (editor.pushAction) editor.pushAction({type:"setTiles",changes:changes});
      for (var i=0;i<changes.length;i++){ var ch=changes[i]; editor.setTileRaw(ch.level, ch.layer, ch.col, ch.row, ch.next); }
      editor.requestRender();
      return true;
    }
    function rotateDataCW(reg){
      if (!reg) return null;
      var out = {w: reg.h, h: reg.w, layers: reg.layers.slice(), data:{}};
      var r,c,layer,id,nw=out.w, nh=out.h;
      for (var li=0; li<reg.layers.length; li++){
        layer = reg.layers[li];
        var dst = new Array(nh);
        for (r=0;r<nh;r++) dst[r]=new Array(nw);
        for (r=0;r<reg.h;r++){
          for (c=0;c<reg.w;c++){
            id = reg.data[layer][r][c]|0;
            dst[c][nw-1-r] = id; // (r,c) -> (c, newW-1-r)
          }
        }
        out.data[layer]=dst;
      }
      return out;
    }
    function deepCopyRegion(reg){
      if (!reg) return null;
      var out = { w: reg.w|0, h: reg.h|0, layers: reg.layers.slice(0), data: {} };
      for (var li=0; li<reg.layers.length; li++){
        var layer = reg.layers[li];
        var rows = new Array(reg.h|0);
        for (var r=0; r<reg.h; r++){ rows[r] = reg.data[layer][r].slice(0); }
        out.data[layer] = rows;
      }
      return out;
    }

    // ---- Mini toolbar ----
    var ui = document.createElement("div");
    ui.className = "selection-mini";
    ui.style.display = "none";
    ui.innerHTML = ''
      + '<button type="button" data-act="copy"  title="Kopieren (Strg+C)">⧉</button>'
      + '<button type="button" data-act="paste" title="Einfügen (Strg+V)">📋</button>'
      + '<button type="button" data-act="cut"   title="Ausschneiden (Strg+X)">✂</button>'
      + '<button type="button" data-act="rot"   title="Rotieren 90°">⟳</button>';
    document.body.appendChild(ui);

    function placeMiniToolbar(){
      if (!hasSel()){ ui.style.display="none"; return; }
      var ts = editor.getTileSize();
      var wx = sel.c0 * ts, wy = sel.r0 * ts;
      var p = editor.worldToScreen(wx, wy);
      var rect = canvas.getBoundingClientRect();
      ui.style.left = (rect.left + p.x + 6) + "px";
      ui.style.top  = (rect.top  + p.y - 30) + "px";
      ui.style.display = active ? "block" : "none";
    }
    function hideMini(){ ui.style.display="none"; }

    ui.addEventListener("click", function(e){
      var a = e.target && e.target.getAttribute("data-act");
      if (!a) return;

      if (a==="copy"){
        if (!hasSel()) return;
        // Wenn bereits eine Floating-Kopie existiert: nichts weiter tun (max. 1 aktive Kopie)
        if (floating && floatData){ placeMiniToolbar(); return; }

        var src = readRegion(sel);
        var baseCol = sel.c0 + 1, baseRow = sel.r0 + 1;
        var sz = selSize(sel);
        if (sz.w===1 && sz.h===1 && lastMouseTile){ baseCol=lastMouseTile.col; baseRow=lastMouseTile.row; }

        floatData = deepCopyRegion(src);
        floating = true; clipIsCut=false;
        var start = findNearbyPlacement(baseCol, baseRow, floatData.w, floatData.h);
        floatPos = {col:start.col,row:start.row};
        floatDragOffset = {dc:0, dr:0};

        // Auswahl folgt der Floating-Box
        sel = {c0:floatPos.col, r0:floatPos.row, c1:floatPos.col+floatData.w-1, r1:floatPos.row+floatData.h-1};
        editor.requestRender();
        placeMiniToolbar();
        return;
      } else if (a==="paste"){
        var t = lastMouseTile;
        if (!t){
          var r = canvas.getBoundingClientRect();
          t = editor.clientToTile({clientX:r.left+10, clientY:r.top+10});
        }
        if (floating && floatData){
          if (editor.beginCompound) editor.beginCompound(clipIsCut ? "paste-from-cut" : "paste-copy");
          writeRegionAt(floatData, (floatPos.col + (floatDragOffset.dc|0))|0, (floatPos.row + (floatDragOffset.dr|0))|0);
          if (editor.endCompound) editor.endCompound(false);
          sel = {c0:(floatPos.col + (floatDragOffset.dc|0))|0, r0:(floatPos.row + (floatDragOffset.dr|0))|0,
                 c1:(floatPos.col + (floatDragOffset.dc|0) + floatData.w -1)|0, r1:(floatPos.row + (floatDragOffset.dr|0) + floatData.h -1)|0};
          floating=false; floatData=null; floatDragOffset={dc:0,dr:0};
          editor.requestRender();
        } else if (clip){
          pasteClipboardAsFloating(t ? t.col : 0, t ? t.row : 0);
        }
        placeMiniToolbar();
        return;
      } else if (a==="cut"){
        cutSelection();
        placeMiniToolbar();
        return;
      } else if (a==="rot"){
        if (floating && floatData){
          floatData = rotateDataCW(floatData);
          sel = {c0:floatPos.col, r0:floatPos.row, c1:floatPos.col+floatData.w-1, r1:floatPos.row+floatData.h-1};
          editor.requestRender();
        } else if (hasSel()){
          var src2 = readRegion(sel);
          var rot = rotateDataCW(src2);
          if (editor.beginCompound) editor.beginCompound("rotate-selection");
          clearRegion(sel);
          writeRegionAt(rot, sel.c0, sel.r0);
          if (editor.endCompound) editor.endCompound(false);
          sel = {c0:sel.c0, r0:sel.r0, c1:sel.c0+rot.w-1, r1:sel.r0+rot.h-1};
          editor.requestRender();
        }
        placeMiniToolbar();
        return;
      }
    });

    // ---- Overlay drawing ----
    if (!editor.selectionOverlayPatched){
      var origDraw = editor.draw;
      editor.draw = function(ctx){ if (typeof origDraw==="function") origDraw(ctx); drawOverlay(ctx); };
      editor.selectionOverlayPatched = true;
    }

    function drawOverlay(ctx){
      if (!active) return;
      var ts = editor.getTileSize();
      ctx.save();

      // Floating ghost content
      if (floating && floatData){
        var fx = floatPos.col*ts + floatDragOffset.dc*ts;
        var fy = floatPos.row*ts + floatDragOffset.dr*ts;
        ctx.globalAlpha = 0.5;
        for (var li=0; li<floatData.layers.length; li++){
          var layer = floatData.layers[li];
          for (var r=0; r<floatData.h; r++){
            for (var c=0; c<floatData.w; c++){
              var id = floatData.data[layer][r][c]|0;
              if (!id) continue;
              ctx.fillStyle = editor.colorForIdLayer(layer, id);
              ctx.fillRect(fx + c*ts, fy + r*ts, ts, ts);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Classic move ghost
      if (draggingSel && moveGhostCanvas){
        var mx = selStartForMove.c0*ts + dragOffsetSel.dc*ts;
        var my = selStartForMove.r0*ts + dragOffsetSel.dr*ts;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(moveGhostCanvas, mx, my);
        ctx.globalAlpha = 1.0;
      }

      // Selection marquee
      if (hasSel()){
        var s = sel;
        var w = (s.c1-s.c0+1)*ts, h=(s.r1-s.r0+1)*ts;
        var x = s.c0*ts, y=s.r0*ts;

        if (draggingSel && selStartForMove){
          x = selStartForMove.c0*ts + dragOffsetSel.dc*ts;
          y = selStartForMove.r0*ts + dragOffsetSel.dr*ts;
        }
        if (floating && floatData){
          x = floatPos.col*ts + floatDragOffset.dc*ts;
          y = floatPos.row*ts + floatDragOffset.dr*ts;
          w = floatData.w*ts; h=floatData.h*ts;
        }

        ctx.lineWidth = 2 / editor.getCamera().z;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(x,y,w,h);
        ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
      }

      ctx.restore();
      placeMiniToolbar();
    }

    // ---- Tool switch ----
    window.addEventListener("em:setTool", function(ev){
      var t = ev && ev.detail && ev.detail.tool;
      var nowActive = (t === TOOL_NAME);
      if (nowActive === active) return;
      active = nowActive;
      if (!active){
        sel = null; selecting=false;
        draggingSel=false; dragStartSel=null; dragOffsetSel={dc:0,dr:0};
        moveGhostData=null; moveGhostCanvas=null; selStartForMove=null;
        floating=false; floatData=null; floatPos={col:0,row:0};
        floatDragging=false; floatDragStart=null; floatDragOffset={dc:0,dr:0};
        canvas.style.cursor = "";
        hideMini();
      }
      editor.requestRender();
    });

    // ---- Pointer ----
    canvas.addEventListener("pointerdown", function(e){
      if (!active) return;
      var t = tileFromEvent(e); lastMouseTile = t;
      if (!t) return;
      canvas.setPointerCapture(e.pointerId);

      // Floating drag start if inside
      if (floating && insideFloat(t)){
        floatDragging = true;
        floatDragStart = {col:t.col, row:t.row};
        floatDragOffset = {dc:0, dr:0};
        e.preventDefault();
        return;
      }

      // Click outside: deselect then continue to start new selection
      if (hasSel() && !insideSel(t)){
        sel = null;
      }

      // Classic move start if inside selection (and no floating)
      if (!floating && hasSel() && insideSel(t)){
        draggingSel = true;
        dragStartSel = {col:t.col, row:t.row};
        dragOffsetSel = {dc:0, dr:0};
        selStartForMove = {c0:sel.c0, r0:sel.r0, c1:sel.c1, r1:sel.r1};
        moveGhostData = readRegion(sel);
        moveGhostCanvas = buildGhostFromData(moveGhostData);
        e.preventDefault();
        return;
      }

      // Start new selection
      selecting = true;
      sel = normSel(t, t);
      dragOffsetSel = {dc:0, dr:0};
      moveGhostData=null; moveGhostCanvas=null; selStartForMove=null;
      editor.requestRender();
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", function(e){
      var t = tileFromEvent(e); lastMouseTile = t;

      // Cursor: move when over selection/floating
      var overMove = false;
      if (floating && t && insideFloat(t)) overMove = true;
      else if (!floating && t && hasSel() && insideSel(t)) overMove = true;
      canvas.style.cursor = (active && overMove) ? "move" : (active ? "" : "");

      if (!active) return;

      if (selecting && t){
        sel = normSel({col:sel.c0,row:sel.r0}, t);
        editor.requestRender();
      } else if (floatDragging && t){
        floatDragOffset.dc = (t.col - floatDragStart.col)|0;
        floatDragOffset.dr = (t.row - floatDragStart.row)|0;
        sel = {c0:(floatPos.col+floatDragOffset.dc)|0, r0:(floatPos.row+floatDragOffset.dr)|0,
               c1:(floatPos.col+floatDragOffset.dc+(floatData?floatData.w:1)-1)|0, r1:(floatPos.row+floatDragOffset.dr+(floatData?floatData.h:1)-1)|0};
        editor.requestRender();
      } else if (draggingSel && t){
        dragOffsetSel.dc = (t.col - dragStartSel.col)|0;
        dragOffsetSel.dr = (t.row - dragStartSel.row)|0;
        editor.requestRender();
      }
    });

    canvas.addEventListener("pointerup", function(e){
      if (!active) return;
      canvas.releasePointerCapture(e.pointerId);

      // Floating commit
      if (floatDragging && floatData){
        floatDragging = false;
        var target = { col: (floatPos.col + floatDragOffset.dc)|0, row: (floatPos.row + floatDragOffset.dr)|0 };
        if (editor.beginCompound) editor.beginCompound(clipIsCut ? "paste-from-cut" : "paste-copy");
        writeRegionAt(floatData, target.col, target.row);
        if (editor.endCompound) editor.endCompound(false);
        sel = {c0:target.col, r0:target.row, c1:target.col+floatData.w-1, r1:target.row+floatData.h-1};
        if (clipIsCut){ sel=null; clip=null; clipIsCut=false; }
        floating=false; floatData=null; floatDragOffset={dc:0,dr:0};
        editor.requestRender();
        return;
      }

      // Classic move commit
      if (draggingSel && hasSel()){
        draggingSel = false;
        if (dragOffsetSel.dc!==0 || dragOffsetSel.dr!==0){
          var s = selStartForMove;
          var src = moveGhostData;
          if (editor.beginCompound) editor.beginCompound("move-selection");
          clearRegion(s);
          var base = clampToWorld(s.c0+dragOffsetSel.dc, s.r0+dragOffsetSel.dr);
          writeRegionAt(src, base.col, base.row);
          if (editor.endCompound) editor.endCompound(false);
          sel = {c0:base.col, r0:base.row, c1:base.col+src.w-1, r1:base.row+src.h-1};
        }
        dragOffsetSel={dc:0,dr:0};
        moveGhostData=null; moveGhostCanvas=null; selStartForMove=null;
        editor.requestRender();
      }

      selecting = false;
    });

    canvas.addEventListener("pointerleave", function(){
      selecting = false;
      draggingSel = false;
      floatDragging = false;
      dragOffsetSel = {dc:0,dr:0};
      floatDragOffset = {dc:0,dr:0};
      canvas.style.cursor = "";
    });

    // ---- Shortcuts ----
    window.addEventListener("keydown", function(e){
      if (!active) return;
      var key = (e.key || "").toLowerCase();
      var mod = e.ctrlKey || e.metaKey;

      if (mod && key==="c"){ if (hasSel()) { clipIsCut=false; clip = readRegion(sel); } e.preventDefault(); }
      else if (mod && key==="x"){ if (hasSel()) { clipIsCut=true; clip = readRegion(sel); if (editor.beginCompound) editor.beginCompound('cut-selection'); clearRegion(sel); if (editor.endCompound) editor.endCompound(false); editor.requestRender(); } e.preventDefault(); }
      else if (mod && key==="v"){
        var t = lastMouseTile;
        if (!t){
          var r = canvas.getBoundingClientRect();
          t = editor.clientToTile({clientX:r.left+10, clientY:r.top+10});
        }
        if (clip){ // start floating from clipboard near mouse
          floatData = deepCopyRegion(clip);
          floating = true; clipIsCut=false;
          var start = findNearbyPlacement(t ? t.col : 0, t ? t.row : 0, floatData.w, floatData.h);
          floatPos = {col:start.col,row:start.row};
          sel = {c0:floatPos.col, r0:floatPos.row, c1:floatPos.col+floatData.w-1, r1:floatPos.row+floatData.h-1};
          editor.requestRender();
        }
        e.preventDefault();
      }
      else if (key==="delete" || key==="backspace"){
        if (hasSel()){
          if (editor.beginCompound) editor.beginCompound("delete-selection");
          clearRegion(sel);
          if (editor.endCompound) editor.endCompound(false);
          editor.requestRender();
        }
        e.preventDefault();
      }
      else if (key==="escape"){
        if (floating){ floating=false; floatData=null; floatDragOffset={dc:0,dr:0}; }
        sel=null;
        moveGhostData=null; moveGhostCanvas=null; selStartForMove=null;
        editor.requestRender();
        e.preventDefault();
      }
      else if (key==="enter" || key==="return"){
        if (floating && floatData){
          if (editor.beginCompound) editor.beginCompound(clipIsCut ? "paste-from-cut" : "paste-copy");
          writeRegionAt(floatData, floatPos.col + floatDragOffset.dc, floatPos.row + floatDragOffset.dr);
          if (editor.endCompound) editor.endCompound(false);
          if (clipIsCut){ sel=null; clip=null; clipIsCut=false; } else {
            sel = {c0:floatPos.col+floatDragOffset.dc, r0:floatPos.row+floatDragOffset.dr,
                   c1:floatPos.col+floatDragOffset.dc+floatData.w-1, r1:floatPos.row+floatDragOffset.dr+floatData.h-1};
          }
          floating=false; floatData=null; floatDragOffset={dc:0,dr:0};
          editor.requestRender();
          e.preventDefault();
        }
      }
    });

    // External activation (toolbar)
    window.emSelectToolActivate = function(){
      var evt = null;
      try { evt = new CustomEvent("em:setTool", {detail:{tool:TOOL_NAME}}); } catch(e){}
      if (evt) window.dispatchEvent(evt);
    };
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();