import { deleteNote, getNote, putNote } from "./db.js";
import { snapshotBackup } from "./backup.js";
import { showAlert, showConfirm, showDialog, wireModalDismiss } from "./ui.js";

const qs = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const els = {
  themeBtn: /** @type {HTMLButtonElement} */ (qs("#themeBtn")),
  subtitle: qs("#subtitle"),
  statusText: qs("#statusText"),
  metaText: qs("#metaText"),
  backLink: /** @type {HTMLAnchorElement} */ (qs(".back")),
  titleInput: /** @type {HTMLInputElement} */ (qs("#titleInput")),
  categoryInput: /** @type {HTMLInputElement} */ (qs("#categoryInput")),
  tagsInput: /** @type {HTMLInputElement} */ (qs("#tagsInput")),
  contentInput: /** @type {HTMLDivElement} */ (qs("#contentInput")),
  blockSelect: /** @type {HTMLSelectElement} */ (qs("#blockSelect")),
  sizeSelect: /** @type {HTMLSelectElement} */ (qs("#sizeSelect")),
  fontSelect: /** @type {HTMLSelectElement} */ (qs("#fontSelect")),
  textColor: /** @type {HTMLInputElement} */ (qs("#textColor")),
  highlightColor: /** @type {HTMLInputElement} */ (qs("#highlightColor")),
  imagePickerBtn: /** @type {HTMLElement} */ (qs("#imagePickerBtn")),
  imageInput: /** @type {HTMLInputElement} */ (qs("#imageInput")),
  deleteBtn: /** @type {HTMLButtonElement} */ (qs("#deleteBtn")),
};

/** @type {{id: string|null, saving: boolean, dirty: boolean}} */
const state = { id: null, saving: false, dirty: false };

function formatTs(ts) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function setStatus(msg) {
  els.statusText.textContent = msg;
}

function setMeta(note) {
  els.metaText.textContent = `Erstellt: ${formatTs(note.createdAt)} · Geändert: ${formatTs(note.updatedAt)} · ID: ${note.id}`;
  els.subtitle.textContent = formatTs(note.updatedAt);
}

function looksLikeHtml(s) {
  if (!s) return false;
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function updateThemeButton() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  els.themeBtn.setAttribute("aria-label", `Theme: ${current}`);
}

function loadTheme() {
  const saved = localStorage.getItem("notiz_theme");
  if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
  else document.documentElement.setAttribute("data-theme", "dark");
  updateThemeButton();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("notiz_theme", next);
  updateThemeButton();
}

function nativeAndroidPicker() {
  const picker = window.NotizAndroid;
  return picker && typeof picker.pickImage === "function" ? picker : null;
}

function isNativeAndroidWrapper() {
  return Boolean(nativeAndroidPicker()) || /\bNotizAndroid\//.test(navigator.userAgent);
}

async function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (isNativeAndroidWrapper()) {
    try {
      const registrations = navigator.serviceWorker.getRegistrations
        ? await navigator.serviceWorker.getRegistrations()
        : [];
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // ignore
    }
    return;
  }
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function getEditorSnapshot() {
  return {
    title: els.titleInput.value ?? "",
    content: els.contentInput.innerHTML ?? "",
    category: (els.categoryInput.value ?? "").trim(),
    tags: (els.tagsInput.value ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

function ensureCssMode() {
  // make execCommand emit spans with styles when possible
  try {
    document.execCommand("styleWithCSS", false, "true");
  } catch {
    // ignore
  }
}

function exec(cmd, value) {
  els.contentInput.focus();
  try {
    document.execCommand(cmd, false, value);
  } catch {
    // ignore
  }
  scheduleSave();
}

function selectionIsCollapsed() {
  const sel = window.getSelection();
  if (!sel) return true;
  return sel.rangeCount === 0 || sel.isCollapsed;
}

function insertStyledCaretSpan(style) {
  els.contentInput.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  Object.assign(span.style, style);
  span.appendChild(document.createTextNode("\u200B")); // zero-width space
  range.deleteContents();
  range.insertNode(span);
  const next = document.createRange();
  next.setStart(span.firstChild, 1);
  next.setEnd(span.firstChild, 1);
  sel.removeAllRanges();
  sel.addRange(next);
}

function applyTextColor(color) {
  ensureCssMode();
  if (selectionIsCollapsed()) {
    // set default for next typing + caret span for immediate effect
    els.contentInput.style.color = color;
    insertStyledCaretSpan({ color });
    scheduleSave();
    return;
  }
  exec("foreColor", color);
}

function applyHighlightColor(color) {
  ensureCssMode();
  if (selectionIsCollapsed()) {
    insertStyledCaretSpan({ backgroundColor: color });
    scheduleSave();
    return;
  }
  // hiliteColor works in most modern browsers; backColor is fallback for some engines.
  try {
    exec("hiliteColor", color);
  } catch {
    exec("backColor", color);
  }
}

function applyFontName(name) {
  ensureCssMode();
  if (selectionIsCollapsed()) {
    insertStyledCaretSpan({ fontFamily: name });
    scheduleSave();
    return;
  }
  exec("fontName", name);
}

function applyFontSizePx(px) {
  ensureCssMode();
  if (selectionIsCollapsed()) {
    insertStyledCaretSpan({ fontSize: px });
    scheduleSave();
    return;
  }
  // execCommand('fontSize') uses 1-7; apply via span as fallback
  try {
    // map a few common px values to 1..7
    const map = { "12px": "2", "14px": "3", "16px": "4", "18px": "5", "22px": "6" };
    document.execCommand("fontSize", false, map[px] || "3");
    // normalize <font size> to span style
    const fonts = els.contentInput.querySelectorAll("font[size]");
    for (const f of fonts) {
      const span = document.createElement("span");
      span.style.fontSize = px;
      span.innerHTML = f.innerHTML;
      f.replaceWith(span);
    }
  } catch {
    insertStyledCaretSpan({ fontSize: px });
  }
  scheduleSave();
}

function applyBlock(tag) {
  ensureCssMode();
  // execCommand expects tags like 'p', 'h1' as '<p>'
  const value = `<${tag}>`;
  try {
    document.execCommand("formatBlock", false, value);
  } catch {
    // ignore
  }
  scheduleSave();
}

function findBlockElement(node) {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el && el !== els.contentInput) {
    const tag = el.tagName.toLowerCase();
    if (["p", "div", "li", "h1", "h2", "h3", "pre", "blockquote"].includes(tag)) return el;
    el = el.parentElement;
  }
  return null;
}

function applyJustify(mode) {
  ensureCssMode();
  // try execCommand first
  try {
    document.execCommand(mode, false, null);
  } catch {
    // ignore
  }
  // ensure block style (execCommand is inconsistent; selection can be inside spans)
  const sel = window.getSelection();
  const anchor = sel?.anchorNode ?? null;
  let block = anchor ? findBlockElement(anchor) : null;
  if (!block) {
    try {
      document.execCommand("formatBlock", false, "<p>");
    } catch {
      // ignore
    }
    const sel2 = window.getSelection();
    const anchor2 = sel2?.anchorNode ?? null;
    block = anchor2 ? findBlockElement(anchor2) : null;
  }

  if (block) {
    if (mode === "justifyLeft") block.style.textAlign = "left";
    if (mode === "justifyCenter") block.style.textAlign = "center";
    if (mode === "justifyRight") block.style.textAlign = "right";
    if (mode === "justifyFull") {
      block.style.textAlign = "justify";
      // helps in some engines
      // @ts-ignore
      block.style.textJustify = "inter-word";
    }
  } else {
    // fallback: apply to editor root
    if (mode === "justifyLeft") els.contentInput.style.textAlign = "left";
    if (mode === "justifyCenter") els.contentInput.style.textAlign = "center";
    if (mode === "justifyRight") els.contentInput.style.textAlign = "right";
    if (mode === "justifyFull") els.contentInput.style.textAlign = "justify";
  }
  scheduleSave();
}

function setNormal() {
  ensureCssMode();
  try {
    document.execCommand("removeFormat", false, null);
    document.execCommand("formatBlock", false, "<p>");
  } catch {
    // ignore
  }
  scheduleSave();
}

function insertChecklistItem() {
  els.contentInput.focus();
  const row = document.createElement("div");
  row.className = "checkitem";
  row.setAttribute("data-checkitem", "1");
  row.setAttribute("contenteditable", "false");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.setAttribute("data-check", "1");
  cb.setAttribute("contenteditable", "false");
  const span = document.createElement("span");
  span.className = "checktext";
  span.setAttribute("contenteditable", "true");
  span.textContent = "Aufgabe";
  row.append(cb, span);

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    els.contentInput.appendChild(row);
    scheduleSave();
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(row);
  range.setStartAfter(row);
  range.setEndAfter(row);
  sel.removeAllRanges();
  sel.addRange(range);
  scheduleSave();
  ensureTrailingLine();
}

function placeCaretAtEnd(el) {
  if (!(el instanceof HTMLElement)) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

function ensureTrailingLine() {
  const root = els.contentInput;
  const last = root.lastElementChild;
  if (last && last instanceof HTMLElement && last.getAttribute("data-trailing") === "1") return;
  // If last element is non-editable (e.g., checklist row), add an editable trailing paragraph
  if (!last || (last instanceof HTMLElement && last.getAttribute("data-checkitem") === "1")) {
    const p = document.createElement("p");
    p.setAttribute("data-trailing", "1");
    p.appendChild(document.createElement("br"));
    root.appendChild(p);
  }
}

function normalizeChecklist(root) {
  const legacy = root.querySelectorAll('label[data-checkitem="1"]');
  for (const lbl of legacy) {
    const cb = lbl.querySelector('input[type="checkbox"]');
    if (!(cb instanceof HTMLInputElement)) continue;
    cb.setAttribute("data-check", "1");
    cb.setAttribute("contenteditable", "false");

    const textEl = lbl.querySelector(".checktext");
    const text = (textEl?.textContent ?? lbl.textContent ?? "").replace(/\s+/g, " ").trim() || "Aufgabe";

    const row = document.createElement("div");
    row.className = "checkitem";
    row.setAttribute("data-checkitem", "1");
    row.setAttribute("contenteditable", "false");

    const span = document.createElement("span");
    span.className = "checktext";
    span.setAttribute("contenteditable", "true");
    span.textContent = text;

    row.append(cb, span);
    lbl.replaceWith(row);
  }

  const rows = root.querySelectorAll('[data-checkitem="1"]');
  for (const r of rows) {
    if (r instanceof HTMLElement) r.setAttribute("contenteditable", "false");
  }
  const texts = root.querySelectorAll(".checktext");
  for (const t of texts) {
    if (t instanceof HTMLElement) t.setAttribute("contenteditable", "true");
  }

  ensureTrailingLine();
}

let creating = false;
async function ensureNote() {
  if (state.id || creating) return;
  creating = true;
  try {
    const now = Date.now();
    const { title, content, category, tags } = getEditorSnapshot();
    const note = {
      id: crypto.randomUUID(),
      title,
      content,
      category,
      tags,
      createdAt: now,
      updatedAt: now,
    };
    await putNote(note);
    state.id = note.id;
    setMeta(note);
    setStatus("Gespeichert");
    state.dirty = false;
    history.replaceState(null, "", `./note.html?id=${encodeURIComponent(note.id)}`);
  } finally {
    creating = false;
  }
}

let saveTimer = /** @type {number | null} */ (null);
async function scheduleSave() {
  await ensureNote();
  if (!state.id) return;
  state.dirty = true;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    saveTimer = null;
    await saveNow();
  }, 350);
  setStatus("Änderungen…");
}

async function saveNow() {
  if (!state.id || state.saving || !state.dirty) return;
  state.saving = true;
  try {
    const existing = await getNote(state.id);
    if (!existing) return;
    const { title, content, category, tags } = getEditorSnapshot();
    const updated = { ...existing, title, content, category, tags, updatedAt: Date.now() };
    await putNote(updated);
    state.dirty = false;
    setMeta(updated);
    setStatus("Gespeichert");
    snapshotBackup("save").catch(() => {});
  } catch (e) {
    console.error(e);
    setStatus("Fehler beim Speichern");
  } finally {
    state.saving = false;
  }
}

async function onDelete() {
  if (!state.id) {
    els.titleInput.value = "";
    els.contentInput.innerHTML = "";
    setStatus("Bereit");
    return;
  }
  const note = await getNote(state.id);
  const label = note?.title?.trim() ? `„${note.title.trim()}“` : "diese Notiz";
  const ok = await showConfirm(`Wirklich ${label} löschen?`, { title: "Löschen", danger: true, okText: "Löschen" });
  if (!ok) return;
  await deleteNote(state.id);
  location.href = "./index.html";
}

async function confirmLeaveIfDirty() {
  if (!state.dirty) return true;
  return await showConfirm("Ungespeicherte Änderungen verwerfen und zurück?", {
    title: "Ungespeichert",
    danger: true,
    okText: "Verlassen",
    cancelText: "Bleiben",
  });
}

function createNoteImage(src, altText, imageId) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = altText || "Bild";
  img.className = "noteimg";
  img.loading = "lazy";
  img.decoding = "async";
  img.setAttribute("data-w", "100%");
  if (imageId) img.setAttribute("data-android-image-id", imageId);
  img.style.width = "100%";
  img.style.height = "auto";
  return img;
}

function insertImageElement(img) {
  els.contentInput.focus();

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    els.contentInput.appendChild(img);
    els.contentInput.appendChild(document.createElement("br"));
    ensureTrailingLine();
    scheduleSave();
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(img);
  range.setStartAfter(img);
  range.setEndAfter(img);
  sel.removeAllRanges();
  sel.addRange(range);
  ensureTrailingLine();
  scheduleSave();
}

function insertImageDataUrl(dataUrl, altText) {
  insertImageElement(createNoteImage(dataUrl, altText, ""));
}

async function insertAndroidImageUrl(imageId, src, altText) {
  const id = String(imageId || "");
  const existing = id
    ? Array.from(els.contentInput.querySelectorAll("img[data-android-image-id]")).some(
        (img) => img.getAttribute("data-android-image-id") === id
      )
    : false;
  if (existing) {
    clearPendingAndroidImage();
    return;
  }
  if (!src || typeof src !== "string" || !src.startsWith("https://notiz.local/android-image/")) {
    await showAlert("Bild konnte nicht eingefügt werden.", { title: "Bild" });
    return;
  }
  insertImageElement(createNoteImage(src, altText || "Bild", id));
  await scheduleSave();
  await saveNow();
  clearPendingAndroidImage();
}

async function handleImageFile(file) {
  if (!file) return;
  // Android WebView can provide File objects without a type; accept by extension as fallback.
  const name = String(file.name || "");
  const type = String(file.type || "");
  const isImage =
    (type && type.startsWith("image/")) ||
    /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(name);
  if (!isImage) {
    await showAlert("Bitte eine Bilddatei auswählen.", { title: "Bild" });
    return;
  }
  // Keep simple: store as data URL (works offline, included in export).
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
  insertImageDataUrl(String(dataUrl), name || "Bild");
  clearPendingAndroidImage();
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function clearPendingAndroidImage() {
  try {
    nativeAndroidPicker()?.clearPendingImage?.();
  } catch {
    // ignore
  }
}

async function readPendingAndroidImage(nameHint, lengthHint) {
  const bridge = nativeAndroidPicker();
  if (!bridge) throw new Error("Android bridge not available");

  const lengthFromBridge =
    typeof bridge.getPendingImageLength === "function" ? Number(bridge.getPendingImageLength()) : 0;
  const totalLength = lengthFromBridge || Number(lengthHint || 0);
  if (!Number.isFinite(totalLength) || totalLength <= 0) throw new Error("Android image is empty");

  const chunkSizeFromBridge =
    typeof bridge.getImageChunkSize === "function" ? Number(bridge.getImageChunkSize()) : 65536;
  const chunkSize = Math.max(4096, Math.min(65536, chunkSizeFromBridge || 65536));

  const parts = [];
  for (let offset = 0; offset < totalLength; offset += chunkSize) {
    const chunk = bridge.readPendingImageChunk(offset, Math.min(chunkSize, totalLength - offset));
    if (typeof chunk !== "string" || chunk.length === 0) throw new Error(`Missing Android image chunk at ${offset}`);
    parts.push(chunk);
    if (parts.length % 8 === 0) await nextTick();
  }

  const bridgeName = typeof bridge.getPendingImageName === "function" ? bridge.getPendingImageName() : "";
  return {
    dataUrl: parts.join(""),
    name: String(bridgeName || nameHint || "Bild"),
  };
}

let androidImageReceiveInProgress = false;
let lastAndroidImageId = "";

async function receivePendingAndroidImage(imageId, nameHint, lengthHint, silent) {
  const bridge = nativeAndroidPicker();
  const transferId = String(imageId || "");
  if (transferId && transferId === lastAndroidImageId) return false;
  if (androidImageReceiveInProgress) return false;

  const pendingLength =
    bridge && typeof bridge.getPendingImageLength === "function" ? Number(bridge.getPendingImageLength()) : 0;
  if (!pendingLength) {
    if (!silent) await showAlert("Bild konnte nicht gelesen werden.", { title: "Bild" });
    return false;
  }

  androidImageReceiveInProgress = true;
  let inserted = false;
  try {
    const { dataUrl, name } = await readPendingAndroidImage(nameHint, lengthHint || pendingLength);
    if (!dataUrl.startsWith("data:image/")) {
      if (!silent) await showAlert("Bild konnte nicht gelesen werden.", { title: "Bild" });
      return false;
    }
    insertImageDataUrl(dataUrl, name || "Bild");
    inserted = true;
    if (transferId) lastAndroidImageId = transferId;
    return true;
  } catch (e) {
    console.error(e);
    if (!silent) await showAlert("Bild konnte nicht eingefügt werden.", { title: "Bild" });
    return false;
  } finally {
    if (inserted) clearPendingAndroidImage();
    androidImageReceiveInProgress = false;
  }
}

window.notizReceiveAndroidImage = async (imageId, nameHint, lengthHint) => {
  await receivePendingAndroidImage(imageId, nameHint, lengthHint, false);
};

window.notizMaybeReceiveAndroidImage = async (imageId, nameHint, lengthHint) => {
  await receivePendingAndroidImage(imageId, nameHint, lengthHint, true);
};

window.notizInsertImageUrlFromAndroid = async (imageId, src, name) => {
  try {
    await insertAndroidImageUrl(imageId, src, name || "Bild");
  } catch (e) {
    console.error(e);
    await showAlert("Bild konnte nicht eingefügt werden.", { title: "Bild" });
  }
};

function pollPendingAndroidImage(timeoutMs = 30000) {
  if (!nativeAndroidPicker()) return;
  const startedAt = Date.now();
  const tick = async () => {
    if (Date.now() - startedAt > timeoutMs) return;
    const bridge = nativeAndroidPicker();
    const pendingLength =
      bridge && typeof bridge.getPendingImageLength === "function" ? Number(bridge.getPendingImageLength()) : 0;
    if (pendingLength > 0) {
      const imageId = typeof bridge.getPendingImageId === "function" ? bridge.getPendingImageId() : "";
      const imageName = typeof bridge.getPendingImageName === "function" ? bridge.getPendingImageName() : "Bild";
      const inserted = await receivePendingAndroidImage(imageId, imageName, pendingLength, true);
      if (inserted) return;
    }
    window.setTimeout(tick, 500);
  };
  window.setTimeout(tick, 500);
}

window.notizInsertImageFromAndroid = async (dataUrl, name) => {
  try {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      await showAlert("Bild konnte nicht gelesen werden.", { title: "Bild" });
      return;
    }
    insertImageDataUrl(dataUrl, name || "Bild");
  } catch (e) {
    console.error(e);
    await showAlert("Bild konnte nicht eingefügt werden.", { title: "Bild" });
  }
};

function normalizeSizeValue(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
  if (/^\d+(\.\d+)?(px|%)$/i.test(s)) return s.toLowerCase();
  return "__invalid__";
}

async function openImageSizeDialog(img) {
  const wrap = document.createElement("div");
  wrap.className = "imgdlg";

  const row1 = document.createElement("div");
  row1.className = "imgdlg__row";

  const widthInput = document.createElement("input");
  widthInput.className = "imgdlg__input";
  widthInput.placeholder = "Breite (z.B. 80% oder 320px)";
  widthInput.value = img.getAttribute("data-w") || img.style.width || "";

  const heightInput = document.createElement("input");
  heightInput.className = "imgdlg__input";
  heightInput.placeholder = "Höhe (leer = auto)";
  heightInput.value = img.getAttribute("data-h") || img.style.height || "";

  row1.append(widthInput, heightInput);

  const row2 = document.createElement("div");
  row2.className = "imgdlg__row imgdlg__row--between";

  const lockLabel = document.createElement("label");
  lockLabel.className = "imgdlg__lock";
  const lock = document.createElement("input");
  lock.type = "checkbox";
  lock.checked = (img.getAttribute("data-lock") || "1") === "1";
  const lockText = document.createElement("span");
  lockText.textContent = "Seitenverhältnis halten";
  lockLabel.append(lock, lockText);

  const quick = document.createElement("div");
  quick.className = "imgdlg__quick";
  const mkQuick = (label, val) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn--ghost";
    b.textContent = label;
    b.addEventListener("click", () => {
      widthInput.value = val;
      heightInput.value = "";
    });
    return b;
  };
  quick.append(mkQuick("25%", "25%"), mkQuick("50%", "50%"), mkQuick("100%", "100%"));

  row2.append(lockLabel, quick);

  wrap.append(row1, row2);

  const result = await showDialog({
    title: "Bildgröße",
    body: wrap,
    focusSelector: ".imgdlg__input",
    buttons: [
      { id: "cancel", label: "Abbrechen", className: "btn btn--ghost" },
      { id: "remove", label: "Entfernen", danger: true },
      { id: "apply", label: "Übernehmen" },
    ],
  });

  if (result === "remove") {
    img.remove();
    ensureTrailingLine();
    await scheduleSave();
    await saveNow();
    return;
  }
  if (result !== "apply") return;

  const w = normalizeSizeValue(widthInput.value);
  const h = normalizeSizeValue(heightInput.value);
  if (w === "__invalid__" || h === "__invalid__") {
    await showAlert("Ungültige Größe. Erlaubt: Zahl, px oder % (z.B. 80% oder 320px).", { title: "Bildgröße" });
    return;
  }

  const lockOn = lock.checked;
  img.setAttribute("data-lock", lockOn ? "1" : "0");

  if (w) {
    img.style.width = w;
    img.setAttribute("data-w", w);
  } else {
    img.style.removeProperty("width");
    img.removeAttribute("data-w");
  }

  if (lockOn) {
    img.style.height = "auto";
    img.removeAttribute("data-h");
  } else if (h) {
    img.style.height = h;
    img.setAttribute("data-h", h);
  } else {
    img.style.height = "auto";
    img.removeAttribute("data-h");
  }

  ensureTrailingLine();
  await scheduleSave();
  await saveNow();
}

function bindToolbar() {
  document.addEventListener("click", (e) => {
    const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
    const btn = t?.closest?.("[data-cmd],[data-action]");
    if (!(btn instanceof HTMLElement)) return;
    if (!btn.closest(".toolbar")) return;
    e.preventDefault();
    const cmd = btn.getAttribute("data-cmd");
    const action = btn.getAttribute("data-action");
    if (cmd) {
      if (["justifyLeft", "justifyCenter", "justifyRight", "justifyFull"].includes(cmd)) applyJustify(cmd);
      else exec(cmd);
    }
    if (action === "checklist") insertChecklistItem();
    if (action === "normal") setNormal();
  });

  els.blockSelect.addEventListener("change", () => applyBlock(els.blockSelect.value));
  els.sizeSelect.addEventListener("change", () => applyFontSizePx(els.sizeSelect.value));
  els.fontSelect.addEventListener("change", () => applyFontName(els.fontSelect.value));
  els.textColor.addEventListener("input", () => applyTextColor(els.textColor.value));
  els.highlightColor.addEventListener("input", () => applyHighlightColor(els.highlightColor.value));
}

function bind() {
  wireModalDismiss();
  els.themeBtn.addEventListener("click", toggleTheme);
  els.backLink.addEventListener("click", async (e) => {
    if (!state.dirty) return;
    e.preventDefault();
    if (await confirmLeaveIfDirty()) location.href = "./index.html";
  });

  els.titleInput.addEventListener("input", scheduleSave);
  els.categoryInput.addEventListener("input", scheduleSave);
  els.tagsInput.addEventListener("input", scheduleSave);
  els.contentInput.addEventListener("input", () => {
    ensureTrailingLine();
    scheduleSave();
  });
  els.contentInput.addEventListener("paste", (e) => {
    // default: paste as plain text. Hold Shift while pasting to keep formatting.
    if (e.shiftKey) return;
    const text = e.clipboardData?.getData("text/plain") ?? "";
    e.preventDefault();
    els.contentInput.focus();
    try {
      document.execCommand("insertText", false, text);
    } catch {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    ensureTrailingLine();
    scheduleSave();
  });

  els.contentInput.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const img = t.closest("img.noteimg");
    if (!(img instanceof HTMLImageElement)) return;
    e.preventDefault();
    await openImageSizeDialog(img);
  });
  els.contentInput.addEventListener("pointerdown", (e) => {
    const t = e.target;
    // Prevent checkbox rows from stealing focus/caret when clicking the empty area.
    if (t instanceof HTMLInputElement && t.type === "checkbox") {
      // allow toggle, but keep caret in text afterwards
      setTimeout(() => {
        const row = t.closest("[data-checkitem]");
        const text = row?.querySelector?.(".checktext");
        if (text instanceof HTMLElement) {
          placeCaretAtEnd(text);
        } else {
          placeCaretAtEnd(els.contentInput);
        }
      }, 0);
      scheduleSave();
      return;
    }
    // If user clicks the checkbox row container, focus the text (not the checkbox).
    const row = t instanceof HTMLElement ? t.closest("[data-checkitem]") : null;
    if (row && !(t instanceof HTMLElement && t.classList.contains("checktext"))) {
      const text = row.querySelector(".checktext");
      if (text instanceof HTMLElement) {
        e.preventDefault();
        placeCaretAtEnd(text);
      }
      return;
    }

    // Clicking in empty editor area should keep caret in editor (not select last checkbox)
    if (t === els.contentInput) {
      ensureTrailingLine();
      setTimeout(() => {
        const trailing = els.contentInput.querySelector('[data-trailing="1"]');
        if (trailing instanceof HTMLElement) placeCaretAtEnd(trailing);
        else placeCaretAtEnd(els.contentInput);
      }, 0);
    }
  });
  els.titleInput.addEventListener("blur", saveNow);
  els.categoryInput.addEventListener("blur", saveNow);
  els.tagsInput.addEventListener("blur", saveNow);
  els.contentInput.addEventListener("blur", saveNow);

  els.deleteBtn.addEventListener("click", onDelete);

  els.imageInput.addEventListener("change", async () => {
    const file = els.imageInput.files && els.imageInput.files.length ? els.imageInput.files[0] : null;
    els.imageInput.value = ""; // reset AFTER we captured the file reference
    try {
      await handleImageFile(file);
      if (!file) pollPendingAndroidImage(10000);
    } catch (e) {
      console.error(e);
      pollPendingAndroidImage(10000);
      await showAlert("Bild konnte nicht eingefügt werden.", { title: "Bild" });
    }
  });

  els.imagePickerBtn.addEventListener("click", async (e) => {
    const picker = nativeAndroidPicker();
    if (!picker) return;
    e.preventDefault();
    try {
      picker.pickImage();
      pollPendingAndroidImage();
    } catch (err) {
      console.error(err);
      await showAlert("Bildauswahl konnte nicht geöffnet werden.", { title: "Bild" });
    }
  });

  window.addEventListener("focus", () => pollPendingAndroidImage(6000));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollPendingAndroidImage(6000);
  });

  document.addEventListener("keydown", async (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await saveNow();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (await confirmLeaveIfDirty()) location.href = "./index.html";
    }
  });

  bindToolbar();
}

async function loadNoteFromUrl() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) {
    els.subtitle.textContent = "Neue Notiz";
    els.deleteBtn.disabled = true;
    setStatus("Tippe los zum Erstellen");
    return;
  }
  const note = await getNote(id);
  if (!note) {
    els.subtitle.textContent = "Nicht gefunden";
    els.deleteBtn.disabled = true;
    setStatus("Notiz nicht gefunden");
    return;
  }
  state.id = note.id;
  els.deleteBtn.disabled = false;
  els.titleInput.value = note.title ?? "";
  els.categoryInput.value = note.category ?? "";
  els.tagsInput.value = Array.isArray(note.tags) ? note.tags.join(", ") : "";
  const content = note.content ?? "";
  if (looksLikeHtml(content)) els.contentInput.innerHTML = content;
  else els.contentInput.textContent = content;
  normalizeChecklist(els.contentInput);
  ensureTrailingLine();
  setMeta(note);
  setStatus("Bereit");
}

async function bootstrap() {
  loadTheme();
  ensureCssMode();
  bind();
  await loadNoteFromUrl();
  await setupServiceWorker();

  window.setInterval(() => snapshotBackup("interval").catch(() => {}), 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") snapshotBackup("hidden").catch(() => {});
  });
}

bootstrap().catch((e) => {
  console.error(e);
  showAlert("Start fehlgeschlagen.", { title: "Fehler" });
});
