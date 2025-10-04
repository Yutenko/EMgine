(function (global) {
  function createRendererApp(rootEl, opts) {
    var app = new global.Renderer(rootEl, opts || {});
    app.renderFlags = { useTextures: true };

    app
      .use(global.RendererPlugins.appThree, { logDepth: true })
      .use(global.RendererPlugins.cameraOrbit, { fov: 60 })
      .use(global.RendererPlugins.lightsGrid)
      .use(global.RendererPlugins.materials)
      .use(global.RendererPlugins.mapLoader)
      //.use(global.RendererPlugins.perimeterSkirt)
      .use(global.RendererPlugins.buildFloor)
      .use(global.RendererPlugins.buildWalls)
      .use(global.RendererPlugins.buildDeco);

    app.draw = function () {
      app.renderer.render(app.scene, app.camera);
    };

    app._renderQueued = false;
    app.requestRender = function () {
      if (app._renderQueued) return;
      app._renderQueued = true;
      requestAnimationFrame(function () {
        app._renderQueued = false;
        app.draw && app.draw();
      });
    };

    app.loadAndBuild = function (url, useTextures) {
      app.renderFlags.useTextures = !!useTextures;
      app.maps.load(url, function (err) {
        if (err) {
          if (global.console && console.error) console.error(err);
          return;
        }
        if (app.floor && app.floor.rebuild) app.floor.rebuild();
        if (app.walls && app.walls.rebuild) app.walls.rebuild();
        if (app.deco && app.deco.rebuild) app.deco.rebuild();
        if (app.renderer.compile) {
          try {
            app.renderer.compile(app.scene, app.camera);
          } catch (e) {}
        }
      });
    };

    if (typeof window !== "undefined") window.app3d = app;
    return app;
  }
  if (!global.createRendererApp) global.createRendererApp = createRendererApp;
})(this);
