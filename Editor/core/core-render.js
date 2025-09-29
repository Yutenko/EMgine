// core-render.js – Zeichenreihenfolge bündeln
// Usage:
//   editor.use(EditorRender); // der Frame-Loop aus core-base ruft editor.draw(ctx) auf
// Pipeline (Default):
//   applyCamera(ctx) → drawGrid(ctx) → drawUnderlay(ctx) → renderDirtyChunks(ctx)
// Notes:
//   Erwartet, dass die genannten Methoden von Plugins bereitgestellt sind. :contentReference[oaicite:45]{index=45}

// core-render.js – orchestrates draw order
(function () {
  function install(editor) {
    function draw(ctx) {
      // 1) Kamera setzen
      editor.applyCamera && editor.applyCamera(ctx);

      // 2) (optional) Underlay & Grid (Reihenfolge nach Geschmack)
      editor.drawGrid && editor.drawGrid(ctx); // wenn du Grid unter den Tiles willst: vor Chunks
      editor.drawUnderlay && editor.drawUnderlay(ctx); // Nachbar-Levels

      // 3) Tiles/Layers (Chunks)
      editor.renderDirtyChunks && editor.renderDirtyChunks(ctx);

      // 4) (NEU) Selection-Overlay (Marquee, Move-/Floating-Ghost)
      editor.drawSelectionOverlay && editor.drawSelectionOverlay(ctx);

      // 5) (optional) Things/HUD/Cursor etc.
      editor.drawThings && editor.drawThings(ctx);
      editor.drawHud && editor.drawHud(ctx);
    }
    editor.draw = draw;
  }
  window.EditorRender = install;
})();
