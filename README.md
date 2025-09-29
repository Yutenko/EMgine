# EMgine Editor

Ein modularer, webbasierter **2D Tilemap-Editor**, der JSON-Maps für die Weiterverwendung in 3D (z. B. mit Three.js) erzeugt.  
Der Fokus liegt auf **einfacher Bedienung**, einer **Plugin-Architektur** und **UI-Agnostik** (Core ist reines ES5-JavaScript, UI kann frei gewählt werden – z. B. Svelte, React oder Vanilla).

## Features
- Plugin-Architektur (`editor.use(plugin)`)
- Chunks, Dirty-Rects, Offscreen-Canvas für Performance
- Undo/Redo mit Compound Actions
- Tools:
  - **Paint Tool** (Bresenham, Brush, Erase)
  - **Pan Tool** (Kamera bewegen, Zoom)
  - **Selection Tool** (Rechteck, Move, Copy/Paste, Rotate)
- Overlays: Grid, Rulers, Selection
- Frei konfigurierbare **Keybindings** (Maus + Tastatur, Kontexte, Import/Export)
