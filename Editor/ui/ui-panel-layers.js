// ui-panel-layers.js – classic panel + hover highlight (calls setHoverLayer on hover)
(function(){
  function onReady(){
    var editor = window.editor;
    if (!editor){ document.addEventListener("editor:ready", onReady, {once:true}); return; }

    var root = document.getElementById("panel-layers");
    var createdRoot = false;
    if (!root){
      root = document.createElement("div");
      root.id = "panel-layers";
      createdRoot = true;
    }
    root.className = "em-panel";
    root.innerHTML = ""
      + "<div class='hdr'>Level & Layer</div>"
      + "<div class='em-section' id='em-sec-level'></div>"
      + "<div class='em-section' id='em-sec-layers'></div>"
      + "<div class='em-section em-underlay' id='em-sec-underlay'></div>";
    if (createdRoot) document.body.appendChild(root);

    // LEVELS
    var secLevel = root.querySelector("#em-sec-level");
    var levelRow = document.createElement("div");
    levelRow.className = "em-row";
    var levelLabel = document.createElement("div");
    levelLabel.className = "em-label";
    levelLabel.textContent = "Level";
    var levelSelect = document.createElement("select");
    levelSelect.className = "em-select";

    var total = editor.getLevelsCount ? editor.getLevelsCount() : (editor.levelsState.count|0);
    var current = editor.getCurrentLevel ? editor.getCurrentLevel() : (editor.levelsState.current|0);
    var i, opt;
    for (i=0;i<total;i++){
      opt = document.createElement("option");
      opt.value = i;
      opt.text = "Level " + i;
      if (i===current) opt.selected = true;
      levelSelect.appendChild(opt);
    }
    levelSelect.addEventListener("change", function(){
      editor.setCurrentLevel && editor.setCurrentLevel(+levelSelect.value|0);
    });
    levelRow.appendChild(levelLabel);
    levelRow.appendChild(levelSelect);
    secLevel.appendChild(levelRow);

    // LAYERS
    var secLayers = root.querySelector("#em-sec-layers");
    var list = document.createElement("div");
    list.className = "em-layers";
    secLayers.appendChild(list);

    var layers = ["floor","wall","decor","entities"];
    var tint = { floor:"#4FC3F7", wall:"#FF8A65", decor:"#BA68C8", entities:"#FFF176" };

    function makeEye(on){
      var span = document.createElement("span");
      span.className = "em-eye-btn";
      span.title = on ? "Layer sichtbar" : "Layer ausgeblendet";
      var i = document.createElement("span");
      i.className = on ? "em-eye" : "em-eye-off";
      span.appendChild(i);
      return span;
    }

    function renderLayers(){
      list.innerHTML = "";
      var currentLayer = editor.getCurrentLayer ? editor.getCurrentLayer() : (editor.levelsState.layer || layers[0]);
      for (var j=0;j<layers.length;j++){
        (function(name){
          var visible = editor.isLayerVisible ? editor.isLayerVisible(name) : !!editor.levelsState.show[name];
          var row = document.createElement("div");
          row.className = "em-layer" + (name===currentLayer ? " active" : "");
          row.title = "Klicken, um Layer zu aktivieren";

          // hover highlight bindings: set/unset hover layer
          row.addEventListener("mouseenter", function(){ editor.setHoverLayer && editor.setHoverLayer(name); });
          row.addEventListener("mouseleave", function(){ editor.setHoverLayer && editor.setHoverLayer(null); });

          var sw = document.createElement("div");
          sw.className = "em-swatch";
          sw.style.background = tint[name] || "#9E9E9E";

          var radio = document.createElement("div");
          radio.style.width = "16px"; radio.style.height = "16px";
          radio.style.borderRadius = "50%";
          radio.style.border = "2px solid " + (name===currentLayer ? "#fff" : "rgba(255,255,255,0.35)");
          radio.style.boxSizing = "border-box";

          var nameEl = document.createElement("div");
          nameEl.className = "em-name";
          nameEl.textContent = name;

          var eye = makeEye(visible);

          row.addEventListener("click", function(ev){
            if (ev.target === eye || eye.contains(ev.target)) return;
            editor.setCurrentLayer && editor.setCurrentLayer(name);
          });
          eye.addEventListener("click", function(ev){
            ev.stopPropagation();
            var newVal = !(editor.isLayerVisible ? editor.isLayerVisible(name) : !!editor.levelsState.show[name]);
            editor.setLayerVisible && editor.setLayerVisible(name, newVal);
            renderLayers();
          });

          row.appendChild(sw);
          row.appendChild(radio);
          row.appendChild(nameEl);
          row.appendChild(eye);
          list.appendChild(row);
        })(layers[j]);
      }
    }
    renderLayers();

    // UNDERLAY
    var secUnder = root.querySelector("#em-sec-underlay");
    var row1 = document.createElement("div"); row1.className = "em-row";
    var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true;
    var cbLabel = document.createElement("span"); cbLabel.textContent = "Level darunter anzeigen";
    row1.appendChild(cb); row1.appendChild(cbLabel);
    secUnder.appendChild(row1);

    var row2 = document.createElement("div"); row2.className = "em-row";
    var atext = document.createElement("span"); atext.textContent = "Alpha";
    var range = document.createElement("input"); range.type = "range"; range.min="0"; range.max="1"; range.step="0.05"; range.value="0.25";
    var aval = document.createElement("span"); aval.textContent = range.value;
    row2.appendChild(atext); row2.appendChild(range); row2.appendChild(aval);
    secUnder.appendChild(row2);

    cb.addEventListener("change", function(){ editor.setUnderlayPreviewEnabled && editor.setUnderlayPreviewEnabled(!!cb.checked); });
    range.addEventListener("input", function(){ var v = Math.max(0, Math.min(1, +range.value||0)); aval.textContent = v; editor.setUnderlayPreviewAlpha && editor.setUnderlayPreviewAlpha(v); });

    // Sync
    editor.on && editor.on("level:changed", function(ev){
      var idx = ev && ev.level || (editor.getCurrentLevel ? editor.getCurrentLevel() : 0);
      levelSelect.value = idx;
    });
    editor.on && editor.on("layer:changed", function(){ renderLayers(); });
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();