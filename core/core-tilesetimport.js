// core-tilesetimport.js — Tileset management + auto grid detection (ES5, PlainJS)
(function(){
  function install(editor){
    // State
    var tilesets = []; // array of { id, type:'atlas'|'imageCollection', sourceType:'file'|'url', url, name, image, images[], width, height, detectedSizes[], tileWidth, tileHeight, margin, spacing, columns, rows }
    var idSeq = 1;

    // Utility
    function emitChanged(){ if (editor.emit) editor.emit("tilesets:changed", { tilesets: tilesets.slice() }); }
    function nextId(){ return idSeq++; }

    function typicalSizes(){ return [8, 12, 16, 24, 32, 48, 64]; }

    function gcd(a,b){ a=a|0; b=b|0; while(b){ var t=a%b; a=b; b=t; } return a; }
    function divisors(n, maxv){
      n = n|0; if (n<=0) return [];
      var r = [];
      var i; var m = Math.min(n, maxv||256);
      for (i=1;i<=m;i++) if (n % i === 0) r.push(i);
      return r;
    }

    // Heuristic detection for square-ish tiles: prefer typical sizes that divide both w and h.
    // Returns list of {w,h, score} sorted by best score desc.
    function detectGridSizesForImage(w, h){
      var i, j;
      var cand = [];
      var typ = typicalSizes();
      var divW = divisors(w, 256);
      var divH = divisors(h, 256);

      // Candidates from intersection of divisors
      for (i=0;i<divW.length;i++){
        for (j=0;j<divH.length;j++){
          if (divW[i] === divH[j]){
            var s = divW[i];
            if (s >= 4 && s <= 256){
              cand.push({w:s, h:s, origin:"div"});
            }
          }
        }
      }
      // Add typical sizes even if not exact divisors (we allow slight margin if close to divisor)
      for (i=0;i<typ.length;i++){
        var t = typ[i];
        // push only if it is not already in candidates
        var found = false;
        for (j=0;j<cand.length;j++){ if (cand[j].w===t && cand[j].h===t){ found=true; break; } }
        if (!found) cand.push({w:t, h:t, origin:"typ"});
      }

      // Score function:
      // +200 if divides both exactly
      // +80 if divides width OR height
      // + bonus if typical size
      // - penalty if number of tiles is extreme
      var out = [];
      for (i=0;i<cand.length;i++){
        var c = cand[i];
        var score = 0;
        var exactW = (w % c.w) === 0;
        var exactH = (h % c.h) === 0;
        if (exactW && exactH) score += 200;
        else if (exactW || exactH) score += 80;
        if (indexOf(typ, c.w) !== -1) score += 40;

        var cols = Math.floor(w / c.w);
        var rows = Math.floor(h / c.h);
        var tilesCount = cols * rows;
        if (tilesCount <= 0) score -= 200;
        if (tilesCount > 4096) score -= Math.min(200, Math.floor((tilesCount-4096)/16));

        // prefer between 8 and 64 px tiles
        if (c.w >= 8 && c.w <= 64) score += 20;

        out.push({ w:c.w|0, h:c.h|0, score:score, cols:cols, rows:rows });
      }

      // unique by w,h
      var uniq = [];
      for (i=0;i<out.length;i++){
        var o = out[i], k = o.w+"x"+o.h, dupe = false, k2, t2;
        for (j=0;j<uniq.length;j++){ t2 = uniq[j]; k2 = t2.w+"x"+t2.h; if (k===k2){ dupe=true; if (o.score>t2.score) uniq[j]=o; break; } }
        if (!dupe) uniq.push(o);
      }

      // sort by score desc, then by tile size asc (smaller first)
      uniq.sort(function(a,b){ if (a.score!==b.score) return b.score - a.score; return a.w - b.w; });
      return uniq;
    }

    function indexOf(arr, v){
      var i; for (i=0;i<arr.length;i++) if (arr[i]===v) return i; return -1;
    }

    function createAtlasFromImage(img, name, url){
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      var det = detectGridSizesForImage(w, h);
      var best = det && det.length ? det[0] : { w: 32, h: 32, cols: Math.floor(w/32), rows: Math.floor(h/32), score: 0 };

      var ts = {
        id: nextId(),
        type: "atlas",
        sourceType: url ? "url" : "file",
        url: url || null,
        name: name || (url || "tileset") + "",
        image: img,
        width: w,
        height: h,
        detectedSizes: det,
        tileWidth: best.w|0,
        tileHeight: best.h|0,
        margin: 0,
        spacing: 0,
        columns: Math.max(1, best.cols|0),
        rows: Math.max(1, best.rows|0)
      };
      tilesets.push(ts);
      emitChanged();
      return ts;
    }

    function createCollectionFromImages(imgs, name){
      var ts = {
        id: nextId(),
        type: "imageCollection",
        sourceType: "file",
        url: null,
        name: name || "collection",
        images: imgs.slice(),
        width: 0,
        height: 0,
        detectedSizes: [],
        tileWidth: 0,
        tileHeight: 0,
        margin: 0,
        spacing: 0,
        columns: 0,
        rows: 0
      };
      tilesets.push(ts);
      emitChanged();
      return ts;
    }

    // Public API
    function addTilesetFromFile(file, cb){
      // Accept image only
      var r = new FileReader();
      r.onload = function(){
        var img = new Image();
        img.onload = function(){
          var ts = createAtlasFromImage(img, file.name, null);
          if (cb) try{ cb(ts); }catch(e){}
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    }

    function addTilesetFromUrl(url, cb){
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function(){
        var ts = createAtlasFromImage(img, url.split("/").pop(), url);
        if (cb) try{ cb(ts); }catch(e){}
      };
      img.onerror = function(){ if (cb) try{ cb(null); }catch(e){} };
      img.src = url;
    }

    function addTilesetCollectionFromFiles(files, cb){
      // files: FileList or array of File
      var pending = 0;
      var images = [];
      var i;
      function done(){
        var ts = createCollectionFromImages(images, "collection");
        if (cb) try{ cb(ts); }catch(e){}
      }
      function onImage(img){
        images.push(img);
        pending--;
        if (pending===0) done();
      }
      for (i=0;i<files.length;i++){
        var f = files[i];
        if (!f || !f.type || f.type.indexOf("image/")!==0) continue;
        pending++;
        (function(file){
          var rr = new FileReader();
          rr.onload = function(){
            var im = new Image();
            im.onload = function(){ onImage(im); };
            im.src = rr.result;
          };
          rr.readAsDataURL(file);
        })(f);
      }
      if (pending===0) done();
    }

    function setTilesetTileSize(id, w, h){
      w=w|0; h=h|0; if (w<=0||h<=0) return;
      var i; for (i=0;i<tilesets.length;i++) if (tilesets[i].id===id){
        tilesets[i].tileWidth = w; tilesets[i].tileHeight = h;
        if (tilesets[i].type==="atlas"){
          tilesets[i].columns = Math.max(1, Math.floor(tilesets[i].width  / w));
          tilesets[i].rows    = Math.max(1, Math.floor(tilesets[i].height / h));
        }
        emitChanged();
        break;
      }
    }

    function removeTileset(id){
      var i; for (i=0;i<tilesets.length;i++) if (tilesets[i].id===id){ tilesets.splice(i,1); emitChanged(); return true; }
      return false;
    }

    function getTilesets(){ return tilesets.slice(); }
    function getTilesetById(id){ var i; for (i=0;i<tilesets.length;i++) if (tilesets[i].id===id) return tilesets[i]; return null; }

    editor.detectGridSizesForImage = detectGridSizesForImage;
    editor.addTilesetFromFile = addTilesetFromFile;
    editor.addTilesetFromUrl = addTilesetFromUrl;
    editor.addTilesetCollectionFromFiles = addTilesetCollectionFromFiles;
    editor.setTilesetTileSize = setTilesetTileSize;
    editor.removeTileset = removeTileset;
    editor.getTilesets = getTilesets;
    editor.getTilesetById = getTilesetById;

    // Load the tiles.png file as the default tileset
    function loadDefaultTileset(){
      var img = new Image();
      img.onload = function(){
        var ts = createAtlasFromImage(img, "tiles.png", "tiles.png");
        // Set the tile size to 16x16 as specified
        ts.tileWidth = 16;
        ts.tileHeight = 16;
        ts.columns = Math.floor(ts.width / 16);
        ts.rows = Math.floor(ts.height / 16);
        ts.margin = 0;
        ts.spacing = 0;
        emitChanged();
        console.log("Loaded tiles.png:", ts.width + "x" + ts.height, "with", ts.columns + "x" + ts.rows, "tiles of", ts.tileWidth + "x" + ts.tileHeight);
      };
      img.onerror = function(){
        console.warn("Failed to load tiles.png - falling back to test tileset");
        addTestTileset();
      };
      img.src = "tiles.png";
    }

    // Add a simple test tileset for demonstration (fallback)
    function addTestTileset(){
      var canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      var ctx = canvas.getContext('2d');

      // Draw a simple test pattern
      ctx.fillStyle = '#8B4513'; // Brown
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#228B22'; // Green
      ctx.fillRect(32, 0, 32, 32);
      ctx.fillStyle = '#696969'; // Gray
      ctx.fillRect(0, 32, 32, 32);
      ctx.fillStyle = '#FFD700'; // Gold
      ctx.fillRect(32, 32, 32, 32);

      // Add some borders
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, 32, 32);
      ctx.strokeRect(32, 0, 32, 32);
      ctx.strokeRect(0, 32, 32, 32);
      ctx.strokeRect(32, 32, 32, 32);

      var testTileset = {
        id: nextId(),
        type: "atlas",
        sourceType: "generated",
        url: null,
        name: "Test Tileset",
        image: canvas,
        width: 64,
        height: 64,
        detectedSizes: [{w:32, h:32, score:100, cols:2, rows:2}],
        tileWidth: 32,
        tileHeight: 32,
        margin: 0,
        spacing: 0,
        columns: 2,
        rows: 2
      };
      tilesets.push(testTileset);
      emitChanged();
      return testTileset;
    }

    // Load default tileset after initialization
    setTimeout(loadDefaultTileset, 50);
  }
  window.EditorTilesetImport = install;
})();