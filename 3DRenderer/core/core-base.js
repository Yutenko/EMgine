(function (global) {
  function Renderer(rootEl, opts) {
    if (!rootEl) throw new Error("root element required");
    var app = this;
    app.opts = opts || {};
    app.root = rootEl;

    var handlers = {};
    app.on = function (evt, fn) { (handlers[evt] || (handlers[evt] = [])).push(fn); return app; };
    app.off = function (evt, fn) {
      var a = handlers[evt]; if (!a) return app;
      var i = a.indexOf(fn); if (i >= 0) a.splice(i,1);
      return app;
    };
    app.emit = function (evt, data) {
      var a = handlers[evt]; if (!a) return app;
      for (var i=0; i<a.length; i++) { try { a[i](data); } catch(e){} }
      return app;
    };

    app.use = function (plugin) {
      if (typeof plugin === "function") {
        var args = Array.prototype.slice.call(arguments, 1);
        plugin.apply(null, [app].concat(args));
      }
      return app;
    };

    app.getCssSize = function () {
      var r = app.root.getBoundingClientRect();
      return { w: r.width|0, h: r.height|0, left: r.left, top: r.top };
    };

    var needsRender = true, rafId = 0;
    app.requestRender = function () { needsRender = true; };

    var last = (global.performance && performance.now()) || Date.now();
    function frame() {
      var now = (global.performance && performance.now()) || Date.now();
      var dt = (now - last) / 1000; last = now;
      app.emit("frame:tick", { now: now, dt: dt });
      if (needsRender && typeof app.draw === "function") {
        needsRender = false;
        app.draw();
      }
      rafId = global.requestAnimationFrame(frame);
    }

    function handleResize() {
      app.emit("app:resize", app.getCssSize());
      app.requestRender();
    }
    global.addEventListener("resize", handleResize, false);
    handleResize();
    rafId && global.cancelAnimationFrame && cancelAnimationFrame(rafId);
    rafId = global.requestAnimationFrame(frame);

    return app;
  }
  if (!global.Renderer) global.Renderer = Renderer;
})(this);
