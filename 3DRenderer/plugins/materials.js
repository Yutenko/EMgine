(function (global) {
  function MaterialsPlugin(app) {
    var cache = {};
    var loader = new global.THREE.TextureLoader();
    if (loader.setCrossOrigin) loader.setCrossOrigin('anonymous');

    function onTexLoaded(tex) {
      // Kompatibel mit neuen/alten Three-Versionen:
      if (tex.colorSpace !== undefined && global.THREE.SRGBColorSpace !== undefined) {
        tex.colorSpace = global.THREE.SRGBColorSpace; // r15x+
      } else if (tex.encoding !== undefined && global.THREE.sRGBEncoding !== undefined) {
        tex.encoding = global.THREE.sRGBEncoding;     // r14x und älter
      }
      tex.wrapS = tex.wrapT = global.THREE.RepeatWrapping;
      tex.generateMipmaps = true;

      // Anisotropy nur setzen, wenn Renderer vorhanden ist:
      var caps = app.renderer && app.renderer.capabilities;
      var maxAniso = caps && caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 0;
      if (maxAniso && tex.anisotropy !== undefined) tex.anisotropy = maxAniso;

      // optionale Filter (lassen wir Standard; keine needsUpdate-Schleife)
      // tex.minFilter = global.THREE.LinearMipmapLinearFilter;
      // tex.magFilter = global.THREE.LinearFilter;

      tex.needsUpdate = true; // jetzt ist image da → sicher
      app.requestRender && app.requestRender();
    }

    function textureMaterial(url) {
      if (!url) return app.materials.floorSolid;
      var key = String(url);
      if (cache[key]) return cache[key];

      var tex = loader.load(
        url,
        function () { onTexLoaded(tex); },     // onLoad
        undefined,                             // onProgress
        function (err) {                       // onError
          if (global.console && console.warn) console.warn('Texture load failed:', url, err);
          var m = cache[key];
          if (m) { m.map = null; m.needsUpdate = true; app.requestRender && app.requestRender(); }
        }
      );

      // Wichtig: vor onLoad KEIN needsUpdate / KEIN wrap/encode/… anfassen
      var mat = new global.THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.9,
        metalness: 0.0
      });

      cache[key] = mat;
      return mat;
    }

    app.materials = {
      texture: textureMaterial,
      floorSolid: new global.THREE.MeshStandardMaterial({ color: 0x4fa16f, roughness: 0.95, metalness: 0.0 }),
      wallSolid:  new global.THREE.MeshStandardMaterial({ color: 0x7a8aa1, roughness: 0.80, metalness: 0.0 }),
      decoSolid:  new global.THREE.MeshStandardMaterial({ color: 0xd8a657, roughness: 0.80, metalness: 0.0 })
    };
  }
  (this.RendererPlugins||(this.RendererPlugins={})).materials = MaterialsPlugin;
})(this);
