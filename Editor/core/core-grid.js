// core-grid.js – Grid (Bitmap-synchron, DPR-sicher, ES5)
(function(){
  function install(editor){
    var GRID = { enabled: true, color: "#2f3340", axisX: "#4caf50", axisY:"#ff7043", bg:"#14171c" };

    function cssCanvasSize(){
      var canvas = editor.getCanvas();
      var dpr = editor.getDpr ? editor.getDpr() : (window.devicePixelRatio || 1);
      return { w: canvas.width / dpr, h: canvas.height / dpr };
    }

    function getVisibleGridRect() {
      var sz = cssCanvasSize();
      var tl = editor.screenToWorld(0, 0);
      var br = editor.screenToWorld(sz.w, sz.h);
      var ts = editor.getTileSize(), w = editor.getWorld();

      var c0 = Math.max(0, Math.floor(tl.x / ts));
      var c1 = Math.min(w.cols, Math.ceil(br.x / ts));
      var r0 = Math.max(0, Math.floor(tl.y / ts));
      var r1 = Math.min(w.rows, Math.ceil(br.y / ts));
      if (c1 < c0) c1 = c0;
      if (r1 < r0) r1 = r0;
      return { c0:c0, c1:c1, r0:r0, r1:r1 };
    }

    function getGridStyle(){ return { enabled: !!GRID.enabled, color: GRID.color, axisX: GRID.axisX, axisY: GRID.axisY, bg: GRID.bg}; }
    function setGridEnabled(on){ GRID.enabled = !!on; editor.requestRender(); }
    function setGridStyle(obj){ if(!obj) return; if(obj.color) GRID.color=obj.color; if(obj.axisX) GRID.axisX=obj.axisX; if(obj.axisY) GRID.axisY=obj.axisY; if(obj.bg) GRID.bg=obj.bg; editor.requestRender(); }

    function drawGrid(ctx){
      var w = editor.getWorld(), ts = editor.getTileSize(), cam = editor.getCamera();
      ctx.fillStyle = GRID.bg; ctx.fillRect(0,0,w.width,w.height);

      var r = getVisibleGridRect(), c0=r.c0, c1=r.c1, r0=r.r0, r1=r.r1;
      ctx.lineWidth = 1 / cam.z;
      ctx.strokeStyle = GRID.color;

      var x,y,c,row;
      for (row=r0; row<=r1; row++){ y = row*ts; ctx.beginPath(); ctx.moveTo(c0*ts,y); ctx.lineTo(c1*ts,y); ctx.stroke(); }
      for (c=c0; c<=c1; c++){ x = c*ts; ctx.beginPath(); ctx.moveTo(x,r0*ts); ctx.lineTo(x,r1*ts); ctx.stroke(); }
    }

    editor.getGridStyle = getGridStyle;
    editor.setGridEnabled = setGridEnabled;
    editor.setGridStyle = setGridStyle;
    editor.getVisibleGridRect = getVisibleGridRect;
    editor.drawGrid = drawGrid;
  }
  window.EditorGrid = install;
})();
