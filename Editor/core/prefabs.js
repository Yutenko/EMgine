/* ===========================
 * core/prefabs.js
 * =========================== */
function registerExamplePrefabs(ecscore){
  var P = ecscore.prefabs;

  // Basis: Wall (dünn, Ziegel)
  P.register({
    id: "wall_base",
    label: "Wall (Base)",
    components: {
      Geometry: { type:"tile", shape:"thin", params:{ size:[1,1] }, level:0 },
      Material: { defaultTexture:"brick_01", surface:"opaque" },
      Physics:  { collidable:true },
      Meta:     { displayCategory:"terrain", tags:["wall"] }
    }
  });

  // Variante: Wall (dick)
  P.register({
    id: "wall_thick",
    extends: "wall_base",
    label: "Wall – dick",
    overrides: { Geometry: { shape:"thick" } }
  });

  // Variante: Wall (strip, Glas)
  P.register({
    id: "wall_strip_glass",
    extends: "wall_base",
    label: "Wall – strip (Glas)",
    overrides: {
      Geometry: { shape:"strip" },
      Material: { defaultTexture:"glass_clear", surface:"glass", roughness:0.05 }
    }
  });

  // Basis: Floor (voll, Gras)
  P.register({
    id: "floor_base",
    label: "Floor (Base)",
    components: {
      Geometry: { type:"tile", shape:"full", params:{ size:[1,1] }, level:0 },
      Material: { defaultTexture:"grass_01", surface:"opaque" },
      Physics:  { collidable:false },
      Meta:     { displayCategory:"terrain", tags:["floor"] }
    }
  });

  // Floor (Schnee)
  P.register({
    id: "floor_snow",
    extends: "floor_base",
    label: "Floor – Schnee",
    overrides: { Material: { defaultTexture:"snow_01" } }
  });

  // Zone: Trigger (rect)
  P.register({
    id: "zone_trigger_rect",
    label: "Zone – Trigger (Rect)",
    components: {
      Geometry: { type:"area", shape:"rect", params:{ size:[1,1] }, level:0 },
      Trigger:  { kind:"zone", events:{ onEnter:[], onExit:[] }, targets:[] },
      Meta:     { displayCategory:"zones", tags:["zone","trigger"] }
    }
  });

  // Zone: Hurt (lava)
  P.register({
    id: "zone_hurt_lava",
    extends: "zone_trigger_rect",
    label: "Zone – Hurt (Lava)",
    overrides: {
      Trigger: null, // entfernt Trigger
      Hazard: { damagePerSecond: 25, affectsTags: ["player","enemy"] },
      Meta: { tags:["zone","hurt"] }
    }
  });

  // Objekt: Tür (platzierbar)
  P.register({
    id: "door_wood",
    label: "Door – Holz",
    components: {
      Geometry: { type:"object", shape:"rect", params:{ size:[1,2] }, level:0 },
      Material: { defaultTexture:"door_wood_01", surface:"opaque" },
      Physics:  { collidable:true },
      Meta:     { displayCategory:"objects", tags:["door","interact"] }
    }
  });

  // Licht
  P.register({
    id: "light_small",
    label: "Light – small",
    components: {
      Transform:{ pos:[0,0,0] },
      Light: { intensity:0.8, radius:3.5, color:"#FFD080", falloff:"quadratic", castShadows:false },
      Meta:  { displayCategory:"objects", tags:["light"] }
    }
  });
}
