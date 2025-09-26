// core-camera.js – Kamera + Koordinaten (Bitmap-synchron, DPR-sicher, ES5)
(function () {
  function install(editor) {
    var canvas = editor.getCanvas();
    var world = editor.getWorld();
    var cam = { x: world.width / 2, y: world.height / 2, z: 1, min: 0.25, max: 4 };

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function getGutterPx() { return 4 * editor.getTileSize(); }

    function cssCanvasSize() {
      var dpr = editor.getDpr ? editor.getDpr() : (window.devicePixelRatio || 1);
      return { w: canvas.width / dpr, h: canvas.height / dpr };
    }

    function clampCamera() {
      var sz = cssCanvasSize();
      var vw = sz.w / cam.z;
      var vh = sz.h / cam.z;
      var hw = vw / 2, hh = vh / 2, G = getGutterPx();
      var w = editor.getWorld();

      var minX = -G + hw, maxX = w.width  + G - hw;
      var minY = -G + hh, maxY = w.height + G - hh;

      cam.x = vw >= w.width  + 2 * G ? w.width  / 2 : clamp(cam.x, minX, maxX);
      cam.y = vh >= w.height + 2 * G ? w.height / 2 : clamp(cam.y, minY, maxY);
    }

    editor.on("canvas:resize", clampCamera);
    editor.on("world:resize", function () { world = editor.getWorld(); clampCamera(); });

    function getCamera() { return cam; }

    function screenToWorld(sx, sy) {
      var sz = cssCanvasSize();
      return {
        x: (sx - sz.w / 2) / cam.z + cam.x,
        y: (sy - sz.h / 2) / cam.z + cam.y
      };
    }

    function worldToScreen(wx, wy) {
      var sz = cssCanvasSize();
      return {
        x: (wx - cam.x) * cam.z + sz.w / 2,
        y: (wy - cam.y) * cam.z + sz.h / 2
      };
    }

    function worldToTile(wx, wy) {
      var ts = editor.getTileSize();
      var eps = 1e-7;
      var col = Math.floor((wx + eps) / ts);
      var row = Math.floor((wy + eps) / ts);
      var w = editor.getWorld();
      if (col < 0 || row < 0 || col >= w.cols || row >= w.rows) return null;
      return { col: col, row: row };
    }

    function screenToTile(sx, sy){
      var w = screenToWorld(sx, sy);
      return worldToTile(w.x, w.y);
    }

    function clientToTile(evt) {
      var r = canvas.getBoundingClientRect();
      var sx = evt.clientX - r.left;
      var sy = evt.clientY - r.top;
      
      // Ensure we use the CSS size for coordinate conversion, not raw canvas size
      var sz = cssCanvasSize();
      
      // Scale the client coordinates to match the CSS canvas size
      var normalizedSx = sx * (sz.w / r.width);
      var normalizedSy = sy * (sz.h / r.height);
      
      return screenToTile(normalizedSx, normalizedSy);
    }

    function applyCamera(ctx) {
      var sz = cssCanvasSize();
      ctx.translate(sz.w / 2, sz.h / 2);
      ctx.scale(cam.z, cam.z);
      ctx.translate(-cam.x, -cam.y);
    }

    function panTo(x, y) {
      cam.x = x; cam.y = y;
      clampCamera();
      editor.requestRender();
    }

    function zoomBy(factor, sx, sy) {
      factor = factor || 1;
      var sz = cssCanvasSize();
      var cx = sx != null ? sx : sz.w / 2;
      var cy = sy != null ? sy : sz.h / 2;

      var before = screenToWorld(cx, cy);
      cam.z = Math.max(cam.min, Math.min(cam.max, cam.z * factor));
      clampCamera();
      var after = screenToWorld(cx, cy);

      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
      clampCamera();
      editor.requestRender();
    }

    editor.getCamera = getCamera;
    editor.screenToWorld = screenToWorld;
    editor.worldToScreen = worldToScreen;
    editor.clientToTile = clientToTile;
    editor.applyCamera = applyCamera;
    editor.zoomBy = zoomBy;
    editor.panTo = panTo;
  }
  window.EditorCamera = install;
})();
