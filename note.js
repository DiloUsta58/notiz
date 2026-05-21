import { deleteNote, getNote, putNote } from "./db.js";
import { snapshotBackup } from "./backup.js";

const qs = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const els = {
  themeBtn: /** @type {HTMLButtonElement} */ (qs("#themeBtn")),
  subtitle: qs("#subtitle"),
  statusText: qs("#statusText"),
  metaText: qs("#metaText"),
  titleInput: /** @type {HTMLInputElement} */ (qs("#titleInput")),
  categoryInput: /** @type {HTMLInputElement} */ (qs("#categoryInput")),
  tagsInput: /** @type {HTMLInputElement} */ (qs("#tagsInput")),
  contentInput: /** @type {HTMLDivElement} */ (qs("#contentInput")),
  blockSelect: /** @type {HTMLSelectElement} */ (qs("#blockSelect")),
  sizeSelect: /** @type {HTMLSelectElement} */ (qs("#sizeSelect")),
  fontSelect: /** @type {HTMLSelectElement} */ (qs("#fontSelect")),
  textColor: /** @type {HTMLInputElement} */ (qs("#textColor")),
  highlightColor: /** @type {HTMLInputElement} */ (qs("#highlightColor")),
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
  if (!confirm(`Wirklich ${label} löschen?`)) return;
  await deleteNote(state.id);
  location.href = "./index.html";
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
  els.themeBtn.addEventListener("click", toggleTheme);

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

  window.addEventListener("beforeunload", (e) => {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  document.addEventListener("keydown", async (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await saveNow();
    }
    if (e.key === "Escape") {
      // quick back on mobile/keyboards
      // eslint-disable-next-line no-restricted-globals
      location.href = "./index.html";
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
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

  window.setInterval(() => snapshotBackup("interval").catch(() => {}), 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") snapshotBackup("hidden").catch(() => {});
  });
}

bootstrap().catch((e) => {
  console.error(e);
  alert("Start fehlgeschlagen.");
});
