// core-render.js – Zeichenreihenfolge bündeln
// Usage:
//   editor.use(EditorRender); // der Frame-Loop aus core-base ruft editor.draw(ctx) auf
// Pipeline (Default):
//   applyCamera(ctx) → drawGrid(ctx) → drawUnderlay(ctx) → renderDirtyChunks(ctx)
// Notes:
//   Erwartet, dass die genannten Methoden von Plugins bereitgestellt sind. :contentReference[oaicite:45]{index=45}


(function(){
  function install(editor){
    function draw(ctx){
      editor.applyCamera(ctx);
      editor.drawGrid(ctx);
      editor.drawUnderlay(ctx);
      editor.renderDirtyChunks(ctx);
    }
    editor.draw = draw;
  }
  window.EditorRender = install;
})();
