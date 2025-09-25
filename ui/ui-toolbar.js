(function () {
  // EMgine Editor – Toolbar (UI only)
  // Tools: Select, Paint, Pan, Zoom In/Out, Undo, Redo
  // Kommuniziert über:
  //  - window.editor.undo()/redo()/zoomBy()
  //  - CustomEvent('em:setTool', {detail:{tool:'select'|'paint'|'pan'}})
  //  - window.emSetTool(tool) zum Sync von externen UIs

  var ROOT_ID = "em-toolbar-root";
  var STYLE_ID = "em-toolbar-style-fallback";
  var BTN_CLS = "em-toolbar-btn";
  var BTN_ACTIVE_CLS = "em-toolbar-btn--active";
  var DISABLED_CLS = "em-toolbar-btn--disabled";

  var icons = {
    select: "▭",
    paint: "✎",
    pan: "🖐",
    zoomIn: "＋",
    zoomOut: "－",
    undo: "↶",
    redo: "↷"
  };
  var state = { selectedTool: "paint" };

  function onReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 0);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  function externalCssPresent() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var href = (links[i].getAttribute("href") || "").toLowerCase();
      if (href.indexOf("editor-toolbar.css") !== -1) return true;
    }
    return false;
  }

  function injectFallbackStyles() {
    if (document.getElementById(STYLE_ID) || externalCssPresent()) return;
    var css = [
      ".em-toolbar{position:fixed;left:12px;top:12px;z-index:10000;display:flex;flex-direction:column;gap:8px;padding:8px;background:rgba(20,23,28,0.92);backdrop-filter:saturate(120%) blur(2px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,0.35);}",
      ".em-toolbar h3{margin:0 0 6px 0;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;letter-spacing:.06em;text-transform:uppercase;color:#cfd8dc;opacity:.9;}",
      ".em-toolbar-row{display:flex;gap:6px;}",
      "." + BTN_CLS + "{min-width:36px;min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:#1e232b;color:#e0e6ea;cursor:pointer;user-select:none;font:600 13px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;transition:transform .05s ease, background .15s ease, border-color .15s ease;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.03);}",
      "." + BTN_CLS + ":hover{background:#242a33;}",
      "." + BTN_CLS + ":active{transform:translateY(1px);}",
      "." + BTN_ACTIVE_CLS + "{border-color:#64b5f6;box-shadow:inset 0 0 0 1px #64b5f6;background:#263445;color:#e7f3ff;}",
      "." + DISABLED_CLS + "{opacity:.45;cursor:not-allowed;filter:grayscale(0.3);}",
      ".em-toolbar .em-sep{height:1px;background:rgba(255,255,255,0.08);margin:4px 0;}"
    ].join("");
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function ensureOnce() {
    return !!document.getElementById(ROOT_ID);
  }

  function makeButton(key, title, onClick) {
    var b = document.createElement("button");
    b.className = BTN_CLS;
    b.dataset.key = key;
    b.title = title;
    b.setAttribute("aria-label", title);
    b.textContent = icons[key] || title.charAt(0) || "?";
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (b.classList.contains(DISABLED_CLS)) return;
      if (onClick) onClick();
    });
    return b;
  }

  function selectTool(tool) {
    state.selectedTool = tool;
    var root = document.getElementById(ROOT_ID);
    if (root) {
      // jetzt inklusive 'select'
      var btns = root.querySelectorAll(
        "." + BTN_CLS + "[data-key='select'], ." +
        BTN_CLS + "[data-key='paint'], ." +
        BTN_CLS + "[data-key='pan']"
      );
      for (var i = 0; i < btns.length; i++) {
        var k = btns[i].dataset.key;
        if (k === tool) btns[i].classList.add(BTN_ACTIVE_CLS);
        else btns[i].classList.remove(BTN_ACTIVE_CLS);
      }
    }
    try {
      var evt = new CustomEvent("em:setTool", { detail: { tool: tool } });
      window.dispatchEvent(evt);
    } catch (e) {}
    window.emToolMode = tool;
  }

  function setDisabled(btn, disabled) {
    if (!btn) return;
    if (disabled) btn.classList.add(DISABLED_CLS);
    else btn.classList.remove(DISABLED_CLS);
  }

  function canCall(obj, fn) {
    return obj && typeof obj[fn] === "function";
  }

  function getCanvasCenter() {
    var c = document.getElementById("editor-canvas") || document.querySelector("canvas");
    if (!c) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function build() {
    if (ensureOnce()) return;
    injectFallbackStyles();

    var root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "em-toolbar";

    var title = document.createElement("h3");
    title.textContent = "Tools";
    root.appendChild(title);

    // Row 1: tool select (Select, Paint, Pan)
    var row1 = document.createElement("div");
    row1.className = "em-toolbar-row";
    var btnSelect = makeButton("select", "Select (Rechteck)", function () {
      selectTool("select");
    });
    var btnPaint = makeButton("paint", "Paint (Tiles)", function () {
      selectTool("paint");
    });
    var btnPan = makeButton("pan", "Pan/Drag", function () {
      selectTool("pan");
    });
    row1.appendChild(btnSelect);
    row1.appendChild(btnPaint);
    row1.appendChild(btnPan);
    root.appendChild(row1);

    // Row 2: zoom
    var row2 = document.createElement("div");
    row2.className = "em-toolbar-row";
    var btnZoomIn = makeButton("zoomIn", "Zoom In", function () {
      if (canCall(window.editor, "zoomBy")) {
        var c = getCanvasCenter();
        window.editor.zoomBy(1.2, c.x, c.y);
      }
    });
    var btnZoomOut = makeButton("zoomOut", "Zoom Out", function () {
      if (canCall(window.editor, "zoomBy")) {
        var c = getCanvasCenter();
        window.editor.zoomBy(1 / 1.2, c.x, c.y);
      }
    });
    row2.appendChild(btnZoomIn);
    row2.appendChild(btnZoomOut);
    root.appendChild(row2);

    // Separator
    var sep = document.createElement("div");
    sep.className = "em-sep";
    root.appendChild(sep);

    // Row 3: history
    var row3 = document.createElement("div");
    row3.className = "em-toolbar-row";
    var btnUndo = makeButton("undo", "Undo (Ctrl+Z)", function () {
      if (canCall(window.editor, "undo")) window.editor.undo();
    });
    var btnRedo = makeButton("redo", "Redo (Ctrl+Y / Ctrl+Shift+Z)", function () {
      if (canCall(window.editor, "redo")) window.editor.redo();
    });
    row3.appendChild(btnUndo);
    row3.appendChild(btnRedo);
    root.appendChild(row3);

    document.body.appendChild(root);

    // public sync API (jetzt inkl. select)
    window.emSetTool = function (tool) {
      if (tool !== "paint" && tool !== "pan" && tool !== "select") return;
      selectTool(tool);
    };

    // Initial: Paint aktiv
    selectTool(state.selectedTool);

    // Undo/Redo-Status polling (optional)
    function pollUndoRedo() {
      var canU = canCall(window.editor, "canUndo") ? !!window.editor.canUndo() : true;
      var canR = canCall(window.editor, "canRedo") ? !!window.editor.canRedo() : true;
      setDisabled(btnUndo, !canU);
      setDisabled(btnRedo, !canR);
    }
    setInterval(pollUndoRedo, 400);
  }

  onReady(build);
})();
