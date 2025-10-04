(function (global) {
  function BuildFloorPlugin(app, options) {
    var list = [];
    var EPS = 0.0006;

    function clear() {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        app.scene.remove(m);
        if (m.geometry && m.geometry.dispose) m.geometry.dispose();
        if (Array.isArray(m.material)) {
          for (var j = 0; j < m.material.length; j++)
            m.material[j].dispose && m.material[j].dispose();
        } else {
          m.material && m.material.dispose && m.material.dispose();
        }
      }
      list.length = 0;
    }

    function build(map, useTextures) {
      clear();
      if (!map || !map.sections || !map.sections.tiles) return;

      var world = map.sections.world || {};
      var tiles = map.sections.tiles;
      var L0 = tiles.levels && tiles.levels[0];
      if (!L0 || !L0.layers || !L0.layers.floor) return;

      var cols = tiles.cols | 0,
        rows = tiles.rows | 0,
        t = world.tileSize || 1;
      var ids = L0.layers.floor;
      var floorZ =
        L0.floorZ && L0.floorZ.length === ids.length ? L0.floorZ : null;
      var slabH = world.slabH != null ? world.slabH * t : 0.12 * t;

      var halfW = cols * t * 0.5,
        halfH = rows * t * 0.5;

      // Gruppen je Material
      var groups = {};
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i] | 0;
        if (id <= 0) continue;
        var key = String(id);
        (groups[key] || (groups[key] = [])).push(i);
      }

      // Geometrie für alle Instanzen gleich (TileBox)
      var geo = new global.THREE.BoxGeometry(t, slabH, t);
      var dummy = new global.THREE.Object3D();

      function materialFor(idStr) {
        var tileset = map.sections.materials && map.sections.materials.tileset;
        if (!useTextures || !tileset || !tileset[idStr] || !tileset[idStr].url)
          return app.materials.floorSolid;

        var m = app.materials.texture(tileset[idStr].url); // nutzt euren Loader
        // WICHTIG: nur ändern, wenn Bild da ist – sonst kein needsUpdate!
        if (m && m.map && m.map.image) {
          if (m.map.wrapS !== global.THREE.RepeatWrapping)
            m.map.wrapS = global.THREE.RepeatWrapping;
          if (m.map.wrapT !== global.THREE.RepeatWrapping)
            m.map.wrapT = global.THREE.RepeatWrapping;
          // kein repeat.set hier nötig (pro Tile-Box ist 1×1 korrekt)
          m.map.needsUpdate = false; // sicherstellen, dass wir nichts unnötig triggern
        }
        return m;
      }

      for (var key in groups)
        if (groups.hasOwnProperty(key)) {
          var arr = groups[key];
          var mat = materialFor(key);
          var mesh = new global.THREE.InstancedMesh(geo, mat, arr.length);
          mesh.instanceMatrix.setUsage(global.THREE.StaticDrawUsage);
          mesh.frustumCulled = false;

          for (var k = 0; k < arr.length; k++) {
            var idx = arr[k];
            var x = idx % cols;
            var y = (idx / cols) | 0;
            var zTop = floorZ ? +floorZ[idx] * t : 0;
            var bottom = zTop - slabH;

            var cx = x * t + t * 0.5 - halfW;
            var cz = y * t + t * 0.5 - halfH;
            var cy = bottom + slabH * 0.5 + EPS * t;

            dummy.position.set(cx, cy, cz);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(k, dummy.matrix);
          }
          mesh.instanceMatrix.needsUpdate = true;
          app.scene.add(mesh);
          list.push(mesh);
        }

      if (!app._renderQueued) app.requestRender();
    }

    app.on("map:loaded", function () {
      build(
        app.maps.current(),
        !!(app.renderFlags && app.renderFlags.useTextures)
      );
    });

    app.floor = {
      rebuild: function () {
        build(
          app.maps.current(),
          !!(app.renderFlags && app.renderFlags.useTextures)
        );
      },
      clear: clear,
    };
  }
  (this.RendererPlugins || (this.RendererPlugins = {})).buildFloor =
    BuildFloorPlugin;
})(this);
