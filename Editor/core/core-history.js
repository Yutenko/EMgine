// core-history.js – undo/redo with compound actions
(function(){
  function install(editor){
    var history = { undo:[], redo:[], limit:200, compound:null };
    function clearHistory(){ history.undo.length=0; history.redo.length=0; history.compound=null; }
    function setUndoLimit(n){ history.limit=Math.max(1, n|0); while(history.undo.length>history.limit) history.undo.shift(); while(history.redo.length>history.limit) history.redo.shift(); }
    function getUndoInfo(){ return {undo:history.undo.length, redo:history.redo.length, limit:history.limit, inCompound:!!history.compound}; }
    function beginCompound(label){ if(history.compound) return false; history.compound={type:"compound", label:label||"", actions:[]}; return true; }
    function endCompound(cancel){ if(!history.compound) return false; var comp=history.compound; history.compound=null; if(cancel||!comp.actions.length) return false; history.undo.push(comp); if(history.undo.length>history.limit) history.undo.shift(); history.redo.length=0; return true; }
    function pushAction(act){ if(history.compound) history.compound.actions.push(act); else { history.undo.push(act); if(history.undo.length>history.limit) history.undo.shift(); history.redo.length=0; } }

    function applyChange(change, useNext){
      var id = useNext ? change.next : change.prev;
      if (editor.setTileRaw) editor.setTileRaw(change.level|0, change.layer, change.col|0, change.row|0, id|0);
    }
    function applyAction(act, dir){
      if (!act) return;
      if (act.type==="setTiles"){
        var useNext = dir==="redo";
        if (dir==="undo"){ for (var i=act.changes.length-1;i>=0;i--) applyChange(act.changes[i], useNext); }
        else { for (var j=0;j<act.changes.length;j++) applyChange(act.changes[j], useNext); }
      } else if (act.type==="compound" && act.actions && act.actions.length){
        if (dir==="undo"){ for (var k=act.actions.length-1;k>=0;k--) applyAction(act.actions[k], "undo"); }
        else { for (var m=0;m<act.actions.length;m++) applyAction(act.actions[m], "redo"); }
      }
    }
    function undo(){ if(!history.undo.length) return false; var a=history.undo.pop(); applyAction(a,"undo"); history.redo.push(a); if(history.redo.length>history.limit) history.redo.shift(); editor.requestRender(); return true; }
    function redo(){ if(!history.redo.length) return false; var a=history.redo.pop(); applyAction(a,"redo"); history.undo.push(a); if(history.undo.length>history.limit) history.undo.shift(); editor.requestRender(); return true; }

    editor.clearHistory = clearHistory;
    editor.setUndoLimit = setUndoLimit;
    editor.getUndoInfo = getUndoInfo;
    editor.beginCompound = beginCompound;
    editor.endCompound = endCompound;
    editor.pushAction = pushAction;
    editor.undo = undo;
    editor.redo = redo;
  }
  window.EditorHistory = install;
})();
