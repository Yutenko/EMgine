(function (global) {
  function CameraOrbitPlugin(app, options) {
    var opts = options || {};
    var fov = opts.fov || 60, near = (opts.near != null ? opts.near : 0.5), far = opts.far || 5000;
    var pos = opts.pos || [10,14,16], target = opts.target || [0,0.4,0];

    var cam = new global.THREE.PerspectiveCamera(fov, 1, near, far);
    function resizeCam() {
      var s = app.getCssSize();
      cam.aspect = Math.max(1, s.w) / Math.max(1, s.h);
      cam.updateProjectionMatrix();
    }
    resizeCam();
    app.on("app:resize", resizeCam);
    cam.position.set(pos[0], pos[1], pos[2]);

    var controls = new (global.THREE.OrbitControls)(cam, app.renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(target[0], target[1], target[2]);

    controls.addEventListener('change', function(){ app.requestRender(); });
    var pumping = false;
    function startPump(){
      if (pumping) return; pumping = true;
      function loop(){
        controls.update();
        app.requestRender();
        if (pumping) requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    }
    function stopPump(){ pumping = false; app.requestRender(); }
    controls.addEventListener('start', startPump);
    controls.addEventListener('end',   stopPump);
    app.on("app:resize", function(){ app.requestRender(); });

    app.camera = cam;
    app.controls = controls;
  }
  (this.RendererPlugins||(this.RendererPlugins={})).cameraOrbit = CameraOrbitPlugin;
})(this);
