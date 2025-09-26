// core-camera.js – camera controls and positioning
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
      const world = renderer.getWorld();
      if (!world) return;

      const centerX = 0;
      const centerZ = 0;
      const worldHeight = world.height;
      const worldWidth = world.width;

      switch (preset) {
        case 'isometric':
          setCameraPosition(worldWidth * 0.8, worldHeight * 0.6, worldWidth * 0.8);
          setCameraTarget(centerX, 0, centerZ);
          break;
        case 'top-down':
          setCameraPosition(centerX, worldHeight * 1.5, centerZ);
          setCameraTarget(centerX, 0, centerZ);
          break;
        case 'side':
          setCameraPosition(worldWidth * 1.2, worldHeight * 0.5, centerZ);
          setCameraTarget(centerX, 0, centerZ);
          break;
        case 'orbit':
        default:
          setCameraPosition(0, worldHeight * 0.8, worldHeight * 1.2);
          setCameraTarget(centerX, 0, centerZ);
          break;
      }
    }

    function enableOrbitControls(options) {
      if (renderer.orbitControls) {
        renderer.orbitControls.dispose();
      }

      const OrbitControls = (global.THREE && global.THREE.OrbitControls) || require('three/examples/js/controls/OrbitControls.js');
      if (!OrbitControls) {
        console.warn('OrbitControls not available. Install three/examples/js/controls/OrbitControls.js');
        return;
      }

      const controls = new OrbitControls(renderer.camera, renderer.renderer.domElement);
      controls.enableDamping = options.damping !== false;
      controls.dampingFactor = options.dampingFactor || 0.05;
      controls.screenSpacePanning = options.screenSpacePanning !== false;
      controls.minDistance = options.minDistance || 1;
      controls.maxDistance = options.maxDistance || Infinity;
      controls.maxPolarAngle = options.maxPolarAngle || Math.PI;

      renderer.orbitControls = controls;

      // Emit events for control changes
      controls.addEventListener('change', () => {
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
      const world = renderer.getWorld();
      if (!world) return;

      padding = padding || 1.2;
      const maxDim = Math.max(world.width, world.height, world.depth);

      const fov = renderer.camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * padding;

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