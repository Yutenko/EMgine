// ui-palette.js — Minimal palette (SPACE), 16×16 thumbs, click outside to close, single tile selection
(function(){
  var modal = null, dialog = null, grid = null;
  var tiles = [];
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
      btn.addEventListener("touchstart", function(e){ e.preventDefault(); onDown(e); }, {passive:false});
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

    // Single tile selection
    var ed = getEditor();
    if (ed && tiles[idx]) {
      var id = tiles[idx].id|0;
      if (ed.setBrushId) ed.setBrushId(id);
      switchToPaint();
      close();
    }
    e.preventDefault();
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
      ed.on("layer:changed", function(){ if (modal && modal.style.display==="flex") open(); });
    }
  }

  if (document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", function(){ if (getEditor()) boot(); else document.addEventListener("editor:ready", boot, {once:true}); });
  } else { if (getEditor()) boot(); else document.addEventListener("editor:ready", boot, {once:true}); }
})();