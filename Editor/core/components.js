/* ===========================
 * core/components.js
 * =========================== */
function registerStarterComponents(ecscore) {
  var C = ecscore.components;

  // Transform (frei platzierte Dinge)
  C.register({
    id: "Transform",
    version: 1,
    schema: {
      pos: { type: "vec3", default: [0, 0, 0] },
      rot: { type: "vec3", default: [0, 0, 0] },
      scale: { type: "vec3", default: [1, 1, 1] },
    },
    defaults: { pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
    uiHints: { group: "Basic" },
  });

  // GEOMETRY v2 — Maße/Orientierung/Shape-Parameter
  C.register({
    id: "Geometry",
    version: 2,
    schema: {
      type: {
        type: "enum",
        values: ["tile", "object", "area"],
        default: "tile",
      },

      // Abstrakte Formen (export-mappbar)
      shape: {
        type: "enum",
        values: [
          "full",
          "strip",
          "half",
          "cornerL",
          "slope",
          "stair",
          "rect",
          "ellipse",
          "poly",
          "free",
        ],
        default: "full",
      },

      // Grundmaße (Tile-Einheiten)
      size: { type: "vec2?", default: [1, 1] }, // footprint X,Y
      height: { type: "number?", default: 1.0 }, // vertikal
      thickness: { type: "number?", default: null }, // z. B. 0.12 für dünne Wände (bei strip)
      elevation: { type: "number?", default: 0.0 }, // vertikaler Offset (Podest)

      // Platzierung im Tile
      align: {
        type: "enum?",
        values: ["center", "north", "south", "east", "west"],
        default: "center",
      },
      offset: { type: "vec2?", default: [0, 0] }, // lokale Verschiebung

      // Form-Details
      slope: {
        type: "object?",
        default: null,
        shape: {
          angle: { type: "number?", default: null }, // Grad ODER …
          rise: { type: "number?", default: null }, // Höhenanstieg in Tiles
          dir: { type: "enum?", values: ["n", "s", "e", "w"], default: "n" },
        },
      },
      stair: {
        type: "object?",
        default: null,
        shape: {
          steps: { type: "int?", default: 3 },
          dir: { type: "enum?", values: ["n", "s", "e", "w"], default: "n" },
        },
      },

      // Areas
      rect: { type: "vec2?", default: null }, // w×h (Tiles)
      polygon: { type: "vec2[]?", default: null }, // Liste von Punkten

      level: { type: "int", default: 0 },
    },
    defaults: {
      type: "tile",
      shape: "full",
      size: [1, 1],
      height: 1.0,
      elevation: 0.0,
      align: "center",
      offset: [0, 0],
      level: 0,
    },
    uiHints: {
      group: "Form",
      editors: {
        shape: { widget: "icon-grid" },
        size: { widget: "vec2" },
        height: { widget: "number", step: 0.05, min: 0 },
        thickness: { widget: "number", step: 0.01, min: 0 },
        align: { widget: "segmented" },
        slope: { widget: "smart", rules: [{ showIf: { shape: "slope" } }] },
        stair: { widget: "smart", rules: [{ showIf: { shape: "stair" } }] },
        rect: {
          widget: "vec2",
          rules: [{ showIf: { type: "area", shape: "rect" } }],
        },
        polygon: {
          widget: "polygon-editor",
          rules: [{ showIf: { type: "area", shape: "poly" } }],
        },
      },
    },
  });

  // MATERIAL v2 — globales UV + per-Face Overrides + PBR/Transparenz
  C.register({
    id: "Material",
    version: 2,
    schema: {
      defaultTexture: { type: "textureId", required: true },

      uv: {
        type: "object?",
        default: null,
        shape: {
          scale: { type: "vec2?", default: [1, 1] },
          offset: { type: "vec2?", default: [0, 0] },
          rotate: { type: "number?", default: 0 }, // Grad
        },
      },

      faces: {
        type: "object?",
        default: null,
        shape: {
          top: {
            type: "object?",
            default: null,
            shape: {
              textureId: { type: "textureId?" },
              uv: { type: "object?" },
            },
          },
          bottom: {
            type: "object?",
            default: null,
            shape: {
              textureId: { type: "textureId?" },
              uv: { type: "object?" },
            },
          },
          north: {
            type: "object?",
            default: null,
            shape: {
              textureId: { type: "textureId?" },
              uv: { type: "object?" },
            },
          },
          south: {
            type: "object?",
            default: null,
            shape: {
              textureId: { type: "textureId?" },
              uv: { type: "object?" },
            },
          },
          east: {
            type: "object?",
            default: null,
            shape: {
              textureId: { type: "textureId?" },
              uv: { type: "object?" },
            },
          },
          west: {
            type: "object?",
            default: null,
            shape: {
              textureId: { type: "textureId?" },
              uv: { type: "object?" },
            },
          },
        },
      },

      surface: {
        type: "enum",
        values: [
          "opaque",
          "transparent",
          "cutout",
          "glass",
          "emissive",
          "metal",
        ],
        default: "opaque",
      },
      opacity: { type: "number?", min: 0, max: 1, default: 1 },
      doubleSided: { type: "bool?", default: false },
      tint: { type: "color?", default: null },

      roughness: { type: "number?", min: 0, max: 1, default: 0.6 },
      metalness: { type: "number?", min: 0, max: 1, default: 0.0 },
      emission: { type: "number?", min: 0, max: 10, default: 0.0 },
      normalMap: { type: "textureId?", default: null },
      normalScale: { type: "number?", default: 1.0 },
    },
    defaults: {
      surface: "opaque",
      roughness: 0.6,
      metalness: 0.0,
      emission: 0.0,
      opacity: 1,
      doubleSided: false,
    },
    uiHints: {
      group: "Appearance",
      editors: {
        defaultTexture: { widget: "texture-swatch" },
        uv: { widget: "uv-editor", collapsed: true },
        faces: { widget: "per-face", collapsed: true },
        surface: { widget: "segmented" },
        opacity: { widget: "slider", step: 0.05 },
        normalMap: { widget: "texture-swatch" },
      },
    },
  });

  // Physics (reine Spielephysik/Kollision)
  C.register({
    id: "Physics",
    version: 1,
    schema: {
      collidable: { type: "bool", default: false },
      dynamic: { type: "bool", default: false },
      friction: { type: "number?", default: 0.6 },
      bounciness: { type: "number?", default: 0.0 },
    },
    defaults: {
      collidable: false,
      dynamic: false,
      friction: 0.6,
      bounciness: 0.0,
    },
    uiHints: { group: "Physik" },
  });

  // Trigger (ohne Code – reine Daten)
  C.register({
    id: "Trigger",
    version: 1,
    schema: {
      kind: {
        type: "enum",
        values: ["zone", "onUse", "button", "timer"],
        default: "zone",
      },
      events: {
        type: "object?",
        default: {
          /* onEnter/onExit/onUse: Action[] */
        },
      },
      targets: { type: "array?", default: [] }, // entityIds oder tags
    },
    defaults: { kind: "zone", events: {}, targets: [] },
    uiHints: { group: "Trigger" },
  });

  // Hazard (Schaden über Zeit/berührung)
  C.register({
    id: "Hazard",
    version: 1,
    schema: {
      damagePerSecond: { type: "number", default: 10 },
      affectsTags: { type: "array?", default: ["player"] },
    },
    defaults: { damagePerSecond: 10, affectsTags: ["player"] },
    uiHints: { group: "Hazard" },
  });

  // Light (Editor + Spiel)
  C.register({
    id: "Light",
    version: 1,
    schema: {
      intensity: { type: "number", default: 1.0 },
      radius: { type: "number", default: 3.0 },
      color: { type: "color", default: "#FFFFFF" },
      falloff: {
        type: "enum",
        values: ["linear", "quadratic"],
        default: "quadratic",
      },
      castShadows: { type: "bool", default: false },
    },
    defaults: {
      intensity: 1.0,
      radius: 3.0,
      color: "#FFFFFF",
      falloff: "quadratic",
      castShadows: false,
    },
    uiHints: { group: "Licht" },
  });

  // Meta (Editor/UI only)
  C.register({
    id: "Meta",
    version: 1,
    schema: {
      label: { type: "string?", default: null },
      tags: { type: "array?", default: [] },
      displayCategory: {
        type: "enum",
        values: ["terrain", "objects", "zones", "deco"],
        default: "terrain",
      },
    },
    defaults: { tags: [], displayCategory: "terrain" },
    uiHints: { group: "Basic" },
  });

  // Anchor (Objekte an Wänden montieren)
  C.register({
    id: "Anchor",
    version: 1,
    schema: {
      parentId: { type: "int?", default: null },
      face: {
        type: "enum?",
        values: ["north", "south", "east", "west", "ceiling", "floor"],
        default: null,
      },
      u: { type: "number?", default: 0.5 }, // 0..1
      v: { type: "number?", default: 0.5 },
      offset: { type: "number?", default: 0.02 },
    },
    defaults: { parentId: null, face: null, u: 0.5, v: 0.5, offset: 0.02 },
    uiHints: { group: "Form" },
  });

  // Destructible (Zerstörbarkeit/HP)
  C.register({
    id: "Destructible",
    version: 1,
    schema: {
      hpMax: { type: "number", default: 100 },
      hp: { type: "number", default: 100 },
      breakEffect: {
        type: "enum?",
        values: ["shatter_glass", "debris_stone", "none"],
        default: "none",
      },
    },
    defaults: { hpMax: 100, hp: 100, breakEffect: "none" },
    uiHints: { group: "Physik" },
  });
}
