// core-base.js – Editor-Basis (EventBus, DPR, Frame-Loop)
// Usage:
//   const editor = new Editor(canvas, { tileSize:32, cols:64, rows:64 });
//   editor.use(EditorWorld).use(EditorCamera).use(EditorGrid).use(EditorLevels);
// API:
//   Events: emit/on/off; "canvas:resize" bei resizeCanvas()
//   Canvas/DPR: getCanvas(), getContext(), getDpr(), getCssSize()
//   Render: requestRender() (invalidiert Frame), draw(ctx) wird im Loop aufgerufen
//   Plugins: use(fn)
// Notes:
//   resizeCanvas() skaliert den Bitmap-Buffer auf die CSS-Größe und emittiert "canvas:resize". :contentReference[oaicite:5]{index=5}


(function (global) {
  function Editor(canvas, opts) {
    opts = opts || {};
    if (!canvas || !canvas.getContext) throw new Error("Canvas required");
    var self = this;

    // Basic event bus
    var handlers = {};
    function on(evt, fn) {
      if (!handlers[evt]) handlers[evt] = [];
      handlers[evt].push(fn);
    }
    function off(evt, fn) {
      var a = handlers[evt]; if (!a) return;
      for (var i=0;i<a.length;i++) if (a[i]===fn) { a.splice(i,1); break; }
    }
    function emit(evt, data) {
      var a = handlers[evt]; if (!a) return;
      for (var i=0;i<a.length;i++) try { a[i](data); } catch(e){}
    }

    // Canvas + ctx
    var ctx = canvas.getContext("2d", {alpha:false});
    var dpr = global.devicePixelRatio || 1;

    function getCssSize() {
      var r = canvas.getBoundingClientRect();
      return { w: r.width, h: r.height, left: r.left, top: r.top };
    }

    // Render invalidation
    var needsRender = true;
    function requestRender() { needsRender = true; }

    function frame() {
      if (needsRender && typeof self.draw === "function") {
        // Reset to identity and clear full bitmap
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        // Apply DPR so all subsequent transforms use CSS pixels
        ctx.setTransform(dpr,0,0,dpr,0,0);
        self.draw(ctx);
        needsRender = false;
      }
      global.requestAnimationFrame(frame);
    }

    function resizeCanvas() {
      dpr = global.devicePixelRatio || 1;
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width  * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr,0,0,dpr,0,0);
      emit("canvas:resize", {width: canvas.width, height: canvas.height, dpr: dpr});
      requestRender();
    }

    // Public API (base)
    this.opts = opts;
    this.on = on;
    this.off = off;
    this.emit = emit;
    this.getCanvas = function(){ return canvas; };
    this.getContext = function(){ return ctx; };
    this.getDpr = function(){ return dpr; };
    this.requestRender = requestRender;
    this.resizeCanvas = resizeCanvas;
    this.getCssSize = getCssSize;

    // Simple plugin registry
    this.use = function (plugin) {
      if (typeof plugin === "function") plugin(self);
      return self;
    };

    // Boot
    global.addEventListener("resize", resizeCanvas, false);
    resizeCanvas();
    frame();
  }

  // export
  global.Editor = Editor;
})(window);
