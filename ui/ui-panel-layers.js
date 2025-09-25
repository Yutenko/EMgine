// ui-panel-layers.js – Level/Layer Panel (ES5)
(function(){
  function onReady(){
    if (!window.editor){
      document.addEventListener("editor:ready", onReady, {once:true});
      return;
    }
    var editor = window.editor;

    var panel = document.createElement("div");
    panel.id = "level-panel";
    document.body.appendChild(panel);

    var title = document.createElement("div");
    title.className = "lp-title";
    title.textContent = "Level & Layers";
    panel.appendChild(title);

    var status = document.createElement("div");
    status.id = "lp-status";
    status.className = "lp-row small";
    status.innerHTML = 'Aktiver Layer: <strong id="lp-active-name"></strong>';
    panel.appendChild(status);

    var warn = document.createElement("div");
    warn.id = "lp-hidden-warning";
    warn.className = "lp-row warn";
    warn.textContent = "Layer versteckt – Zeichnen deaktiviert";
    warn.style.display = "none";
    panel.appendChild(warn);

    var rowLevel = document.createElement("div");
    rowLevel.className = "lp-row";
    var label = document.createElement("label");
    label.appendChild(document.createTextNode("Level: "));
    var slider = document.createElement("input");
    slider.id = "lp-level";
    slider.type = "range";
    var max = editor.getLevelsCount ? (editor.getLevelsCount()|0)-1 : 0;
    if (max<0) max=0;
    slider.min = "0";
    slider.max = ""+max;
    var cur = editor.getCurrentLevel ? editor.getCurrentLevel()|0 : 0;
    if (cur<0) cur=0; if (cur>max) cur=max;
    slider.value = ""+cur;
    label.appendChild(slider);
    rowLevel.appendChild(label);
    var spanVal = document.createElement("span");
    spanVal.id = "lp-level-val";
    spanVal.textContent = ""+cur;
    rowLevel.appendChild(spanVal);
    panel.appendChild(rowLevel);

    var grid = document.createElement("div");
    grid.className = "lp-row lp-layer-grid";
    panel.appendChild(grid);

    function makeBox(name, color, labelText){
      var box = document.createElement("div");
      box.className = "lp-box";
      box.setAttribute("data-name", name);
      var pill = document.createElement("span"); pill.className="lp-pill"; pill.style.background=color;
      var nm = document.createElement("span"); nm.className="lp-name"; nm.textContent = labelText;
      var btn = document.createElement("button"); btn.className = "lp-vis"; btn.title="Toggle Visibility"; btn.textContent="👁";
      box.appendChild(pill); box.appendChild(nm); box.appendChild(btn); return box;
    }
    grid.appendChild(makeBox("floor", "#4FC3F7", "Floor"));
    grid.appendChild(makeBox("wall", "#FF8A65", "Wall"));
    grid.appendChild(makeBox("decor", "#BA68C8", "Decor"));
    grid.appendChild(makeBox("entities", "#FFF176", "Entities"));

    function getLayerBoxes(){ return grid.querySelectorAll(".lp-box"); }
    function setActiveBox(activeName){
      var list = getLayerBoxes();
      for (var j=0;j<list.length;j++){ var n=list[j].getAttribute("data-name"); if (n===activeName) list[j].classList.add("active"); else list[j].classList.remove("active"); }
    }
    function updateActiveName(){
      var el = document.getElementById("lp-active-name"); if (!el) return;
      var n = editor.getCurrentLayer ? editor.getCurrentLayer() : "";
      el.textContent = n || "";
    }
    function isVisible(name){ return editor.isLayerVisible ? !!editor.isLayerVisible(name) : true; }
    function updateHiddenWarning(){
      var active = editor.getCurrentLayer ? editor.getCurrentLayer() : "floor";
      warn.style.display = isVisible(active) ? "none" : "block";
    }
    function syncVisibilityIcons(){
      var list = getLayerBoxes();
      for (var j=0;j<list.length;j++){ var box=list[j]; var btn=box.querySelector(".lp-vis"); if (!btn) continue; var name=box.getAttribute("data-name"); btn.textContent = isVisible(name) ? "👁" : "🚫"; box.classList.toggle("hidden", !isVisible(name)); }
    }

    if (!editor.uiHookedLevel && typeof editor.setCurrentLevel==="function"){
      var origSetCurrentLevel = editor.setCurrentLevel;
      editor.setCurrentLevel = function(i){ origSetCurrentLevel(i); updateActiveName(); updateHiddenWarning(); syncVisibilityIcons(); };
      editor.uiHookedLevel = true;
    }
    if (!editor.uiHookedLayer && typeof editor.setCurrentLayer==="function"){
      var origSetCurrentLayer = editor.setCurrentLayer;
      editor.setCurrentLayer = function(name){ origSetCurrentLayer(name); setActiveBox(name); updateActiveName(); updateHiddenWarning(); syncVisibilityIcons(); };
      editor.uiHookedLayer = true;
    }

    slider.addEventListener("input", function(){
      if (editor.setCurrentLevel){ editor.setCurrentLevel(slider.value|0); var cl=editor.getCurrentLevel?editor.getCurrentLevel()|0:0; spanVal.textContent = ""+cl;
        var activeNow = editor.getCurrentLayer?editor.getCurrentLayer():"floor"; setActiveBox(activeNow); updateActiveName(); updateHiddenWarning(); syncVisibilityIcons(); }
    });

    var boxes = getLayerBoxes();
    for (var i=0;i<boxes.length;i++) (function(box){
      var name = box.getAttribute("data-name");
      box.addEventListener("click", function(e){ if (e.target && e.target.classList && e.target.classList.contains("lp-vis")) return;
        if (editor.setCurrentLayer){ editor.setCurrentLayer(name); setActiveBox(name); updateActiveName(); updateHiddenWarning(); syncVisibilityIcons(); } });
      var visBtn = box.querySelector(".lp-vis");
      visBtn.addEventListener("click", function(e){ e.stopPropagation(); if (editor.setLayerVisible) editor.setLayerVisible(name, !isVisible(name)); syncVisibilityIcons(); updateHiddenWarning(); });
      box.addEventListener("mouseenter", function(){ if (editor.setHoverLayer) editor.setHoverLayer(name); });
      box.addEventListener("mouseleave", function(){ if (editor.setHoverLayer) editor.setHoverLayer(null); });
    })(boxes[i]);

    setActiveBox(editor.getCurrentLayer?editor.getCurrentLayer():"floor");
    updateActiveName();
    updateHiddenWarning();
    syncVisibilityIcons();
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
