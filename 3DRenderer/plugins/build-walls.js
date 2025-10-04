(function (global) {
  function BuildWallsPlugin(app, options) {
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
      if (!L0 || !L0.layers || !L0.layers.wall) return;

      var cols = tiles.cols | 0,
        rows = tiles.rows | 0,
        t = world.tileSize || 1;
      var ids = L0.layers.wall;

      // Höhenfelder / Defaults
      var floorZ =
        L0.floorZ && L0.floorZ.length === ids.length ? L0.floorZ : null;
      var ceilZ = L0.ceilZ && L0.ceilZ.length === ids.length ? L0.ceilZ : null;
      var defCeil = world.wallH != null ? world.wallH * t : 1.0 * t;

      var halfW = cols * t * 0.5,
        halfH = rows * t * 0.5;

      // Für saubere UVs (kein Strecken über Tiles) bauen wir pro HÖHEN-KLASSE eigene InstancedMeshes.
      // Dazu gruppieren wir nach (idStr + '#' + H_in_world).
      var groups = {};
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i] | 0;
        if (id <= 0) continue;
        var y0 = floorZ ? +floorZ[i] * t : 0;
        var y1 = ceilZ ? +ceilZ[i] * t : defCeil;
        var H = Math.max(0, y1 - y0);
        if (H <= 0) continue;

        // Höhe in kleine Stufen runden, damit Floating-Point nicht 1000 Klassen erzeugt:
        var Hq = Math.round(H * 1000) / 1000; // mm-Genauigkeit bei t=1 → ausreichend

        var key = String(id) + "#" + Hq.toString();
        (groups[key] || (groups[key] = [])).push({ i: i, y0: y0, H: Hq });
      }

      function materialFor(idStr, Hq) {
        var tileset = map.sections.materials && map.sections.materials.tileset;
        if (!useTextures || !tileset || !tileset[idStr] || !tileset[idStr].url)
          return app.materials.wallSolid;

        // Nutze das vom System geladene Material – NICHT klonen, solange kein Bild
        var base = app.materials.texture(tileset[idStr].url);
        if (base && base.map && base.map.image) {
          // Vertikale Wiederholung optional: 1× in U, (H/t) in V
          base.map.wrapS = base.map.wrapT = global.THREE.RepeatWrapping;
          // Achtung: repeat.set() triggert needsUpdate → nur ausführen, wenn Bild fertig:
          var t = (map.sections.world && map.sections.world.tileSize) || 1;
          var vRepeat = Math.max(1e-6, Hq / t);
          // Wenn du *pro Höhe* unterschiedliche Wiederholung willst, brauchst du getrennte Textur-Objekte.
          // Um Warnungen zu vermeiden: NICHT klonen, solange kein image da ist.
          // Hier: belassen wir die Standard-Repeat (1,1) → kein Stretch über mehrere Tiles,
          // denn jede Wand ist 1 Tile breit/tief. Später (wenn nötig) kann man bei geladenem
          // Bild pro Gruppe eine geklonte Texture setzen.
          // base.map.repeat.set(1, vRepeat); // <- nur aktivieren, wenn du sicher bist, dass image geladen ist
          // base.map.needsUpdate = false;
        }
        return base;
      }

      var dummy = new global.THREE.Object3D();

      // Pro (id,H)-Gruppe ein InstancedMesh mit eigener Geometrie (H fest in Geo → saubere UVs)
      for (var key in groups)
        if (groups.hasOwnProperty(key)) {
          var parts = key.split("#");
          var idStr = parts[0];
          var Hq = parseFloat(parts[1]);

          var arr = groups[key];
          var mat = materialFor(idStr, Hq);

          // Geometrie in der passenden Höhe, UVs 0..1 → keine Streckung über mehrere Tiles
          var geo = new global.THREE.BoxGeometry(t, Hq, t);

          var mesh = new global.THREE.InstancedMesh(geo, mat, arr.length);
          mesh.instanceMatrix.setUsage(global.THREE.StaticDrawUsage);
          mesh.frustumCulled = false;

          for (var k = 0; k < arr.length; k++) {
            var item = arr[k];
            var idx = item.i;
            var x = idx % cols;
            var y = (idx / cols) | 0;

            var W = t,
              D = t,
              H = Hq;
            var cx = x * t + t * 0.5 - halfW;
            var cz = y * t + t * 0.5 - halfH;
            var cy = item.y0 + H * 0.5 + EPS * t;

            dummy.position.set(cx, cy, cz);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(1, 1, 1); // Höhe steckt in der Geometrie, nicht in Scale → UVs bleiben korrekt
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

    app.walls = {
      rebuild: function () {
        build(
          app.maps.current(),
          !!(app.renderFlags && app.renderFlags.useTextures)
        );
      },
      clear: clear,
    };
  }
  (this.RendererPlugins || (this.RendererPlugins = {})).buildWalls =
    BuildWallsPlugin;
})(this);
