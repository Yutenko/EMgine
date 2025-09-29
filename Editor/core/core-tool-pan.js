// core-tool-pan.js – UI-agnostisches Pan & optional Wheel-Zoom (ES5)
// Usage:
//   editor.use(EditorCamera).use(EditorToolPan);
//   // Pointer aus deiner UI/Adapter-Schicht:
//   editor.panBegin(sx, sy, pointerId);
//   editor.panMove (sx, sy, pointerId);
//   editor.panEnd  (pointerId);
//   // optionales Zoom am Rad/Trackpad (um Mauspunkt):
//   editor.zoomWheel(deltaY, sx, sy); // deltaY aus Wheel/WheelEvent
// Config:
//   editor.setPanInertia(0);          // (optional) 0..1 – momentan ohne Trägheit, Platzhalter
// Events (emit):
//   "tool:pan:start" { cam } | "tool:pan:move" { cam } | "tool:pan:end" { cam }
(function(){
  function install(editor){
    var panActive = false, pid = null;
    var startSX=0, startSY=0, startCamX=0, startCamY=0;
    var inertia = 0; // placeholder für spätere Glättung

    function emit(n, d){ editor.emit && editor.emit(n, d||{}); }
    function cam(){ return editor.getCamera ? editor.getCamera() : {x:0,y:0,z:1}; }

    function panBegin(sx, sy, pointerId){
      if (panActive) return false;
      panActive = true; pid = pointerId != null ? pointerId : 0;
      startSX = sx|0; startSY = sy|0;
      var c = cam(); startCamX = c.x|0; startCamY = c.y|0;
      emit("tool:pan:start", { cam: c }); return true;
    }
    function panMove(sx, sy, pointerId){
      if (!panActive || pointerId !== pid) return false;
      var c = cam(), z = c.z || 1;
      var dx = (sx - startSX) / z, dy = (sy - startSY) / z;
      editor.panTo && editor.panTo(startCamX - dx, startCamY - dy);
      editor.requestRender && editor.requestRender();
      emit("tool:pan:move", { cam: cam() }); return true;
    }
    function panEnd(pointerId){
      if (!panActive || pointerId !== pid) return false;
      panActive = false; pid = null;
      emit("tool:pan:end", { cam: cam() }); return true;
    }

    function zoomWheel(deltaY, sx, sy){
      if (typeof deltaY !== "number" || !editor.zoomBy) return;
      var factor = deltaY < 0 ? 1.1 : 1/1.1; // sanft
      editor.zoomBy(factor, sx, sy);
      editor.requestRender && editor.requestRender();
    }

    function setPanInertia(val){ inertia = Math.max(0, Math.min(1, +val||0)); }

    // Export
    editor.panBegin = panBegin;
    editor.panMove  = panMove;
    editor.panEnd   = panEnd;
    editor.zoomWheel = zoomWheel;

    editor.setPanInertia = setPanInertia;
  }
  window.EditorToolPan = install;
})();
