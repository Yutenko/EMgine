(function (global) {
  function BuildDecoPlugin(app, options) {
    var opts = options || {};
    var h = (opts.height != null) ? opts.height : 0.5;
    var eps = 0.0015;
    var list = [];

    function clear() {
      for (var i=0;i<list.length;i++) {
        var m = list[i];
        app.scene.remove(m);
        m.geometry && m.geometry.dispose && m.geometry.dispose();
        if (Array.isArray(m.material)) { for (var j=0;j<m.material.length;j++) m.material[j].dispose && m.material[j].dispose(); }
        else m.material && m.material.dispose && m.material.dispose();
      }
      list.length = 0;
    }

    function build(map, useTextures) {
      clear();
      if (!map || !map.sections || !map.sections.tiles) return;
      var world = map.sections.world || {}, tiles = map.sections.tiles;
      var L0 = tiles.levels && tiles.levels[0];
      if (!L0 || !L0.layers) return;
      var arr = L0.layers['deco'];
      if (!arr) return;

      var cols = tiles.cols|0, rows = tiles.rows|0, tileSize = world.tileSize || 1;
      var groups = {}, i, id, key;
      for (i=0;i<arr.length;i++) { id = arr[i]|0; if (id<=0) continue; key = useTextures ? String(id) : "all"; (groups[key]||(groups[key]=[])).push(i); }
      var tileset = map.sections.materials && map.sections.materials.tileset || null;

      for (var g in groups) if (groups.hasOwnProperty(g)) {
        var idxs = groups[g];
        var mat = null;
        if (useTextures && tileset && tileset[g] && tileset[g].url) mat = app.materials.texture(tileset[g].url);
        else mat = app.materials.decoSolid;
        var geom = new global.THREE.BoxGeometry(tileSize, tileSize*h, tileSize);
        var mesh = new global.THREE.InstancedMesh(geom, mat, idxs.length);
        if (mesh.instanceMatrix && global.THREE.StaticDrawUsage !== undefined) mesh.instanceMatrix.setUsage(global.THREE.StaticDrawUsage);
        mesh.frustumCulled = false;

        var dummy = new global.THREE.Object3D();
        var halfW = cols*tileSize*0.5, halfH = rows*tileSize*0.5;

        for (var k=0;k<idxs.length;k++) {
          var idx = idxs[k];
          var x = idx % cols;
          var y = (idx / cols)|0;
          var cx = x*tileSize + tileSize*0.5 - halfW;
          var cz = y*tileSize + tileSize*0.5 - halfH;
          var cy = (tileSize*h)*0.5 + eps*tileSize;
          dummy.position.set(cx, cy, cz);
          dummy.rotation.set(0,0,0);
          dummy.scale.set(1,1,1);
          dummy.updateMatrix();
          mesh.setMatrixAt(k, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        app.scene.add(mesh);
        list.push(mesh);
      }
      if (app.camera) {
        var fit = Math.max(10, Math.max(cols, rows) * 0.6);
        app.controls && app.controls.target.set(0, 0.4, 0);
        app.camera.position.set(fit, fit*0.9, fit);
        app.camera.lookAt(0,0,0);
      }
      app.requestRender();
    }

    app.on("map:loaded", function(map){
      var useTex = !!(app.renderFlags && app.renderFlags.useTextures);
      build(map, useTex);
    });
    app['deco'] = { rebuild: function(){ build(app.maps.current(), !!(app.renderFlags && app.renderFlags.useTextures)); }, clear: clear };
  }
  (this.RendererPlugins||(this.RendererPlugins={})).buildDeco = BuildDecoPlugin;
})(this);
