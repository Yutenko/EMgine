// ui-tile-selector.js – Select tiles by dragging a rectangle on the canvas
(function(){
  function onReady() {
    var editor = window.editor;
    if (!editor) {
      document.addEventListener("editor:ready", onReady, { once: true });
      return;
    }

    var canvas = editor.getCanvas();
    var isSelecting = false;
    var startX = 0, startY = 0, endX = 0, endY = 0;
    var selectionRect = null;
    var previewCanvas = null;

    function toolMode() {
      return window.emToolMode || "paint";
    }

    // Listen for tool changes
    window.addEventListener("em:setTool", function(ev) {
      var tool = ev && ev.detail && ev.detail.tool;
      if (tool === "selectTiles") {
        canvas.style.cursor = "crosshair";
      } else {
        canvas.style.cursor = "";
        hideSelection();
      }
    });

    function showSelection() {
      if (!selectionRect) {
        selectionRect = document.createElement("div");
        selectionRect.style.position = "fixed";
        selectionRect.style.border = "2px dashed #64b5f6";
        selectionRect.style.background = "rgba(100, 181, 246, 0.1)";
        selectionRect.style.pointerEvents = "none";
        selectionRect.style.zIndex = "10050";
        document.body.appendChild(selectionRect);
      }
      updateSelectionRect();
    }

    function hideSelection() {
      if (selectionRect) {
        selectionRect.style.display = "none";
      }
      if (previewCanvas) {
        previewCanvas.style.display = "none";
      }
    }

    function updateSelectionRect() {
      if (!selectionRect) return;

      var left = Math.min(startX, endX);
      var top = Math.min(startY, endY);
      var width = Math.abs(endX - startX);
      var height = Math.abs(endY - startY);

      selectionRect.style.left = left + "px";
      selectionRect.style.top = top + "px";
      selectionRect.style.width = width + "px";
      selectionRect.style.height = height + "px";
      selectionRect.style.display = "block";
    }

    function createPreviewCanvas() {
      if (!previewCanvas) {
        previewCanvas = document.createElement("canvas");
        previewCanvas.className = "tile-selector-preview";
        document.body.appendChild(previewCanvas);
      }
      return previewCanvas;
    }

    function updatePreview(mouseX, mouseY) {
      if (!previewCanvas || !editor.getBrushPattern || !editor.getBrushPattern()) return;

      var pattern = editor.getBrushPattern();
      if (!pattern || !pattern.w || !pattern.h) return;

      var tileSize = editor.getTileSize ? editor.getTileSize() : 16;
      var previewWidth = pattern.w * tileSize;
      var previewHeight = pattern.h * tileSize;

      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;

      var ctx = previewCanvas.getContext("2d");
      ctx.clearRect(0, 0, previewWidth, previewHeight);

      // Draw pattern preview
      for (var row = 0; row < pattern.h; row++) {
        for (var col = 0; col < pattern.w; col++) {
          var tileId = pattern.ids[row][col];
          if (tileId) {
            var tile = editor.getTileById ? editor.getTileById(tileId) : null;
            if (tile && tile.image) {
              var tileset = editor.getTilesetById ? editor.getTilesetById(tile.tilesetId) : null;
              if (tileset && tileset.type === "atlas") {
                var srcX = (tile.col | 0) * (tileset.tileWidth | 0);
                var srcY = (tile.row | 0) * (tileset.tileHeight | 0);
                var srcW = tileset.tileWidth | 0;
                var srcH = tileset.tileHeight | 0;
                ctx.drawImage(tile.image, srcX, srcY, srcW, srcH, col * tileSize, row * tileSize, tileSize, tileSize);
              }
            }
          }
        }
      }

      // Position preview at mouse cursor
      previewCanvas.style.left = (mouseX + 10) + "px";
      previewCanvas.style.top = (mouseY + 10) + "px";
      previewCanvas.style.display = "block";
    }

    function captureTileSelection() {
      if (!editor.getTile) return;

      var startCol = Math.floor(startX / (editor.getTileSize ? editor.getTileSize() : 16));
      var startRow = Math.floor(startY / (editor.getTileSize ? editor.getTileSize() : 16));
      var endCol = Math.floor(endX / (editor.getTileSize ? editor.getTileSize() : 16));
      var endRow = Math.floor(endY / (editor.getTileSize ? editor.getTileSize() : 16));

      var minCol = Math.min(startCol, endCol);
      var maxCol = Math.max(startCol, endCol);
      var minRow = Math.min(startRow, endRow);
      var maxRow = Math.max(startRow, endRow);

      var width = maxCol - minCol + 1;
      var height = maxRow - minRow + 1;

      if (width <= 0 || height <= 0) return;

      // Capture tiles from current layer
      var ids = new Array(height);
      for (var row = 0; row < height; row++) {
        ids[row] = new Array(width);
        for (var col = 0; col < width; col++) {
          var tileId = editor.getTile(minCol + col, minRow + row) || 0;
          ids[row][col] = tileId;
        }
      }

      // Set as brush pattern
      if (editor.setBrushPattern) {
        editor.setBrushPattern({w: width, h: height, ids: ids});
      }

      // Switch to paint mode
      if (window.emSetTool) {
        window.emSetTool("paint");
      }

      console.log("Captured tile selection:", width + "×" + height, "tiles");
    }

    // Mouse events
    canvas.addEventListener("mousedown", function(e) {
      if (toolMode() !== "selectTiles") return;

      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      endX = e.clientX;
      endY = e.clientY;

      e.preventDefault();
    });

    canvas.addEventListener("mousemove", function(e) {
      if (!isSelecting || toolMode() !== "selectTiles") return;

      endX = e.clientX;
      endY = e.clientY;
      updateSelectionRect();
    });

    canvas.addEventListener("mouseup", function(e) {
      if (!isSelecting || toolMode() !== "selectTiles") return;

      isSelecting = false;
      endX = e.clientX;
      endY = e.clientY;

      captureTileSelection();
      hideSelection();
    });

    // Preview for paint mode
    canvas.addEventListener("mousemove", function(e) {
      if (toolMode() === "paint") {
        updatePreview(e.clientX, e.clientY);
      } else if (previewCanvas) {
        previewCanvas.style.display = "none";
      }
    });

    // Hide preview when not in paint mode
    window.addEventListener("em:setTool", function(ev) {
      var tool = ev && ev.detail && ev.detail.tool;
      if (tool !== "paint" && previewCanvas) {
        previewCanvas.style.display = "none";
      }
    });

    // Clean up on page unload
    window.addEventListener("beforeunload", function() {
      if (selectionRect && selectionRect.parentNode) {
        selectionRect.parentNode.removeChild(selectionRect);
      }
      if (previewCanvas && previewCanvas.parentNode) {
        previewCanvas.parentNode.removeChild(previewCanvas);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
})();