// core-camera.js - camera controls and positioning
(function () {
  function install(renderer) {
    function setCameraPosition(x, y, z) {
      renderer.camera.position.set(x, y, z);
      renderer.requestRender();
    }

    function setCameraTarget(x, y, z) {
      renderer.camera.lookAt(x, y, z);
      renderer.requestRender();
    }

    function setCameraPreset(preset) {
      var world = renderer.getWorld();
      if (!world) return;

      var centerX = 0;
      var centerZ = 0;
      var worldHeight = world.height;
      var worldWidth = world.width;
      var maxDim = Math.max(worldWidth, worldHeight);

      switch (preset) {
        case 'isometric':
          setCameraPosition(maxDim * 0.7, maxDim * 0.5, maxDim * 0.7);
          setCameraTarget(centerX, 0, centerZ);
          break;
        case 'top-down':
          setCameraPosition(centerX, maxDim * 1.2, centerZ);
          setCameraTarget(centerX, 0, centerZ);
          break;
        case 'side':
          setCameraPosition(maxDim * 1.1, maxDim * 0.4, centerZ);
          setCameraTarget(centerX, 0, centerZ);
          break;
        case 'orbit':
        default:
          setCameraPosition(maxDim * 0.6, maxDim * 0.7, maxDim * 1.0);
          setCameraTarget(centerX, 0, centerZ);
          break;
      }
    }

    function enableOrbitControls(options) {
      if (renderer.orbitControls) {
        renderer.orbitControls.dispose();
      }

      var OrbitControls = (window.THREE && window.THREE.OrbitControls);
      if (!OrbitControls) {
        console.warn('OrbitControls not available. Please ensure Three.js OrbitControls are loaded.');
        return;
      }

      var controls = new OrbitControls(renderer.camera, renderer.renderer.domElement);
      controls.enableDamping = options.damping !== false;
      controls.dampingFactor = options.dampingFactor || 0.05;
      controls.screenSpacePanning = options.screenSpacePanning !== false;
      controls.minDistance = options.minDistance || 1;
      controls.maxDistance = options.maxDistance || Infinity;
      controls.maxPolarAngle = options.maxPolarAngle || Math.PI;

      renderer.orbitControls = controls;

      // Emit events for control changes
      controls.addEventListener('change', function() {
        renderer.emit('camera:change', {
          position: renderer.camera.position.clone(),
          target: controls.target.clone()
        });
        renderer.requestRender();
      });

      return controls;
    }

    function disableOrbitControls() {
      if (renderer.orbitControls) {
        renderer.orbitControls.dispose();
        renderer.orbitControls = null;
      }
    }

    function fitCameraToWorld(padding) {
      var world = renderer.getWorld();
      if (!world) return;

      padding = padding || 1.2;
      var maxDim = Math.max(world.width, world.height, world.depth);

      var fov = renderer.camera.fov * (Math.PI / 180);
      var cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * padding;

      setCameraPosition(0, cameraZ, cameraZ);
      setCameraTarget(0, 0, 0);
    }

    // Public API
    renderer.setCameraPosition = setCameraPosition;
    renderer.setCameraTarget = setCameraTarget;
    renderer.setCameraPreset = setCameraPreset;
    renderer.enableOrbitControls = enableOrbitControls;
    renderer.disableOrbitControls = disableOrbitControls;
    renderer.fitCameraToWorld = fitCameraToWorld;

    // Set default camera position
    setCameraPreset('orbit');

    renderer.emit("camera:ready");
  }

  window.RendererCamera = install;
})(window);