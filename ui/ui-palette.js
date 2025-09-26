// ui-palette.js — Minimal palette (SPACE), 16×16 thumbs, click outside to close, drag-rectangle multi-pick -> brush pattern
(function(){
  var modal = null, dialog = null, grid = null;
  var tiles = [];
  var startIdx = null, currentIdx = null, dragging = false;
  var colCount = 0;

  function getEditor(){ return window.editor; }

  function ensureModal(){
    if (modal) return;
    modal = document.createElement("div");
    modal.className = "tp-modal";
    modal.innerHTML = '<div class="tp-dialog" id="tpDialog"><div class="tp-grid" id="tpGrid"></div></div>';
    document.body.appendChild(modal);
    dialog = modal.querySelector("#tpDialog");
    grid = modal.querySelector("#tpGrid");

    // Close when clicking outside dialog
    modal.addEventListener("mousedown", function(e){ if (e.target === modal) close(); }, false);
    modal.addEventListener("touchstart", function(e){ if (e.target === modal) close(); }, false);

    // Global mouseup to finish selection
    window.addEventListener("mouseup", onUp, false);
    window.addEventListener("touchend", onUp, false);
  }

  function open(){
    var ed = getEditor(); if (!ed) return;
    ensureModal();
    // compute tiles for current layer filter
    var layer = ed.getCurrentLayer ? ed.getCurrentLayer() : "floor";
    tiles = ed.getTilesForLayer ? ed.getTilesForLayer(layer) : (ed.getAllTiles?ed.getAllTiles():[]);
    render();
    modal.style.display = "flex";
  }
  function close(){ if (modal) modal.style.display="none"; }

  function render(){
    var ed = getEditor(); if (!ed) return;
    grid.innerHTML = "";
    var frag = document.createDocumentFragment();
    var i;
    for (i=0;i<tiles.length;i++){
      var t = tiles[i];
      var btn = document.createElement("div");
      btn.className = "tp-cell";
      btn.setAttribute("data-idx", i);
      btn.setAttribute("data-id", t.id);
      var cn = document.createElement("canvas");
      cn.width = 16; cn.height = 16; cn.className = "tp-thumb";
      drawThumb(cn.getContext("2d"), t);
      btn.appendChild(cn);
      btn.addEventListener("mousedown", onDown, false);
      btn.addEventListener("mouseenter", onEnter, false);
      btn.addEventListener("touchstart", function(e){ e.preventDefault(); onDown(e); }, {passive:false});
      btn.addEventListener("touchmove", function(e){ e.preventDefault(); var el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY); if (el){ var p=el.closest('.tp-cell'); if(p) onEnter({currentTarget:p}); } }, {passive:false});
      frag.appendChild(btn);
    }
    grid.appendChild(frag);
    // determine current colCount from CSS grid
    colCount = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  }

  function onDown(e){
    var cell = e.currentTarget;
    var idx = cell ? (cell.getAttribute("data-idx")|0) : null;
    if (idx==null) return;
    clearSelection();
    startIdx = idx; currentIdx = idx; dragging = true;
    updateSelectionVisual();
    e.preventDefault();
  }
  function onEnter(e){
    if (!dragging) return;
    var cell = e.currentTarget;
    if (!cell) return;
    currentIdx = cell.getAttribute("data-idx")|0;
    updateSelectionVisual();
  }
  function onUp(){
    if (!dragging) return;
    dragging = false;
    commitSelection();
  }

  function rectForIndices(a,b){
    var i0 = Math.min(a|0, b|0), i1 = Math.max(a|0, b|0);
    var c0 = i0 % colCount, r0 = (i0 / colCount) | 0;
    var c1 = i1 % colCount, r1 = (i1 / colCount) | 0;
    return {c0:c0,r0:r0,c1:c1,r1:r1};
  }

  function updateSelectionVisual(){
    var r = rectForIndices(startIdx, currentIdx);
    var i;
    var cells = grid.children;
    for (i=0;i<cells.length;i++){
      var c = i % colCount, r0 = (i / colCount)|0;
      var active = (c>=r.c0 && c<=r.c1 && r0>=r.r0 && r0<=r.r1);
      cells[i].className = active ? "tp-cell tp-cell-active" : "tp-cell";
    }
  }
  function clearSelection(){
    var i, cells = grid.children;
    for (i=0;i<cells.length;i++) cells[i].className = "tp-cell";
  }

  function commitSelection(){
    var ed = getEditor(); if (!ed) return;
    var r = rectForIndices(startIdx, currentIdx);
    var w = (r.c1 - r.c0 + 1) | 0;
    var h = (r.r1 - r.r0 + 1) | 0;

    if (w===1 && h===1){
      // single tile -> simple brush id
      var id = tiles[startIdx].id|0;
      if (ed.setBrushId) ed.setBrushId(id);
      switchToPaint();
      close();
      return;
    }

    // build pattern matrix
    var ids = new Array(h);
    var rr, cc;
    for (rr=0; rr<h; rr++){
      var row = new Array(w);
      for (cc=0; cc<w; cc++){
        var idx = (r.r0 + rr)*colCount + (r.c0 + cc);
        var t = tiles[idx];
        row[cc] = t ? (t.id|0) : 0;
      }
      ids[rr] = row;
    }
    if (ed.setBrushPattern) ed.setBrushPattern({w:w,h:h,ids:ids});
    switchToPaint();
    close();
  }

  function switchToPaint(){
    if (typeof window.emSetTool === "function") { window.emSetTool("paint"); return; }
    // Fallback: set flag + event for older toolbars
    window.emToolMode = "paint";
    var evt;
    try { evt = new CustomEvent("em:setTool",{detail:{tool:"paint"}}); }
    catch(e){ var ev=document.createEvent("CustomEvent"); ev.initCustomEvent("em:setTool",true,true,{tool:"paint"}); evt=ev; }
    if (evt) window.dispatchEvent(evt);
  }

  function drawThumb(ctx, t){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,16,16);
    ctx.imageSmoothingEnabled = false;
    var img = t.image, sw,sh,sx,sy;
    if (!img){ ctx.fillStyle="#3e7bd2"; ctx.fillRect(0,0,16,16); return; }
    if (t.type==="atlas"){
      sw=t.tileWidth|0; sh=t.tileHeight|0; sx=(t.col|0)*sw; sy=(t.row|0)*sh;
    } else { sw=img.width|0; sh=img.height|0; sx=0; sy=0; }
    var scale = Math.min(16/sw, 16/sh);
    var dw = Math.max(1, Math.round(sw*scale));
    var dh = Math.max(1, Math.round(sh*scale));
    var dx = (16 - dw) >> 1;
    var dy = (16 - dh) >> 1;
    ctx.drawImage(img, sx,sy, sw,sh, dx,dy, dw,dh);
  }

  function onKey(e){
    if (e.code === "Space" || e.keyCode === 32){
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
      if (tag==="input" || tag==="textarea" || tag==="select" || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      open();
    }
  }

  function boot(){
    window.addEventListener("keydown", onKey, false);
    var ed = getEditor(); if (ed && ed.on){
      ed.on("tiles:catalog:changed", function(){ if (modal && modal.style.display==="flex") open(); });
      ed.on("assetpool:changed", function(){ if (modal && modal.style.display==="flex") open(); });
    }
  }

  if (document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", function(){ if (getEditor()) boot(); else document.addEventListener("editor:ready", boot, {once:true}); });
  } else { if (getEditor()) boot(); else document.addEventListener("editor:ready", boot, {once:true}); }
})();