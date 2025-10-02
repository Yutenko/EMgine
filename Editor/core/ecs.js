/* ===========================
 * core/ecs.js  (ES5, IIFE)
 * =========================== */
var ECS = (function(){
  function createArray(){ return []; }
  function createObj(){ return {}; }

  /* ---------- Deep Merge mit "unset via null" ---------- */
  function deepMerge(base, over){
    if (over == null) return base;
    if (typeof base !== 'object' || base === null) {
      return (over === null) ? undefined : copy(over);
    }
    if (typeof over !== 'object' || over === null) {
      return (over === null) ? undefined : copy(over);
    }
    // beide Objekte/Arrays
    var out, k, i;
    if (Array.isArray(base) || Array.isArray(over)) {
      // Arrays: überschreiben komplett, außer over === null (oben schon handled)
      return copy(over);
    } else {
      out = {};
      // keys aus base
      for (k in base) if (Object.prototype.hasOwnProperty.call(base,k)) out[k] = copy(base[k]);
      // keys aus over
      for (k in over) if (Object.prototype.hasOwnProperty.call(over,k)) {
        var merged = deepMerge(out[k], over[k]);
        if (merged === undefined) delete out[k]; else out[k] = merged;
      }
      return out;
    }
  }
  function copy(v){
    if (v == null) return v;
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) { var a = []; for (var i=0;i<v.length;i++) a[i]=copy(v[i]); return a; }
    var o = {}; for (var k in v) if (Object.prototype.hasOwnProperty.call(v,k)) o[k]=copy(v[k]);
    return o;
  }

  /* ---------- Entity Manager ---------- */
  function EntityManager(){
    var nextId = 1;
    var entities = createArray(); // list of ids
    return {
      create: function(){ var id = nextId++; entities.push(id); return id; },
      destroy: function(id){
        var i = entities.indexOf(id); if (i>=0) entities.splice(i,1);
      },
      all: function(){ return entities.slice(0); },
      reset: function(){ nextId=1; entities.length=0; }
    };
  }

  /* ---------- Component Registry ---------- */
  function ComponentRegistry(){
    var defs = createObj();      // id -> {schema, defaults, uiHints, version}
    var store = createObj();     // id -> { entityId: data }

    function register(def){
      if (!def || !def.id) throw new Error('Component def needs id');
      defs[def.id] = {
        id: def.id,
        schema: def.schema || {},
        defaults: def.defaults || {},
        uiHints: def.uiHints || {},
        version: def.version || 1
      };
      if (!store[def.id]) store[def.id] = createObj();
    }

    function add(entityId, type, data){
      if (!defs[type]) throw new Error('Unknown component '+type);
      var merged = deepMerge(defs[type].defaults, data || {});
      store[type][entityId] = merged;
      return merged;
    }

    function get(entityId, type){
      var t = store[type]; return t ? t[entityId] : null;
    }

    function has(entityId, type){
      var t = store[type]; return !!(t && t[entityId]);
    }

    function remove(entityId, type){
      if (store[type] && store[type][entityId]) delete store[type][entityId];
    }

    function ofType(type){ return store[type] || {}; }

    function types(){ var a=[], k; for(k in defs) if (Object.prototype.hasOwnProperty.call(defs,k)) a.push(k); return a; }

    function validate(entityId, type){
      // minimal: du kannst hier echte Schemaprüfung ergänzen
      // aktuell: nur existence-check
      return !!(store[type] && store[type][entityId]);
    }

    function serializeEntity(entityId){
      var out = {}, k;
      for (k in defs) if (Object.prototype.hasOwnProperty.call(defs,k)) {
        if (store[k] && store[k][entityId]) out[k] = copy(store[k][entityId]);
      }
      return out;
    }

    function deserializeEntity(entityId, compData){
      var k;
      for (k in compData) if (Object.prototype.hasOwnProperty.call(compData,k)) {
        add(entityId, k, compData[k]);
      }
    }

    function clearEntity(entityId){
      var k; for (k in store) if (Object.prototype.hasOwnProperty.call(store,k)) {
        if (store[k][entityId]) delete store[k][entityId];
      }
    }

    return {
      register: register,
      add: add, get: get, has: has, remove: remove,
      ofType: ofType, types: types, validate: validate,
      serializeEntity: serializeEntity,
      deserializeEntity: deserializeEntity,
      clearEntity: clearEntity,
      _defs: defs, _store: store
    };
  }

  /* ---------- System Manager ---------- */
  function SystemManager(){
    var systems = [];
    return {
      register: function(sys){ systems.push(sys); },
      update: function(dt, ctx){
        for (var i=0;i<systems.length;i++){
          if (systems[i] && typeof systems[i].update === 'function') systems[i].update(dt, ctx);
        }
      },
      list: function(){ return systems.slice(0); }
    };
  }

  /* ---------- Query Helper ---------- */
  function Query(em, cr){
    function queryAll(requiredTypes){
      var ids = em.all();
      var out = [];
      for (var i=0;i<ids.length;i++){
        var ok = true;
        for (var j=0;j<requiredTypes.length;j++){
          if (!cr.has(ids[i], requiredTypes[j])) { ok=false; break; }
        }
        if (ok) out.push(ids[i]);
      }
      return out;
    }
    return { allWith: queryAll };
  }

  /* ---------- Prefab Registry (mit Variants & Overrides) ---------- */
  function PrefabRegistry(cr){
    // Wir nutzen "Prefab" (Standard-Begriff) + Variants via extends/overrides
    var prefabs = createObj(); // id -> def {id,label,components,extends?,overrides?}

    function register(def){
      if (!def || !def.id) throw new Error('Prefab needs id');
      prefabs[def.id] = copy(def);
    }

    function get(id){ return prefabs[id]; }

    // Auflösen von extends-Kette + overrides zu einem "effektiven" Komponentenbündel
    function resolveEffectiveComponents(prefabId){
      var seen = {};
      function resolveOne(id){
        if (!id) return { components:{} };
        if (seen[id]) throw new Error('Cyclic prefab extends: '+id);
        seen[id] = true;

        var def = prefabs[id];
        if (!def) throw new Error('Unknown prefab '+id);

        var base = def.extends ? resolveOne(def.extends) : { components:{} };
        var res  = { components: copy(base.components) };

        // apply own base components
        if (def.components) res.components = deepMerge(res.components, def.components);
        // apply overrides (variant)
        if (def.overrides) res.components = deepMerge(res.components, def.overrides);
        return res;
      }
      return resolveOne(prefabId).components;
    }

    // Entity erzeugen: base + variants + runtime overrides
    function spawn(em, opts){
      // opts: { prefabId, overrides?, at?{pos, level} }
      var id = em.create();
      var eff = resolveEffectiveComponents(opts.prefabId);
      // runtime overrides on top
      if (opts && opts.overrides) eff = deepMerge(eff, opts.overrides);

      // Platzierungs-Helfer (optional)
      if (opts && opts.at) {
        if (!eff.Transform && cr._defs.Transform){
          eff.Transform = { pos: [ opts.at.x || 0, opts.at.y || 0, opts.at.z || 0 ] };
        } else if (eff.Transform && opts.at.z != null) {
          eff.Transform.pos = [ opts.at.x || 0, opts.at.y || 0, opts.at.z ];
        }
        if (opts.at.level != null) {
          if (!eff.Geometry) eff.Geometry = { type:"tile", level: opts.at.level };
          else eff.Geometry.level = opts.at.level;
        }
      }

      // Komponenten anlegen
      var k;
      for (k in eff) if (Object.prototype.hasOwnProperty.call(eff,k)) {
        cr.add(id, k, eff[k]);
      }
      return id;
    }

    return { register: register, get: get, resolveEffectiveComponents: resolveEffectiveComponents, spawn: spawn, _data: prefabs };
  }

  /* ---------- Serializer ---------- */
  function Serializer(em, cr){
    function save(){
      var ids = em.all();
      var out = { schemaVersion: 1, entities: [] };
      for (var i=0;i<ids.length;i++){
        out.entities.push({ id: ids[i], components: cr.serializeEntity(ids[i]) });
      }
      return out;
    }
    function load(json){
      // sehr simple Variante (keine Migrations hier)
      var list = json.entities || [];
      for (var i=0;i<list.length;i++){
        var eid = em.create();
        cr.deserializeEntity(eid, list[i].components);
      }
    }
    return { save: save, load: load };
  }

  /* ---------- ECS Root ---------- */
  function create(){
    var em = EntityManager();
    var cr = ComponentRegistry();
    var sm = SystemManager();
    var q  = Query(em, cr);

    return {
      entities: em,
      components: cr,
      systems: sm,
      query: q,
      prefabs: PrefabRegistry(cr),
      serializer: Serializer(em, cr),
      util: { deepMerge: deepMerge, copy: copy }
    };
  }

  return { create: create };
})();
