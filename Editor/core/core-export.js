// core-export.js – JSON Export Plugin for Three.js
(function () {
  function install(editor) {
    function exportToJSON() {
      const world = editor.getWorld();
      const levelsData = editor.levelsState;
      const tilesets = editor.getTilesets ? editor.getTilesets() : [];
      const allTiles = editor.getAllTiles ? editor.getAllTiles() : [];

      // Convert Uint16Arrays to regular arrays for JSON serialization
      function typedArrayToArray(typedArray) {
        if (!typedArray) return [];
        return Array.from(typedArray);
      }

      // Build tilesets data
      const tilesetsExport = tilesets.map(ts => ({
        id: ts.id,
        name: ts.name || "unnamed",
        type: ts.type,
        tileWidth: ts.tileWidth || 0,
        tileHeight: ts.tileHeight || 0,
        columns: ts.columns || 0,
        rows: ts.rows || 0,
        imageWidth: ts.width || 0,
        imageHeight: ts.height || 0
      }));

      // Build tile catalog data
      const tileCatalogExport = allTiles.map(tile => ({
        id: tile.id,
        tilesetId: tile.tilesetId,
        type: tile.type,
        atlasIndex: tile.atlasIndex || 0,
        col: tile.col || 0,
        row: tile.row || 0,
        tileWidth: tile.tileWidth || 0,
        tileHeight: tile.tileHeight || 0
      }));

      // Build levels data
      const levelsExport = [];
      for (let levelIndex = 0; levelIndex < levelsData.count; levelIndex++) {
        const levelData = levelsData.data[levelIndex];
        const layersExport = {};

        // Export each layer
        ['floor', 'wall', 'decor', 'entities'].forEach(layerName => {
          if (levelData && levelData[layerName]) {
            layersExport[layerName] = {
              visible: levelsData.show[layerName] !== false,
              data: typedArrayToArray(levelData[layerName])
            };
          }
        });

        levelsExport.push({
          index: levelIndex,
          layers: layersExport
        });
      }

      // Create the complete export object
      const exportData = {
        metadata: {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          world: {
            tileSize: world.tileSize,
            cols: world.cols,
            rows: world.rows,
            width: world.width,
            height: world.height
          },
          levels: {
            count: levelsData.count,
            current: levelsData.current
          }
        },
        tilesets: tilesetsExport,
        tileCatalog: tileCatalogExport,
        levels: levelsExport
      };

      return exportData;
    }

    function downloadJSON(data, filename = 'map-export.json') {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }

    function showExportDialog() {
      try {
        const exportData = exportToJSON();

        // Create a simple preview
        const preview = JSON.stringify(exportData, null, 2).substring(0, 500) + '...';

        if (confirm(`Export map data to JSON file?\n\nPreview:\n${preview}\n\nThis will download a JSON file with ${exportData.levels.length} levels and all tile data.`)) {
          downloadJSON(exportData, `map-export-${new Date().toISOString().split('T')[0]}.json`);
          console.log('Map exported successfully');
        }
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed: ' + error.message);
      }
    }

    // Add export function to editor
    editor.exportToJSON = exportToJSON;
    editor.downloadMapJSON = function(filename) {
      const data = exportToJSON();
      downloadJSON(data, filename);
    };
    editor.showExportDialog = showExportDialog;

    // Auto-export on Ctrl+E if not already handled
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        showExportDialog();
      }
    });

    console.log('JSON Export plugin installed. Press Ctrl+E to export or use editor.showExportDialog()');
  }

  window.EditorExport = install;
})();