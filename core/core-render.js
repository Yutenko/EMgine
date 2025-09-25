// core-render.js – orchestrates draw order
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
