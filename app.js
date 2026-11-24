const SPLASH_DURATION_MS = 3000;
const btnSkipSplash = document.getElementById("btnSkipSplash");
let splashTimer = null;

function hideSplash() {
  if (splashTimer) {
    clearTimeout(splashTimer);
    splashTimer = null;
  }
  const el = document.getElementById("splashScreen");
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
}

if (btnSkipSplash) {
  btnSkipSplash.addEventListener("click", hideSplash);
}

splashTimer = setTimeout(hideSplash, SPLASH_DURATION_MS);

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

const widthInput = document.getElementById("widthCm");
const heightInput = document.getElementById("heightCm");
const cellInput = document.getElementById("cellCm");
const colorPicker = document.getElementById("colorPicker");
const symmetrySelect = document.getElementById("symmetryMode");
const brushBtn = document.getElementById("toolBrush");
const eraserBtn = document.getElementById("toolEraser");
const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");
const zoomRange = document.getElementById("zoomRange");
const zoomLabel = document.getElementById("zoomLabel");
const btnPdf = document.getElementById("btnPdf");
const btnShare = document.getElementById("btnShare");
const btnClear = document.getElementById("btnClear");
const btnAppInfo = document.getElementById("btnAppInfo");
const infoModal = document.getElementById("infoModal");
const btnCloseInfo = document.getElementById("btnCloseInfo");
const btnAcceptInfo = document.getElementById("btnAcceptInfo");
const statusMsg = document.getElementById("statusMsg");
const colorStats = document.getElementById("colorStats");
const viewport = document.getElementById("viewport");
const btnTogglePanel = document.getElementById("btnTogglePanel");
const panel = document.getElementById("panel");

const state = {
  widthCm: 6,
  heightCm: 6,
  cellCm: 0.1,
  color: "#b91c1c",
  symmetry: "none",
  tool: "brush",
  scale: 6,
  cells: new Map()
};

const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function snapshotCells() {
  return [...state.cells.entries()];
}

function syncHistoryButtons() {
  if (btnUndo) btnUndo.disabled = undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

function pushHistory() {
  undoStack.push(snapshotCells());
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0;
  syncHistoryButtons();
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(snapshotCells());
  const prev = undoStack.pop();
  state.cells = new Map(prev);
  render();
  syncHistoryButtons();
  notify("Acción deshecha");
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(snapshotCells());
  const next = redoStack.pop();
  state.cells = new Map(next);
  render();
  syncHistoryButtons();
  notify("Acción rehecha");
}

function notify(msg) {
  if (!statusMsg) return;
  statusMsg.textContent = msg;
  clearTimeout(notify._t);
  notify._t = setTimeout(() => {
    statusMsg.textContent = "";
  }, 2500);
}

function dims() {
  const cellMm = Math.max(0.3, (Number(state.cellCm) || 0.03) * 10);
  const wMm = Math.max(1, (Number(state.widthCm) || 0.1) * 10);
  const hMm = Math.max(1, (Number(state.heightCm) || 0.1) * 10);
  return {
    cols: Math.max(1, Math.round(wMm / cellMm)),
    rows: Math.max(1, Math.round(hMm / cellMm)),
    cellMm,
    widthMm: wMm,
    heightMm: hMm
  };
}

function updateStats() {
  if (!colorStats) return;
  const counts = new Map();
  const { cols, rows } = dims();

  for (const [key, color] of state.cells.entries()) {
    const [r, c] = key.split(",").map(Number);
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      counts.set(color, (counts.get(color) || 0) + 1);
    }
  }

  colorStats.innerHTML = "";
  if (counts.size === 0) {
    colorStats.innerHTML = "<li>Sin celdas pintadas</li>";
    return;
  }

  for (const [color, total] of counts.entries()) {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = "swatch";
    swatch.style.background = color;
    left.appendChild(swatch);
    left.appendChild(document.createTextNode(color));

    const right = document.createElement("strong");
    right.textContent = `${total} pts`;

    li.appendChild(left);
    li.appendChild(right);
    colorStats.appendChild(li);
  }
}

function render() {
  if (!canvas || !ctx) return;
  const { cols, rows, cellMm } = dims();
  const pxCell = cellMm * state.scale;
  canvas.width = Math.max(1, Math.round(cols * pxCell));
  canvas.height = Math.max(1, Math.round(rows * pxCell));

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = pxCell >= 6 ? 0.8 : 0;

  for (const [key, color] of state.cells.entries()) {
    const [r, c] = key.split(",").map(Number);
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      ctx.fillStyle = color;
      ctx.fillRect(
        c * pxCell + pad,
        r * pxCell + pad,
        Math.max(1, pxCell - pad * 2),
        Math.max(1, pxCell - pad * 2)
      );
    }
  }

  for (let c = 0; c <= cols; c++) {
    const isMajor10 = c % 10 === 0;
    const isMajor5 = c % 5 === 0;
    ctx.lineWidth = isMajor10 ? 2.2 : isMajor5 ? 1.5 : 1.1;
    ctx.strokeStyle = "#000000";

    const x = Math.round(c * pxCell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let r = 0; r <= rows; r++) {
    const isMajor10 = r % 10 === 0;
    const isMajor5 = r % 5 === 0;
    ctx.lineWidth = isMajor10 ? 2.2 : isMajor5 ? 1.5 : 1.1;
    ctx.strokeStyle = "#000000";

    const y = Math.round(r * pxCell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(37, 99, 235, 0.85)";
  if (state.symmetry === "h" || state.symmetry === "quad") {
    const midX = (cols / 2) * pxCell;
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, canvas.height);
    ctx.stroke();
  }
  if (state.symmetry === "v" || state.symmetry === "quad") {
    const midY = (rows / 2) * pxCell;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(canvas.width, midY);
    ctx.stroke();
  }
  ctx.restore();

  updateStats();
}

let drawing = false;
let strokeChanged = false;
let paintedBeforePinch = false;

const activePointers = new Map();
let gesture = null;

function getCentroid(p1, p2) {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2
  };
}

function getDistance(p1, p2) {
  return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
}

function beginTwoFingerGesture() {
  const pts = [...activePointers.values()];
  if (pts.length < 2) return;

  if (drawing && paintedBeforePinch && undoStack.length > 0) {
    const prev = undoStack.pop();
    state.cells = new Map(prev);
    redoStack.length = 0;
    syncHistoryButtons();
    render();
  }

  drawing = false;
  strokeChanged = false;
  paintedBeforePinch = false;

  const mid = getCentroid(pts[0], pts[1]);
  const dist = Math.max(10, getDistance(pts[0], pts[1]));

  gesture = {
    startDist: dist,
    startScale: state.scale,
    lastMidX: mid.x,
    lastMidY: mid.y
  };
}

function applyToolAt(r, c) {
  const { cols, rows } = dims();
  const targets = [[r, c]];

  if (state.symmetry === "h" || state.symmetry === "quad") {
    targets.push([r, cols - 1 - c]);
  }
  if (state.symmetry === "v" || state.symmetry === "quad") {
    targets.push([rows - 1 - r, c]);
  }
  if (state.symmetry === "quad") {
    targets.push([rows - 1 - r, cols - 1 - c]);
  }

  let modified = false;
  for (const [tr, tc] of targets) {
    if (tr >= 0 && tr < rows && tc >= 0 && tc < cols) {
      const key = `${tr},${tc}`;
      if (state.tool === "eraser") {
        if (state.cells.has(key)) {
          if (!modified) {
            pushHistory();
            modified = true;
          }
          state.cells.delete(key);
        }
      } else if (state.cells.get(key) !== state.color) {
        if (!modified) {
          pushHistory();
          modified = true;
        }
        state.cells.set(key, state.color);
      }
    }
  }

  if (modified) {
    strokeChanged = true;
    paintedBeforePinch = true;
    render();
  }
}

function getCellCoordsFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const { cols, rows } = dims();
  const c = Math.floor(((clientX - rect.left) / rect.width) * cols);
  const r = Math.floor(((clientY - rect.top) / rect.height) * rows);
  return { r, c };
}

canvas?.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Ignorar si el puntero no admite captura
  }

  activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

  if (activePointers.size >= 2) {
    beginTwoFingerGesture();
    return;
  }

  drawing = true;
  strokeChanged = false;
  paintedBeforePinch = false;
  const { r, c } = getCellCoordsFromClient(e.clientX, e.clientY);
  applyToolAt(r, c);
});

canvas?.addEventListener("pointermove", (e) => {
  if (!activePointers.has(e.pointerId)) return;
  e.preventDefault();

  activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

  if (activePointers.size >= 2) {
    if (!gesture) {
      beginTwoFingerGesture();
      return;
    }

    const pts = [...activePointers.values()];
    const mid = getCentroid(pts[0], pts[1]);
    const dist = Math.max(10, getDistance(pts[0], pts[1]));

    if (viewport) {
      const dx = mid.x - gesture.lastMidX;
      const dy = mid.y - gesture.lastMidY;
      viewport.scrollLeft -= dx;
      viewport.scrollTop -= dy;
    }
    gesture.lastMidX = mid.x;
    gesture.lastMidY = mid.y;

    const zoomFactor = dist / gesture.startDist;
    const roundedScale = Math.min(25, Math.max(2, Math.round(gesture.startScale * zoomFactor)));

    if (roundedScale !== state.scale && viewport) {
      const vpRect = viewport.getBoundingClientRect();
      const anchorXInContent = viewport.scrollLeft + (mid.x - vpRect.left);
      const anchorYInContent = viewport.scrollTop + (mid.y - vpRect.top);
      const ratio = roundedScale / state.scale;

      setZoom(roundedScale);

      viewport.scrollLeft = anchorXInContent * ratio - (mid.x - vpRect.left);
      viewport.scrollTop = anchorYInContent * ratio - (mid.y - vpRect.top);
    }
    return;
  }

  if (!drawing) return;
  const { r, c } = getCellCoordsFromClient(e.clientX, e.clientY);
  applyToolAt(r, c);
});

function stopDrawing(e) {
  if (e && e.pointerId !== undefined) {
    if (canvas?.hasPointerCapture?.(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignorar si ya fue liberado
      }
    }
    activePointers.delete(e.pointerId);
  }

  if (activePointers.size < 2) {
    gesture = null;
  }

  if (activePointers.size === 0) {
    if (drawing && strokeChanged) {
      syncHistoryButtons();
    }
    drawing = false;
    strokeChanged = false;
    paintedBeforePinch = false;
  }
}

canvas?.addEventListener("pointerup", stopDrawing);
canvas?.addEventListener("pointercancel", stopDrawing);

if (btnTogglePanel && panel) {
  btnTogglePanel.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("collapsed");
    btnTogglePanel.setAttribute("aria-expanded", String(!collapsed));
    btnTogglePanel.textContent = collapsed
      ? "Mostrar controles ▲"
      : "Ocultar controles ▼";
  });
}

function setInfoModalOpen(open) {
  if (!infoModal) return;
  infoModal.classList.toggle("hidden", !open);
}

btnAppInfo?.addEventListener("click", () => setInfoModalOpen(true));
btnCloseInfo?.addEventListener("click", () => setInfoModalOpen(false));
btnAcceptInfo?.addEventListener("click", () => setInfoModalOpen(false));
infoModal?.addEventListener("click", (e) => {
  if (e.target === infoModal) setInfoModalOpen(false);
});

brushBtn?.addEventListener("click", () => {
  state.tool = "brush";
  brushBtn.classList.add("active");
  eraserBtn?.classList.remove("active");
});

eraserBtn?.addEventListener("click", () => {
  state.tool = "eraser";
  eraserBtn.classList.add("active");
  brushBtn?.classList.remove("active");
});

btnUndo?.addEventListener("click", undo);
btnRedo?.addEventListener("click", redo);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && infoModal && !infoModal.classList.contains("hidden")) {
    setInfoModalOpen(false);
    return;
  }

  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if ((isMod && e.key.toLowerCase() === "y") || (isMod && e.key.toLowerCase() === "z" && e.shiftKey)) {
    e.preventDefault();
    redo();
  }
});

function setZoom(val) {
  state.scale = Math.min(25, Math.max(2, Number(val) || 6));
  if (zoomRange) zoomRange.value = state.scale;
  if (zoomLabel) zoomLabel.textContent = `${state.scale}x`;
  render();
}

zoomRange?.addEventListener("input", (e) => setZoom(e.target.value));

viewport?.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(state.scale + (e.deltaY < 0 ? 1 : -1));
    }
  },
  { passive: false }
);

widthInput?.addEventListener("input", (e) => {
  state.widthCm = Math.max(0.1, Number(e.target.value) || 0.1);
  render();
});

heightInput?.addEventListener("input", (e) => {
  state.heightCm = Math.max(0.1, Number(e.target.value) || 0.1);
  render();
});

cellInput?.addEventListener("input", (e) => {
  const raw = Number(e.target.value);
  state.cellCm = Number.isFinite(raw) ? Math.max(0.03, raw) : 0.03;
  render();
});

cellInput?.addEventListener("blur", () => {
  if (cellInput) cellInput.value = Number(state.cellCm.toFixed(3));
});

colorPicker?.addEventListener("input", (e) => {
  state.color = e.target.value;
});

symmetrySelect?.addEventListener("change", (e) => {
  state.symmetry = e.target.value;
  render();
});

function getLogoPngDataUrl() {
  const logoEl = document.querySelector(".brand-logo") || document.querySelector(".splash-logo");
  if (!logoEl || !logoEl.complete || logoEl.naturalWidth === 0) return null;

  try {
    const size = 128;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tctx = tempCanvas.getContext("2d");
    const ratio = Math.min(size / logoEl.naturalWidth, size / logoEl.naturalHeight);
    const w = logoEl.naturalWidth * ratio;
    const h = logoEl.naturalHeight * ratio;
    tctx.drawImage(logoEl, (size - w) / 2, (size - h) / 2, w, h);
    return tempCanvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

btnPdf?.addEventListener("click", () => {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    notify("No se pudo cargar jsPDF (revisa conexión)");
    return;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const { cols, rows, widthMm, heightMm } = dims();

  let textX = 15;
  const logoData = getLogoPngDataUrl();
  if (logoData) {
    pdf.addImage(logoData, "PNG", 15, 10, 14, 14);
    textX = 32;
  }

  pdf.setFontSize(12);
  pdf.text("Telapp — Patrón de Telar (by Pacha)", textX, 15);
  pdf.setFontSize(9.5);
  pdf.text(
    `Medidas: ${state.widthCm} x ${state.heightCm} cm | Cuadrícula: ${state.cellCm} cm (${cols}x${rows} pts)`,
    textX,
    21
  );

  const startY = 30;
  const maxWidth = 180;
  const maxHeight = 240;
  const ratio = Math.min(maxWidth / widthMm, maxHeight / heightMm, 1);
  const drawW = widthMm * ratio;
  const drawH = heightMm * ratio;

  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 15, startY, drawW, drawH);

  let y = startY + drawH + 10;
  const counts = new Map();
  for (const [key, color] of state.cells.entries()) {
    const [r, c] = key.split(",").map(Number);
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      counts.set(color, (counts.get(color) || 0) + 1);
    }
  }
  if (counts.size > 0 && y < 280) {
    pdf.setFontSize(10);
    pdf.text("Conteo por color:", 15, y);
    y += 6;
    for (const [color, total] of counts.entries()) {
      if (y > 285) break;
      pdf.text(`• ${color}: ${total} puntos`, 18, y);
      y += 5;
    }
  }

  pdf.save("patron-telapp.pdf");
  notify("PDF descargado");
});

btnShare?.addEventListener("click", async () => {
  const serialized = JSON.stringify({
    widthCm: state.widthCm,
    heightCm: state.heightCm,
    cellCm: state.cellCm,
    symmetry: state.symmetry,
    scale: state.scale,
    cells: [...state.cells.entries()]
  });
  const encoded = toBase64(serialized);
  location.hash = encoded;

  try {
    await navigator.clipboard.writeText(location.href);
    notify("Enlace copiado al portapapeles");
  } catch {
    notify("Enlace actualizado en la barra de direcciones");
  }
});

btnClear?.addEventListener("click", () => {
  if (state.cells.size === 0) {
    notify("El lienzo ya está vacío");
    return;
  }
  if (!window.confirm("¿Seguro que quieres borrar todo el patrón?")) return;

  pushHistory();
  state.cells.clear();
  if (location.hash.length > 1) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  render();
  notify("Patrón borrado (puedes usar Deshacer)");
});

if (location.hash.length > 1) {
  try {
    const decoded = fromBase64(location.hash.slice(1));
    const saved = JSON.parse(decoded);
    state.widthCm =
      saved.widthCm !== undefined
        ? Math.max(0.1, Number(saved.widthCm) || 6)
        : Math.max(0.1, (Number(saved.widthMm) || 60) / 10);
    state.heightCm =
      saved.heightCm !== undefined
        ? Math.max(0.1, Number(saved.heightCm) || 6)
        : Math.max(0.1, (Number(saved.heightMm) || 60) / 10);
    state.cellCm =
      saved.cellCm !== undefined
        ? Math.max(0.03, Number(saved.cellCm) || 0.1)
        : Math.max(0.03, (Number(saved.cellMm) || 1) / 10);
    state.symmetry = saved.symmetry || "none";
    state.scale = Number(saved.scale) || 6;
    state.cells = new Map(Array.isArray(saved.cells) ? saved.cells : []);

    if (widthInput) widthInput.value = state.widthCm;
    if (heightInput) heightInput.value = state.heightCm;
    if (cellInput) cellInput.value = state.cellCm;
    if (symmetrySelect) symmetrySelect.value = state.symmetry;
    if (zoomRange) zoomRange.value = state.scale;
    if (zoomLabel) zoomLabel.textContent = `${state.scale}x`;
  } catch {
    // Si el hash no es válido, arranca limpio
  }
}

try {
  syncHistoryButtons();
  render();
} catch (err) {
  console.error("Error al iniciar:", err);
}