(function (global) {
  function PerimeterSkirtPlugin(app) {
    var ring = [];

    function clear() {
      for (var i=0;i<ring.length;i++){
        var m = ring[i];
        app.scene.remove(m);
        m.geometry.dispose(); m.material.dispose();
      }
      ring.length = 0;
    }

    app.on("map:size", function(info){
      clear();
      if (!info) return;
      var cols=info.cols|0, rows=info.rows|0, t=info.tileSize||1;
      var W=cols*t, D=rows*t, H=t*20;   // reicht weit nach unten
      var yMid = -H*0.5 - t*0.5;        // unterhalb y=0 mittig
      var s=t;                          // ringstärke = 1 Tile

      var mat = new global.THREE.MeshStandardMaterial({ color: 0x0d1117, roughness:1, metalness:0 });
      function add(x,z,w,d){
        var g=new global.THREE.BoxGeometry(w, H, d);
        var m=new global.THREE.Mesh(g,mat);
        m.position.set(x, yMid, z);
        app.scene.add(m); ring.push(m);
      }
      var halfW=W*0.5, halfD=D*0.5;

      // Nord/Süd
      add(0, -halfD - s*0.5, W + 2*s, s);
      add(0,  halfD + s*0.5, W + 2*s, s);
      // West/Ost
      add(-halfW - s*0.5, 0, s, D);
      add( halfW + s*0.5, 0, s, D);

      app.requestRender();
    });
  }
  (this.RendererPlugins||(this.RendererPlugins={})).perimeterSkirt = PerimeterSkirtPlugin;
})(this);
