// core-keybinds.js – erweiterter Binding-Manager (ES5, UI-agnostisch)
// Usage (kurz):
//   editor.use(EditorKeybinds);
//   // Aktionen + Default-Bindings (global):
//   editor.defineAction("paintPrimary",  [{ mouseButton:0 }]);          // LMB
//   editor.defineAction("paintErase",    [{ mouseButton:2 }]);          // RMB
//   editor.defineAction("panHold",       [{ mouseButton:1 }]);          // MMB
//   editor.defineAction("toggleSelect",  [{ key:"KeyS" }]);
//   // Kontext-spezifische Bindings:
//   editor.bindContext("boxSelect", "select", [{ mouseButton:0, shift:true }]);
//   // Aktivieren:
//   editor.pushContext("paint");   // höchste Prio liegt rechts (Stackende)
//   editor.pushContext("select");
//   // Abfragen im UI-Adapter (DOM-Event → Aktion):
//   // Pointer:
//   var act = editor.pointerAction({ button:e.button, buttons:e.buttons, ctrl:e.ctrlKey, alt:e.altKey, shift:e.shiftKey });
//   // Keyboard:
//   var kact= editor.keyAction({ code:e.code, ctrl:e.ctrlKey, alt:e.altKey, shift:e.shiftKey });
//   // Remap zur Laufzeit (z. B. User-Dialog):
//   editor.setBinding("paintErase", [{ mouseButton:1 }]);               // global
//   editor.setBinding("boxSelect", [{ mouseButton:0 }], "select");      // im Kontext
//   // Persistenz:
//   localStorage.setItem("emg_keybinds", editor.exportBindings());
//   editor.importBindings(localStorage.getItem("emg_keybinds"));
//
// API (wichtig):
//   defineAction(name, specsArrayOrSpec)               // global überschreiben/setzen
//   bindContext(name, ctxName, specsArrayOrSpec)       // nur im Kontext setzen
//   addBinding(name, spec[, ctx]) / removeBinding(...) // Binding hinzufügen/entfernen
//   setBinding(name, specs[, ctx])                     // Bindings ersetzen (global/ctx)
//   getBinding(name[, ctx]) / getAllBindings()
//   pointerAction(desc) / keyAction(desc)              // Mapping → Aktionsname oder null
//   pointerMatches(desc) / keyMatches(desc)            // alle Matches (Array)
//   pushContext(ctx) / popContext([ctx]) / clearContexts() / getActiveContexts()
//   exportBindings() / importBindings(json)
//   getConflicts()                                     // [{context, actionA, actionB, spec}, ...]
//
// Notes:
//   - Nutzt KeyboardEvent.code (layout-unabhängig), Pointer: button (0..4) & buttons (Bitmaske).
//   - Matching-Reihenfolge: aktive Kontexte (letzter = höchste Prio) → global.
//   - Bei Mehrfach-Treffern gewinnt der zuerst definierte in der jeweils höher priorisierten Ebene.
//   - Konflikte werden bei import/set/add erkannt und via "keybinds:conflict" emittiert.

(function(){
  function install(editor){
    // actions: name -> { global: [spec...], contexts: { ctx: [spec...] } }
    var actions = {};
    var ctxStack = []; // ["paint","select", ...] – letztes Element = höchste Priorität

    function clone(o){ var k, c={}; for(k in o){ c[k]=o[k]; } return c; }
    function cloneArr(a){ var i, r=[]; for(i=0;i<a.length;i++) r.push(clone(a[i])); return r; }
    function isArr(x){ return Object.prototype.toString.call(x)==='[object Array]'; }

    function normalizeSpec(spec){
      var s = {};
      if (!spec) return s;
      if (typeof spec.mouseButton === "number") s.mouseButton = (spec.mouseButton|0);
      if (typeof spec.mouseChord  === "number") s.mouseChord  = (spec.mouseChord|0); // desc.buttons match
      if (typeof spec.key === "string") s.key = spec.key;      // e.g. "KeyS", "Space"
      if (typeof spec.ctrl  === "boolean") s.ctrl  = !!spec.ctrl;
      if (typeof spec.alt   === "boolean") s.alt   = !!spec.alt;
      if (typeof spec.shift === "boolean") s.shift = !!spec.shift;
      return s;
    }
    function normList(specOrArr){
      if (!specOrArr) return [];
      var arr = isArr(specOrArr) ? specOrArr : [specOrArr];
      var out = []; for (var i=0;i<arr.length;i++) out.push(normalizeSpec(arr[i]));
      return out;
    }
    function ensureAction(name){
      if (!actions[name]) actions[name] = { global: [], contexts: {} };
      return actions[name];
    }

    // ---------- Matching ----------
    function matchMods(spec, ctrl, alt, shift){
      if (typeof spec.ctrl  === "boolean" && !!ctrl  !== spec.ctrl)  return false;
      if (typeof spec.alt   === "boolean" && !!alt   !== spec.alt)   return false;
      if (typeof spec.shift === "boolean" && !!shift !== spec.shift) return false;
      return true;
    }
    function specMatchesPointer(spec, desc){
      if (!matchMods(spec, desc.ctrl, desc.alt, desc.shift)) return false;
      if (spec.mouseButton != null && (desc.button|0) !== (spec.mouseButton|0)) return false;
      if (spec.mouseChord  != null && (desc.buttons|0) !== (spec.mouseChord|0)) return false;
      // Wenn weder mouseButton noch mouseChord gesetzt, kein Pointer-Match-Spec
      return (spec.mouseButton != null || spec.mouseChord != null);
    }
    function specMatchesKey(spec, desc){
      if (!spec.key) return false;
      if (!matchMods(spec, desc.ctrl, desc.alt, desc.shift)) return false;
      return spec.key === desc.code;
    }

    function orderedContexts(){
      // höhere Priorität zuletzt
      var out = ctxStack.slice(0);
      out.push(null); // null = global
      return out;
    }

    function findMatch(desc, isKey){
      var ctxs = orderedContexts(), ci, ctx, name, def, i, specs;
      for (ci=ctxs.length-1; ci>=0; ci--){ // von höchster zu niedriger Priorität
        ctx = ctxs[ci];
        for (name in actions){
          def = actions[name];
          specs = ctx ? (def.contexts[ctx] || []) : def.global;
          for (i=0;i<specs.length;i++){
            if (isKey ? specMatchesKey(specs[i], desc) : specMatchesPointer(specs[i], desc)) {
              return { action: name, context: ctx, spec: specs[i] };
            }
          }
        }
      }
      return null;
    }
    function findAllMatches(desc, isKey){
      var res = [], ctxs = orderedContexts(), ci, ctx, name, def, i, specs;
      for (ci=ctxs.length-1; ci>=0; ci--){
        ctx = ctxs[ci];
        for (name in actions){
          def = actions[name];
          specs = ctx ? (def.contexts[ctx] || []) : def.global;
          for (i=0;i<specs.length;i++){
            if (isKey ? specMatchesKey(specs[i], desc) : specMatchesPointer(specs[i], desc)) {
              res.push({ action: name, context: ctx, spec: specs[i] });
            }
          }
        }
      }
      return res;
    }

    // ---------- Konflikte ----------
    function conflictsForSpec(targetSpec, ctxName, excludeAction){
      var list = [], name, def, specs, i;
      for (name in actions){
        if (excludeAction && name === excludeAction) continue;
        def = actions[name];
        specs = ctxName ? (def.contexts[ctxName] || []) : def.global;
        for (i=0;i<specs.length;i++){
          var s = specs[i];
          var isPointer = (s.mouseButton != null || s.mouseChord != null);
          var isPointerT = (targetSpec.mouseButton != null || targetSpec.mouseChord != null);
          var clash = false;
          if (isPointer && isPointerT){
            // gleicher Button ODER gleiche Chord + gleiche Modifier
            var btnSame = (s.mouseButton != null && targetSpec.mouseButton != null && (s.mouseButton|0)===(targetSpec.mouseButton|0));
            var chordSame = (s.mouseChord != null && targetSpec.mouseChord != null && (s.mouseChord|0)===(targetSpec.mouseChord|0));
            var modsSame = (!!s.ctrl===!!targetSpec.ctrl) && (!!s.alt===!!targetSpec.alt) && (!!s.shift===!!targetSpec.shift);
            clash = modsSame && (btnSame || chordSame);
          } else if (s.key && targetSpec.key){
            var modsSameK = (!!s.ctrl===!!targetSpec.ctrl) && (!!s.alt===!!targetSpec.alt) && (!!s.shift===!!targetSpec.shift);
            clash = modsSameK && (s.key === targetSpec.key);
          }
          if (clash) list.push({ context: ctxName||"global", actionA: name, actionB: excludeAction||"(new)", spec: clone(targetSpec) });
        }
      }
      return list;
    }
    function getConflicts(){
      var out=[], name, def, i, specs;
      // global
      for (name in actions){
        def = actions[name];
        specs = def.global;
        for (i=0;i<specs.length;i++){
          out = out.concat(conflictsForSpec(specs[i], null, name));
        }
        // contexts
        var ctx; for (ctx in def.contexts){
          var arr = def.contexts[ctx]||[];
          for (i=0;i<arr.length;i++){
            out = out.concat(conflictsForSpec(arr[i], ctx, name));
          }
        }
      }
      // Duplikate filtern (grobe Dedup)
      var dedup = [], seen={};
      for (i=0;i<out.length;i++){
        var k = out[i].context+"|"+out[i].spec.key+"|"+out[i].spec.mouseButton+"|"+out[i].spec.mouseChord+"|"+out[i].spec.ctrl+"|"+out[i].spec.alt+"|"+out[i].spec.shift+"|"+out[i].actionA+"|"+out[i].actionB;
        if (!seen[k]){ seen[k]=1; dedup.push(out[i]); }
      }
      return dedup;
    }

    function emitConflict(list){
      if (list && list.length && editor.emit) editor.emit("keybinds:conflict", { conflicts: list });
    }

    // ---------- Public: Definition / Änderung ----------
    function defineAction(name, specs){
      name = String(name||"").trim(); if (!name) return false;
      var def = ensureAction(name);
      def.global = normList(specs);
      var cf = []; for (var i=0;i<def.global.length;i++) cf = cf.concat(conflictsForSpec(def.global[i], null, name));
      emitConflict(cf);
      return true;
    }
    function bindContext(name, ctxName, specs){
      name = String(name||"").trim(); if (!name) return false;
      ctxName = String(ctxName||"").trim(); if (!ctxName) return false;
      var def = ensureAction(name);
      def.contexts[ctxName] = normList(specs);
      var cf = []; for (var i=0;i<def.contexts[ctxName].length;i++) cf = cf.concat(conflictsForSpec(def.contexts[ctxName][i], ctxName, name));
      emitConflict(cf);
      return true;
    }
    function addBinding(name, spec, ctx){
      if (!actions[name]) ensureAction(name);
      var list = ctx ? (actions[name].contexts[ctx] = actions[name].contexts[ctx]||[]) : actions[name].global;
      var s = normalizeSpec(spec); list.push(s);
      emitConflict(conflictsForSpec(s, ctx||null, name));
      return true;
    }
    function removeBinding(name, predicate, ctx){
      var list = ctx ? (actions[name] && actions[name].contexts[ctx]) : (actions[name] && actions[name].global);
      if (!list || !list.length) return 0;
      var kept=[], removed=0, i;
      if (typeof predicate !== "function"){
        // predicate als spec vergleichen
        var target = normalizeSpec(predicate||{});
        predicate = function(s){ // einfacher Gleichheitscheck
          return (!!target.key===!!s.key) && (target.key? target.key===s.key : true) &&
                 ((target.mouseButton|0)===(s.mouseButton|0)) &&
                 ((target.mouseChord|0)===(s.mouseChord|0)) &&
                 (!!target.ctrl===!!s.ctrl) && (!!target.alt===!!s.alt) && (!!target.shift===!!s.shift);
        };
      }
      for (i=0;i<list.length;i++){ if (predicate(list[i])) removed++; else kept.push(list[i]); }
      if (ctx) actions[name].contexts[ctx] = kept; else actions[name].global = kept;
      return removed;
    }
    function setBinding(name, specs, ctx){
      if (!actions[name]) ensureAction(name);
      var arr = normList(specs);
      if (ctx){ actions[name].contexts[ctx] = arr; }
      else { actions[name].global = arr; }
      var cf = [], i; for (i=0;i<arr.length;i++) cf = cf.concat(conflictsForSpec(arr[i], ctx||null, name));
      emitConflict(cf);
      return true;
    }

    function getBinding(name, ctx){
      if (!actions[name]) return null;
      var def = actions[name];
      if (ctx){ return def.contexts[ctx] ? cloneArr(def.contexts[ctx]) : []; }
      return cloneArr(def.global);
    }
    function getAllBindings(){
      var out={}, name, def, ctx;
      for (name in actions){
        def = actions[name];
        out[name] = { global: cloneArr(def.global), contexts: {} };
        for (ctx in def.contexts){ out[name].contexts[ctx] = cloneArr(def.contexts[ctx]); }
      }
      return out;
    }

    // ---------- Kontexte ----------
    function pushContext(ctx){ ctx = String(ctx||"").trim(); if (!ctx) return; ctxStack.push(ctx); editor.emit && editor.emit("keybinds:context", { active:getActiveContexts() }); }
    function popContext(ctx){
      if (!ctx){ ctxStack.pop(); }
      else {
        var i = ctxStack.lastIndexOf(ctx);
        if (i>=0) ctxStack.splice(i,1);
      }
      editor.emit && editor.emit("keybinds:context", { active:getActiveContexts() });
    }
    function clearContexts(){ ctxStack.length = 0; editor.emit && editor.emit("keybinds:context", { active:[] }); }
    function getActiveContexts(){ return ctxStack.slice(0); }

    // ---------- Import/Export ----------
    function exportBindings(){
      try { return JSON.stringify(actions); } catch(e){ return "{}"; }
    }
    function importBindings(json){
      try{
        var obj = JSON.parse(json||"{}");
        if (!obj || typeof obj!=="object") return false;
        actions = {};
        var name, def, ctx;
        for (name in obj){
          def = obj[name] || {};
          actions[name] = { global: normList(def.global||[]), contexts: {} };
          var cxs = def.contexts || {};
          for (ctx in cxs){ actions[name].contexts[ctx] = normList(cxs[ctx]); }
        }
        emitConflict(getConflicts());
        editor.emit && editor.emit("keybinds:changed", { all:getAllBindings() });
        return true;
      }catch(e){ return false; }
    }

    // ---------- Public Matching ----------
    function pointerAction(desc){ var m = findMatch(desc||{}, false); return m ? m.action : null; }
    function keyAction(desc){ var m = findMatch(desc||{}, true); return m ? m.action : null; }
    function pointerMatches(desc){ return findAllMatches(desc||{}, false); }
    function keyMatches(desc){ return findAllMatches(desc||{}, true); }

    // ---------- Export API ----------
    editor.defineAction    = defineAction;
    editor.bindContext     = bindContext;
    editor.addBinding      = addBinding;
    editor.removeBinding   = removeBinding;
    editor.setBinding      = setBinding;
    editor.getBinding      = getBinding;
    editor.getAllBindings  = getAllBindings;

    editor.pointerAction   = pointerAction;
    editor.keyAction       = keyAction;
    editor.pointerMatches  = pointerMatches;
    editor.keyMatches      = keyMatches;

    editor.pushContext     = pushContext;
    editor.popContext      = popContext;
    editor.clearContexts   = clearContexts;
    editor.getActiveContexts = getActiveContexts;

    editor.exportBindings  = exportBindings;
    editor.importBindings  = importBindings;
    editor.getConflicts    = getConflicts;
  }
  window.EditorKeybinds = install;
})();
