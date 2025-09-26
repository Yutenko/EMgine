// ui-assets.js — Single toolbar button "Assets": Import + Pool manager in one modal (ES5, auto-init)
(function(){
  var modal = null;
  var tabBar = null;
  var tabImport = null, tabPool = null;
  var sectionImport = null, sectionPool = null;

  // Import refs
  var chipRow = null, customW = null, customH = null, gridChk = null;
  var previewCanvas = null, previewCtx = null;
  var currentTilesetId = null;

  // Pool refs
  var poolTabs = null, poolList = null;
  var currentPoolLayer = "floor";
  var layers = ["floor","wall","decor","entities"];

  var gridOn = true;

  function getEditor(){ return window.editor; }

  function ensureToolbarButton(){
    var bar = document.querySelector(".em-toolbar");
    var btn = document.getElementById("btnAssets");
    if (!btn){
      btn = document.createElement("button");
      btn.id = "btnAssets";
      btn.className = "em-toolbar-btn";
      btn.title = "Assets (Import + Pool)";
      btn.textContent = "Assets";
      if (bar){
        var row = bar.querySelector(".em-toolbar-row");
        if (row) row.appendChild(btn); else bar.appendChild(btn);
      } else {
        btn.style.position = "fixed";
        btn.style.left = "12px";
        btn.style.top = "64px";
        btn.style.zIndex = "10001";
        document.body.appendChild(btn);
      }
    }
    btn.addEventListener("click", function(){ openModal(); }, false);
  }

  function openModal(){
    if (!modal) buildModal();
    switchTab("import");
    modal.style.display = "flex";
    updateTilesetList(); // refresh lists
    renderPoolTabs(); renderPoolTilesets();
  }
  function closeModal(){ if (modal) modal.style.display="none"; }

  function buildModal(){
    modal = document.createElement("div");
    modal.className = "assets-modal";
    modal.innerHTML = ''
      + '<div class="assets-dialog">'
      + '  <div class="assets-header">'
      + '    <div class="assets-title">Assets</div>'
      + '    <div class="assets-tabs" id="assetsTabs">'
      + '      <button class="assets-tab assets-tab-active" data-tab="import">Import</button>'
      + '      <button class="assets-tab" data-tab="pool">Pool</button>'
      + '    </div>'
      + '    <button class="assets-close">×</button>'
      + '  </div>'
      + '  <div class="assets-body">'
      + '    <section class="assets-section" id="assetsImport"></section>'
      + '    <section class="assets-section" id="assetsPool" style="display:none"></section>'
      + '  </div>'
      + '  <div class="assets-footer">'
      + '    <button class="assets-close2">Schließen</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(modal);

    tabBar = modal.querySelector("#assetsTabs");
    sectionImport = modal.querySelector("#assetsImport");
    sectionPool = modal.querySelector("#assetsPool");

    modal.querySelector(".assets-close").addEventListener("click", closeModal, false);
    modal.querySelector(".assets-close2").addEventListener("click", closeModal, false);
    tabBar.addEventListener("click", function(e){
      var t = e.target;
      if (t && t.getAttribute("data-tab")) switchTab(t.getAttribute("data-tab"));
    }, false);

    buildImportSection();
    buildPoolSection();

    // listen to editor events for live refresh
    var ed = getEditor();
    if (ed && ed.on){
      ed.on("tilesets:changed", function(){
        updateTilesetList();
        renderPoolTilesets();
        // keep preview in sync
        if (currentTilesetId){
          var ts = ed.getTilesetById(currentTilesetId);
          if (!ts) currentTilesetId = null;
        }
        drawPreview();
      });
    }
  }

  function switchTab(name){
    var tabs = tabBar.querySelectorAll(".assets-tab"); var i;
    for (i=0;i<tabs.length;i++){
      var n = tabs[i].getAttribute("data-tab");
      if (n===name) tabs[i].className = "assets-tab assets-tab-active";
      else tabs[i].className = "assets-tab";
    }
    sectionImport.style.display = (name==="import") ? "block" : "none";
    sectionPool.style.display   = (name==="pool") ? "block" : "none";
  }

  // ---------- Import UI ----------
  function buildImportSection(){
    sectionImport.innerHTML = ''
      + '<div class="ts-body">'
      + '  <div class="ts-left">'
      + '    <div class="ts-dropzone" id="tsDrop">Bilder hierher ziehen oder auswählen…'
      + '      <input type="file" id="tsFile" accept="image/*" multiple />'
      + '    </div>'
      + '    <div class="ts-url">'
      + '      <input type="text" id="tsUrl" placeholder="Bild-URL (Atlas) eingeben…" />'
      + '      <button id="tsUrlAdd">Hinzufügen</button>'
      + '    </div>'
      + '    <div class="ts-type">'
      + '      <label><input type="radio" name="tsType" value="atlas" checked /> Atlas (Spritesheet)</label>'
      + '      <label><input type="radio" name="tsType" value="collection" /> Collection (Einzelbilder)</label>'
      + '    </div>'
      + '    <div class="ts-chips" id="tsChips"></div>'
      + '    <div class="ts-custom">'
      + '      <label>Custom W <input type="number" id="tsCustomW" min="1" value="32" /></label>'
      + '      <label>H <input type="number" id="tsCustomH" min="1" value="32" /></label>'
      + '      <button id="tsApplyCustom">Übernehmen</button>'
      + '      <label class="ts-gridtoggle"><input type="checkbox" id="tsGridOn" checked /> Grid anzeigen</label>'
      + '    </div>'
      + '  </div>'
      + '  <div class="ts-right">'
      + '    <canvas id="tsPreview"></canvas>'
      + '    <div class="ts-list" id="tsList"></div>'
      + '  </div>'
      + '</div>';

    var drop = sectionImport.querySelector("#tsDrop");
    var file = sectionImport.querySelector("#tsFile");
    var urlIn = sectionImport.querySelector("#tsUrl");
    var urlBtn = sectionImport.querySelector("#tsUrlAdd");
    chipRow = sectionImport.querySelector("#tsChips");
    customW = sectionImport.querySelector("#tsCustomW");
    customH = sectionImport.querySelector("#tsCustomH");
    var customApply = sectionImport.querySelector("#tsApplyCustom");
    var typeToggle = sectionImport.querySelectorAll("input[name='tsType']");
    previewCanvas = sectionImport.querySelector("#tsPreview");
    previewCtx = previewCanvas.getContext("2d");
    var listBox = sectionImport.querySelector("#tsList");
    gridChk = sectionImport.querySelector("#tsGridOn");

    function getType(){
      var i; for (i=0;i<typeToggle.length;i++) if (typeToggle[i].checked) return typeToggle[i].value;
      return "atlas";
    }

    drop.addEventListener("dragover", function(e){ e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }, false);
    drop.addEventListener("drop", function(e){
      e.preventDefault();
      var ed = getEditor(); if (!ed) return;
      var kind = getType();
      if (kind === "collection"){
        ed.addTilesetCollectionFromFiles(e.dataTransfer.files, function(ts){ updateTilesetList(); showPreviewFor(ts); });
      } else {
        var i;
        for (i=0;i<e.dataTransfer.files.length;i++){
          ed.addTilesetFromFile(e.dataTransfer.files[i], function(ts){ updateTilesetList(); showPreviewFor(ts); });
        }
      }
    }, false);

    file.addEventListener("change", function(){
      var ed = getEditor(); if (!ed) return;
      var kind = getType();
      if (kind === "collection"){
        ed.addTilesetCollectionFromFiles(file.files, function(ts){ updateTilesetList(); showPreviewFor(ts); });
      } else {
        var i;
        for (i=0;i<file.files.length;i++){
          ed.addTilesetFromFile(file.files[i], function(ts){ updateTilesetList(); showPreviewFor(ts); });
        }
      }
      file.value = "";
    }, false);

    urlBtn.addEventListener("click", function(){
      var ed = getEditor(); if (!ed) return;
      var u = (urlIn.value||"").trim();
      if (!u) return;
      ed.addTilesetFromUrl(u, function(ts){
        if (!ts){ alert("Konnte Bild nicht laden."); return; }
        updateTilesetList(); showPreviewFor(ts);
      });
      urlIn.value="";
    }, false);

    gridChk.addEventListener("change", function(){ gridOn = !!gridChk.checked; drawPreview(); }, false);

    customApply.addEventListener("click", function(){
      var ed = getEditor(); if (!ed) return;
      var w = Math.max(1, customW.value|0);
      var h = Math.max(1, customH.value|0);
      if (currentTilesetId) ed.setTilesetTileSize(currentTilesetId, w, h);
      drawPreview();
      updateChipsFromCurrent();
      updateTilesetList();
    }, false);

    function updateTilesetList(){
      var ed = getEditor(); if (!ed) return;
      var arr = ed.getTilesets();
      var html = "";
      var i, ts;
      for (i=0;i<arr.length;i++){
        ts = arr[i];
        if (ts.type==="atlas"){
          html += '<div class="ts-item">'
            + '<div class="ts-item-title">'+escapeHtml(ts.name)+' ('+ts.tileWidth+'×'+ts.tileHeight+')</div>'
            + '<div class="ts-item-actions">'
            + '  <button data-act="remove" data-id="'+ts.id+'">Entfernen</button>'
            + '</div>'
            + '</div>';
        } else {
          html += '<div class="ts-item">'
            + '<div class="ts-item-title">'+escapeHtml(ts.name)+' (Collection: '+(ts.images?ts.images.length:0)+' imgs)</div>'
            + '<div class="ts-item-actions">'
            + '  <button data-act="remove" data-id="'+ts.id+'">Entfernen</button>'
            + '</div>'
            + '</div>';
        }
      }
      listBox.innerHTML = html;

      listBox.addEventListener("click", function(evt){
        var btn = evt.target;
        while (btn && btn !== listBox && (!btn.getAttribute || !btn.getAttribute("data-act"))) btn = btn.parentNode;
        if (!btn || btn === listBox) return;
        var ed = getEditor(); if (!ed) return;
        var act = btn.getAttribute("data-act");
        var id = btn.getAttribute("data-id")|0;
        if (act === "remove"){
          ed.removeTileset(id);
          if (currentTilesetId===id){ currentTilesetId=null; if (sectionImport && sectionImport._drawPreview) sectionImport._drawPreview(); }
          if (sectionImport && sectionImport._updateTilesetList) sectionImport._updateTilesetList();
          renderPoolTilesets();
        }
      }, false);
    }
    sectionImport._updateTilesetList = updateTilesetList;

    function showPreviewFor(ts){
      currentTilesetId = ts.id;
      if (ts.type==="atlas"){
        buildChipsFromDetected(ts);
        customW.value = ts.tileWidth|0;
        customH.value = ts.tileHeight|0;
      } else {
        chipRow.innerHTML = "";
      }
      drawPreview();
    }

    function buildChipsFromDetected(ts){
      var html = "";
      var i, s;
      var det = ts.detectedSizes || [];
      var limited = det.slice(0, 8);
      var std = [8,12,16,24,32,48,64];
      var present = {};
      for (i=0;i<limited.length;i++){ present[limited[i].w+"x"+limited[i].h] = true; }
      for (i=0;i<std.length;i++){
        var key = std[i]+"x"+std[i];
        if (!present[key]) limited.push({ w:std[i], h:std[i], score:0 });
      }
      for (i=0;i<limited.length;i++){
        s = limited[i];
        html += '<button class="ts-chip" data-w="'+s.w+'" data-h="'+s.h+'">'+(s.w+'×'+s.h)+'</button>';
      }
      html += '<button class="ts-chip ts-chip-custom" data-w="0" data-h="0">Custom…</button>';
      chipRow.innerHTML = html;

      updateChipsFromCurrent();

      var chips = chipRow.querySelectorAll(".ts-chip");
      for (i=0;i<chips.length;i++){
        chips[i].addEventListener("click", function(){
          var ed = getEditor(); if (!ed) return;
          var w = this.getAttribute("data-w")|0;
          var h = this.getAttribute("data-h")|0;
          if (w>0 && h>0){
            ed.setTilesetTileSize(currentTilesetId, w, h);
            customW.value = w;
            customH.value = h;
            drawPreview();
            updateTilesetList();
            updateChipsFromCurrent();
          } else {
            customW.focus();
          }
        }, false);
      }
    }

    function updateChipsFromCurrent(){
      var ed = getEditor(); if (!ed) return;
      var ts = ed.getTilesetById(currentTilesetId);
      if (!ts) return;
      var chips = chipRow.querySelectorAll(".ts-chip");
      var i, w, h, cls;
      for (i=0;i<chips.length;i++){
        w = chips[i].getAttribute("data-w")|0;
        h = chips[i].getAttribute("data-h")|0;
        cls = "ts-chip";
        if (w===ts.tileWidth && h===ts.tileHeight) cls += " ts-chip-active";
        if (chips[i].className !== cls) chips[i].className = cls;
      }
    }

    function drawPreview(){
      var ed = getEditor(); if (!ed) return;
      var ts = currentTilesetId ? ed.getTilesetById(currentTilesetId) : null;
      var cssW = 520, cssH = 320;
      previewCanvas.width = cssW;
      previewCanvas.height = cssH;
      previewCtx.setTransform(1,0,0,1,0,0);
      previewCtx.clearRect(0,0,cssW,cssH);
      previewCtx.fillStyle = "#0f1217";
      previewCtx.fillRect(0,0,cssW,cssH);

      if (!ts){
        previewCtx.fillStyle = "#9aa7bd"; previewCtx.font = "14px system-ui, sans-serif";
        previewCtx.fillText("Noch kein Tileset ausgewählt.", 12, 20);
        return;
      }
      if (ts.type==="atlas"){
        var img = ts.image; if (!img) return;
        var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        var scale = Math.min(cssW/iw, cssH/ih, 1);
        var dx = (cssW - iw*scale)/2;
        var dy = (cssH - ih*scale)/2;
        previewCtx.imageSmoothingEnabled = false;
        previewCtx.drawImage(img, 0,0, iw,ih, dx,dy, iw*scale, ih*scale);
        if (gridOn){
          var tw = ts.tileWidth|0, th = ts.tileHeight|0;
          if (tw>0 && th>0){
            var gx = dx, gy = dy, gw = iw*scale, gh = ih*scale, x, y;
            previewCtx.save(); previewCtx.globalAlpha = 0.75; previewCtx.strokeStyle = "#2f3340"; previewCtx.lineWidth=1;
            var stepX = tw*scale, stepY = th*scale;
            for (x=0; x<=gw+0.5; x+=stepX){
              previewCtx.beginPath(); previewCtx.moveTo(Math.round(gx+x)+0.5, Math.round(gy)+0.5); previewCtx.lineTo(Math.round(gx+x)+0.5, Math.round(gy+gh)+0.5); previewCtx.stroke();
            }
            for (y=0; y<=gh+0.5; y+=stepY){
              previewCtx.beginPath(); previewCtx.moveTo(Math.round(gx)+0.5, Math.round(gy+y)+0.5); previewCtx.lineTo(Math.round(gx+gw)+0.5, Math.round(gy+y)+0.5); previewCtx.stroke();
            }
            previewCtx.restore();
          }
        }
      } else {
        var pad = 8, x0 = pad, y0 = pad, x = x0, y = y0, maxH = 0, i;
        for (i=0;i<(ts.images?ts.images.length:0);i++){
          var im = ts.images[i];
          var w = Math.min(96, im.width), h = im.height * (w / im.width);
          if (x + w + pad > cssW){ x = x0; y += maxH + pad; maxH = 0; }
          previewCtx.drawImage(im, 0,0, im.width,im.height, x,y, w,h);
          x += w + pad;
          if (h > maxH) maxH = h;
        }
      }
    }

    // initial
    sectionImport._drawPreview = drawPreview;
    sectionImport._updateTilesetList = updateTilesetList;
    updateTilesetList();
  }

  // ---------- Pool UI ----------
  function buildPoolSection(){
    sectionPool.innerHTML = ''
      + '<div class="ap-tabs" id="apTabs"></div>'
      + '<div class="ap-list" id="apList"></div>';

    poolTabs = sectionPool.querySelector("#apTabs");
    poolList = sectionPool.querySelector("#apList");
  }

  function renderPoolTabs(){
    var i, l, html='';
    for (i=0;i<layers.length;i++){
      l = layers[i];
      html += '<button class="ap-tab'+(l===currentPoolLayer?' ap-tab-active':'')+'" data-layer="'+l+'">'+l.toUpperCase()+'</button>';
    }
    poolTabs.innerHTML = html;
    var btns = poolTabs.querySelectorAll(".ap-tab"); var k;
    for (k=0;k<btns.length;k++){
      btns[k].addEventListener("click", function(){
        currentPoolLayer = this.getAttribute("data-layer");
        renderPoolTabs(); renderPoolTilesets();
      }, false);
    }
  }

  function renderPoolTilesets(){
    var ed = getEditor(); if (!ed) return;
    var arr = ed.getTilesets ? ed.getTilesets() : [];
    var allow = ed.getAllowedTilesets ? ed.getAllowedTilesets(currentPoolLayer) : [];
    var i, ts, html='';
    for (i=0;i<arr.length;i++){
      ts = arr[i];
      var checked = indexOf(allow, ts.id)!==-1 ? ' checked' : '';
      html += '<label class="ap-item"><input type="checkbox" data-id="'+ts.id+'"'+checked+'/> '+escapeHtml(ts.name)+' <span class="ap-meta">['+(ts.type==="atlas"?(ts.tileWidth+'×'+ts.tileHeight):('Collection '+(ts.images?ts.images.length:0)))+']</span></label>';
    }
    if (!arr.length) html = '<div class="ap-empty">Noch keine Tilesets importiert.</div>';
    poolList.innerHTML = html;

    var boxes = poolList.querySelectorAll("input[type=checkbox]"); var j;
    for (j=0;j<boxes.length;j++){
      boxes[j].addEventListener("change", function(){
        var ed = getEditor(); if (!ed) return;
        var id = this.getAttribute("data-id")|0;
        if (this.checked) ed.addAllowedTileset(currentPoolLayer, id);
        else ed.removeAllowedTileset(currentPoolLayer, id);
      }, false);
    }
  }

  var _updateTilesetListQueued = false;
  function updateTilesetList(){
    if (_updateTilesetListQueued) return; _updateTilesetListQueued = true;
    requestAnimationFrame(function(){
      _updateTilesetListQueued = false;
      if (sectionImport && sectionImport._updateTilesetList) sectionImport._updateTilesetList();
    });
  }

  // helpers
  function indexOf(a,v){ var i; for (i=0;i<a.length;i++) if (a[i]===v) return i; return -1; }
  function escapeHtml(s){ return (s+"").replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }

  // boot
  function boot(){ ensureToolbarButton(); }
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ if (getEditor()) boot(); else document.addEventListener("editor:ready", boot, { once:true }); });
  } else {
    if (getEditor()) boot(); else document.addEventListener("editor:ready", boot, { once:true });
  }
})();