(function (global) {
  function AppThreePlugin(app, options) {
    var opts = options || {};
    var renderer = new global.THREE.WebGLRenderer({ depth: true, stencil: false,
      antialias: false,
      logarithmicDepthBuffer: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    var px = Math.min(global.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(px);
    if (renderer.outputColorSpace) renderer.outputColorSpace = global.THREE.SRGBColorSpace;
    if (renderer.toneMappingExposure !== undefined) renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;

    var canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    app.root.innerHTML = "";
    app.root.appendChild(canvas);

    var scene = new global.THREE.Scene();
    scene.background = new global.THREE.Color(0x0b0f14);

    function resizeToRoot() {
      var s = app.getCssSize();
      renderer.setSize(Math.max(1,s.w), Math.max(1,s.h), false);
    }
    app.on("app:resize", resizeToRoot);
    resizeToRoot();

    app.renderer = renderer;
    app.scene = scene;
    app.canvas = canvas;
  }
  (this.RendererPlugins||(this.RendererPlugins={})).appThree = AppThreePlugin;
})(this);
