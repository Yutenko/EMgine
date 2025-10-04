(function (global) {
  function LightsGridPlugin(app, options) {
    var planeColor = (options && options.planeColor) || 0x10161e;

    var amb = new global.THREE.AmbientLight(0xffffff, 0.7);
    var dir = new global.THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(4,8,2);
    app.scene.add(amb, dir);

    var grid = new global.THREE.GridHelper(200, 200, 0x335577, 0x223344);
    grid.position.y = 0.02;
    app.scene.add(grid);

    var plane = null;
    function rebuildPlane(cols, rows, tileSize) {
      if (plane) {
        app.scene.remove(plane);
        plane.geometry && plane.geometry.dispose && plane.geometry.dispose();
        plane.material && plane.material.dispose && plane.material.dispose();
        plane = null;
      }
      var geo = new global.THREE.PlaneGeometry(cols*tileSize, rows*tileSize);
      var mat = new global.THREE.MeshStandardMaterial({
        color: planeColor, roughness: 1, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4
      });
      plane = new global.THREE.Mesh(geo, mat);
      plane.rotation.x = -Math.PI/2;
      plane.position.y = -0.01 * tileSize;
      app.scene.add(plane);
      app.requestRender();
    }
    app.on("map:size", function (info) {
      if (!info) return;
      rebuildPlane(info.cols||1, info.rows||1, info.tileSize||1);
    });
  }
  (this.RendererPlugins||(this.RendererPlugins={})).lightsGrid = LightsGridPlugin;
})(this);
