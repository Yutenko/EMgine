/* ===========================
 * core/components.js
 * =========================== */
function registerStarterComponents(ecscore){
  var C = ecscore.components;

  // Transform (frei platzierte Dinge)
  C.register({
    id: "Transform",
    version: 1,
    schema: {
      pos: { type:"vec3", default:[0,0,0] },
      rot: { type:"vec3", default:[0,0,0] },
      scale: { type:"vec3", default:[1,1,1] }
    },
    defaults: { pos:[0,0,0], rot:[0,0,0], scale:[1,1,1] },
    uiHints: { group:"Basic" }
  });

  // Geometry (tile/object/area)
  C.register({
    id: "Geometry",
    version: 1,
    schema: {
      type:  { type:"enum", values:["tile","object","area"], default:"tile" },
      shape: { type:"enum", values:["full","thin","thick","strip","half","cornerL","slope25","slope45","stairN","rect","ellipse","poly","free"], default:"full" },
      params:{ type:"object?", default:{} }, // z.B. size, steps, polygon
      level: { type:"int", default:0 }
    },
    defaults: { type:"tile", shape:"full", params:{ size:[1,1] }, level:0 },
    uiHints: { group:"Form" }
  });

  // Material (Appearance), inkl. per-face Texturen
  C.register({
    id: "Material",
    version: 1,
    schema: {
      defaultTexture: { type:"textureId", required:true },
      faces: { type:"object?", default:null }, // {top:{textureId,...}, north:{...}, ...}
      surface: { type:"enum", values:["opaque","glass","metal","emissive"], default:"opaque" },
      tint: { type:"color?", default:null },
      roughness: { type:"number?", min:0, max:1, default:0.6 },
      metalness: { type:"number?", min:0, max:1, default:0.0 },
      emission: { type:"number?", min:0, max:10, default:0.0 }
    },
    defaults: { surface:"opaque", roughness:0.6, metalness:0.0, emission:0.0 },
    uiHints: {
      group:"Appearance",
      editors: { faces:{ widget:"per-face", collapsed:true } }
    }
  });

  // Physics (reine Spielephysik/Kollision)
  C.register({
    id: "Physics",
    version: 1,
    schema: {
      collidable: { type:"bool", default:false },
      dynamic:    { type:"bool", default:false },
      friction:   { type:"number?", default:0.6 },
      bounciness: { type:"number?", default:0.0 }
    },
    defaults: { collidable:false, dynamic:false, friction:0.6, bounciness:0.0 },
    uiHints: { group:"Physik" }
  });

  // Trigger (ohne Code – reine Daten)
  C.register({
    id: "Trigger",
    version: 1,
    schema: {
      kind: { type:"enum", values:["zone","onUse","button","timer"], default:"zone" },
      events: { type:"object?", default:{ /* onEnter/onExit/onUse: Action[] */ } },
      targets: { type:"array?", default:[] } // entityIds oder tags
    },
    defaults: { kind:"zone", events:{}, targets:[] },
    uiHints: { group:"Trigger" }
  });

  // Hazard (Schaden über Zeit/berührung)
  C.register({
    id: "Hazard",
    version: 1,
    schema: {
      damagePerSecond: { type:"number", default:10 },
      affectsTags:     { type:"array?", default:["player"] }
    },
    defaults: { damagePerSecond:10, affectsTags:["player"] },
    uiHints: { group:"Hazard" }
  });

  // Light (Editor + Spiel)
  C.register({
    id: "Light",
    version: 1,
    schema: {
      intensity: { type:"number", default:1.0 },
      radius:    { type:"number", default:3.0 },
      color:     { type:"color", default:"#FFFFFF" },
      falloff:   { type:"enum", values:["linear","quadratic"], default:"quadratic" },
      castShadows: { type:"bool", default:false }
    },
    defaults: { intensity:1.0, radius:3.0, color:"#FFFFFF", falloff:"quadratic", castShadows:false },
    uiHints: { group:"Licht" }
  });

  // Meta (Editor/UI only)
  C.register({
    id: "Meta",
    version: 1,
    schema: {
      label: { type:"string?", default:null },
      tags:  { type:"array?", default:[] },
      displayCategory: { type:"enum", values:["terrain","objects","zones","deco"], default:"terrain" }
    },
    defaults: { tags:[], displayCategory:"terrain" },
    uiHints: { group:"Basic" }
  });

  // Anchor (Objekte an Wänden montieren)
  C.register({
    id: "Anchor",
    version: 1,
    schema: {
      parentId: { type:"int?", default:null },
      face:     { type:"enum?", values:["north","south","east","west","ceiling","floor"], default:null },
      u:        { type:"number?", default:0.5 }, // 0..1
      v:        { type:"number?", default:0.5 },
      offset:   { type:"number?", default:0.02 }
    },
    defaults: { parentId:null, face:null, u:0.5, v:0.5, offset:0.02 },
    uiHints: { group:"Form" }
  });

  // Destructible (Zerstörbarkeit/HP)
  C.register({
    id: "Destructible",
    version: 1,
    schema: {
      hpMax: { type:"number", default:100 },
      hp:    { type:"number", default:100 },
      breakEffect: { type:"enum?", values:["shatter_glass","debris_stone","none"], default:"none" }
    },
    defaults: { hpMax:100, hp:100, breakEffect:"none" },
    uiHints: { group:"Physik" }
  });
}
