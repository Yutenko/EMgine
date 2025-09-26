// core-base.js – 3DRenderer base with plugin system (ES5 compatible)
(function (global) {
  function ThreeRenderer(container, opts) {
    opts = opts || {};
    if (!container) throw new Error("Container element required");

    const self = this;

    // Three.js core components
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({
      antialias: opts.antialias !== false,
      alpha: opts.alpha || false
    });

    // Basic event bus (same pattern as editor)
    const handlers = {};
    function on(evt, fn) {
      if (!handlers[evt]) handlers[evt] = [];
      handlers[evt].push(fn);
    }
    function off(evt, fn) {
      const a = handlers[evt]; if (!a) return;
      for (let i=0;i<a.length;i++) if (a[i]===fn) { a.splice(i,1); break; }
    }
    function emit(evt, data) {
      const a = handlers[evt]; if (!a) return;
      for (let i=0;i<a.length;i++) try { a[i](data); } catch(e){}
    }

    // Plugin system (same as editor)
    this.use = function (plugin) {
      if (typeof plugin === "function") plugin(self);
      return self;
    };

    // Render loop
    let needsRender = true;
    this.requestRender = function() { needsRender = true; };

    function animate() {
      if (needsRender && typeof self.render === "function") {
        self.render();
        needsRender = false;
      }
      global.requestAnimationFrame(animate);
    }

    // Handle window resize
    function handleResize() {
      const width = global.innerWidth;
      const height = global.innerHeight;

      self.camera.aspect = width / height;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(width, height);

      emit("renderer:resize", {width: width, height: height});
      self.requestRender();
    }

    // Initialize renderer
    this.renderer.setSize(global.innerWidth, global.innerHeight);
    this.renderer.setPixelRatio(global.devicePixelRatio || 1);
    container.appendChild(this.renderer.domElement);

    // Set initial camera position
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.scene.add(ambientLight, directionalLight);

    // Public API
    this.on = on;
    this.off = off;
    this.emit = emit;
    this.getScene = function(){ return self.scene; };
    this.getCamera = function(){ return self.camera; };
    this.getRenderer = function(){ return self.renderer; };
    this.getContainer = function(){ return container; };

    // Event listeners
    global.addEventListener("resize", handleResize, false);

    // Start render loop
    animate();
  }

  // Export
  global.ThreeRenderer = ThreeRenderer;
})(window);