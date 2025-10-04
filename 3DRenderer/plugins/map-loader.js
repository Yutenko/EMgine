(function (global) {
  function MapLoaderPlugin(app, options) {
    app.map = null;
    function load(url, done) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          var json = null;
          try { json = JSON.parse(xhr.responseText); } catch(e){ done && done(e); return; }
          app.map = json;
          var world = json.sections && json.sections.world || {};
          var tiles = json.sections && json.sections.tiles;
          if (tiles) app.emit("map:size", { cols: tiles.cols|0, rows: tiles.rows|0, tileSize: world.tileSize || 1 });
          app.emit("map:loaded", json);
          app.requestRender();
          done && done(null, json);
        } else {
          done && done(new Error("HTTP "+xhr.status));
        }
      };
      xhr.send();
    }
    app.maps = { load: load, current: function(){ return app.map; } };
  }
  (this.RendererPlugins||(this.RendererPlugins={})).mapLoader = MapLoaderPlugin;
})(this);
