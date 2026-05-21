import { deleteNote, exportJson, getNote, importJson, listNotes, putNote } from "./db.js";
import { listBackups, restoreBackup, snapshotBackup } from "./backup.js";
import { showAlert, showConfirm, wireModalDismiss } from "./ui.js";

const qs = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const els = {
  list: qs("#list"),
  searchInput: /** @type {HTMLInputElement} */ (qs("#searchInput")),
  searchMeta: qs("#searchMeta"),
  newBtn: /** @type {HTMLButtonElement} */ (qs("#newBtn")),
  themeBtn: /** @type {HTMLButtonElement} */ (qs("#themeBtn")),
  backupBtn: /** @type {HTMLButtonElement} */ (qs("#backupBtn")),
  exportBtn: /** @type {HTMLButtonElement} */ (qs("#exportBtn")),
  importFile: /** @type {HTMLInputElement} */ (qs("#importFile")),
};

/** @type {{notes: import("./db.js").Note[], filtered: import("./db.js").Note[]}} */
const state = {
  notes: [],
  filtered: [],
};

function formatTs(ts) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function previewText(s) {
  return (s || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);
}

function stripHtml(html) {
  const t = document.createElement("div");
  t.innerHTML = html || "";
  return (t.textContent || "").trim();
}

function isoWeekKey(ts) {
  const d = new Date(ts);
  // ISO week date weeks start on Monday
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3); // Thursday in current week
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000);
  const year = d.getFullYear();
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function isoWeekLabel(key) {
  const nowKey = isoWeekKey(Date.now());
  const prevKey = isoWeekKey(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (key === nowKey) return "Diese Woche";
  if (key === prevKey) return "Letzte Woche";
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return key;
  return `${m[1]} · KW ${m[2]}`;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim());
  if (typeof tags === "string")
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  return [];
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

function setStatus(msg) {
  // index has no status bar; no-op
  void msg;
}

function matchesQuery(note, q) {
  if (!q) return true;
  const plain = stripHtml(note.content || "");
  const tags = normalizeTags(note.tags).join(" ");
  const cat = (note.category || "").toString();
  const hay = `${note.title}\n${plain}\n${tags}\n${cat}`.toLowerCase();
  return hay.includes(q);
}

function applyFilter() {
  const q = els.searchInput.value.trim().toLowerCase();
  state.filtered = state.notes.filter((n) => matchesQuery(n, q));
  els.searchMeta.textContent = q ? `${state.filtered.length} Treffer` : `${state.notes.length} Notizen`;
}

function renderList() {
  applyFilter();
  /** @type {Map<string, import("./db.js").Note[]>} */
  const groups = new Map();
  for (const n of state.filtered) {
    const key = isoWeekKey(n.updatedAt);
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  const keys = Array.from(groups.keys()).sort().reverse();
  const nodes = [];
  for (const key of keys) {
    const header = document.createElement("div");
    header.className = "group";
    header.textContent = isoWeekLabel(key);
    nodes.push(header);

    for (const n of groups.get(key) ?? []) {
      const el = document.createElement("a");
      el.className = "item";
      el.setAttribute("role", "listitem");
      el.setAttribute("href", `./note.html?id=${encodeURIComponent(n.id)}`);
      el.setAttribute("data-id", n.id);

      const title = document.createElement("div");
      title.className = "item__title";
      title.textContent = n.title?.trim() ? n.title.trim() : "Ohne Titel";

      const preview = document.createElement("div");
      preview.className = "item__preview";
      preview.textContent = previewText(stripHtml(n.content || ""));

      const meta = document.createElement("div");
      meta.className = "item__meta";

      const time = document.createElement("div");
      time.className = "item__time";
      time.textContent = formatTs(n.updatedAt);

      const tags = normalizeTags(n.tags);
      if (n.category || tags.length) {
        const chips = document.createElement("div");
        chips.className = "chips";
        if (n.category) {
          const c = document.createElement("span");
          c.className = "chip chip--cat";
          c.textContent = n.category;
          chips.appendChild(c);
        }
        for (const t of tags.slice(0, 3)) {
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.textContent = `#${t}`;
          chips.appendChild(chip);
        }
        meta.append(time, chips);
      } else {
        meta.append(time);
      }

      const more = document.createElement("button");
      more.className = "morebtn";
      more.type = "button";
      more.setAttribute("aria-label", "Mehr");
      more.textContent = "⋯";

      el.append(title, preview, meta, more);
      nodes.push(el);
    }
  }
  els.list.replaceChildren(...nodes);
}

async function refreshNotes() {
  state.notes = await listNotes();
  renderList();
}

async function createNote() {
  const now = Date.now();
  /** @type {import("./db.js").Note} */
  const note = {
    id: crypto.randomUUID(),
    title: "",
    content: "",
    category: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  await putNote(note);
  await refreshNotes();
  location.href = `./note.html?id=${encodeURIComponent(note.id)}`;
}

async function onExport() {
  const text = await exportJson();
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `notiz-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  snapshotBackup("export").catch(() => {});
}

async function onImport(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  await importJson(payload);
  await refreshNotes();
  snapshotBackup("import").catch(() => {});
}

const MENU_ID = "ctxMenu";
function closeMenu() {
  const m = document.getElementById(MENU_ID);
  if (m) m.remove();
  document.removeEventListener("click", onDocClick, true);
  document.removeEventListener("keydown", onDocKeydown, true);
}
function onDocClick(e) {
  const m = document.getElementById(MENU_ID);
  if (!m) return;
  if (e.target instanceof Node && m.contains(e.target)) return;
  closeMenu();
}
function onDocKeydown(e) {
  if (e.key === "Escape") closeMenu();
}

function openMenu({ x, y, id }) {
  closeMenu();
  const m = document.createElement("div");
  m.id = MENU_ID;
  m.className = "menu";
  m.style.left = `${x}px`;
  m.style.top = `${y}px`;

  const mk = (label, fn, danger = false) => {
    const b = document.createElement("button");
    b.className = `menubtn${danger ? " menubtn--danger" : ""}`;
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", async () => {
      closeMenu();
      await fn();
    });
    return b;
  };

  m.append(
    mk("Öffnen", async () => (location.href = `./note.html?id=${encodeURIComponent(id)}`)),
    mk("Duplizieren", async () => {
      const note = await getNote(id);
      if (!note) return;
      const now = Date.now();
      const copy = {
        ...note,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        title: note.title ? `${note.title} (Kopie)` : "Ohne Titel (Kopie)",
      };
      await putNote(copy);
      await refreshNotes();
    }),
    mk("Löschen", async () => {
      const note = await getNote(id);
      const label = note?.title?.trim() ? `„${note.title.trim()}“` : "diese Notiz";
      const ok = await showConfirm(`Wirklich ${label} löschen?`, { title: "Löschen", danger: true, okText: "Löschen" });
      if (!ok) return;
      await deleteNote(id);
      await refreshNotes();
    }, true)
  );

  document.body.appendChild(m);
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onDocKeydown, true);

  const rect = m.getBoundingClientRect();
  const pad = 8;
  const nx = Math.min(x, window.innerWidth - rect.width - pad);
  const ny = Math.min(y, window.innerHeight - rect.height - pad);
  m.style.left = `${Math.max(pad, nx)}px`;
  m.style.top = `${Math.max(pad, ny)}px`;
}

let longPressTimer = /** @type {number|null} */ (null);
function bindListGestures() {
  els.list.addEventListener("contextmenu", (e) => {
    const item = e.target instanceof HTMLElement ? e.target.closest(".item[data-id]") : null;
    if (!item) return;
    e.preventDefault();
    const id = item.getAttribute("data-id");
    if (!id) return;
    openMenu({ x: e.clientX, y: e.clientY, id });
  });

  els.list.addEventListener("pointerdown", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const more = target?.closest?.(".morebtn");
    const item = target?.closest?.(".item[data-id]");
    if (!(item instanceof HTMLElement)) return;
    const id = item.getAttribute("data-id");
    if (!id) return;

    if (more) {
      e.preventDefault();
      const r = (more instanceof HTMLElement ? more : item).getBoundingClientRect();
      openMenu({ x: r.right, y: r.bottom, id });
      return;
    }

    // long-press on touch/pens
    if (e.pointerType === "touch") {
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        openMenu({ x: e.clientX, y: e.clientY, id });
      }, 520);
    }
  });

  els.list.addEventListener("pointerup", () => {
    if (longPressTimer) window.clearTimeout(longPressTimer);
    longPressTimer = null;
  });
  els.list.addEventListener("pointercancel", () => {
    if (longPressTimer) window.clearTimeout(longPressTimer);
    longPressTimer = null;
  });
  els.list.addEventListener("pointermove", (e) => {
    if (!longPressTimer) return;
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
}

function openBackupMenu({ x, y }) {
  closeMenu();
  const m = document.createElement("div");
  m.id = MENU_ID;
  m.className = "menu";
  m.style.left = `${x}px`;
  m.style.top = `${y}px`;

  const backups = listBackups();
  const mk = (label, fn, danger = false) => {
    const b = document.createElement("button");
    b.className = `menubtn${danger ? " menubtn--danger" : ""}`;
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", async () => {
      closeMenu();
      await fn();
    });
    return b;
  };

  if (!backups.length) {
    const d = document.createElement("div");
    d.className = "menuhint";
    d.textContent = "Keine Backups vorhanden.";
    m.append(d);
  } else {
    m.append(
      mk("Letztes Backup wiederherstellen", async () => {
        const latest = backups[0];
        if (!latest) return;
        const ok = await showConfirm("Letztes Backup wiederherstellen? (Vorhandene Notizen werden überschrieben)", {
          title: "Restore",
          danger: true,
          okText: "Wiederherstellen",
        });
        if (!ok) return;
        await restoreBackup(latest);
        await refreshNotes();
      }, true)
    );
    const div = document.createElement("div");
    div.className = "menudiv";
    m.append(div);
    for (const b of backups.slice(0, 5)) {
      const when = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(b.ts));
      m.append(
        mk(`Restore · ${when}`, async () => {
          const ok = await showConfirm(`Backup von ${when} wiederherstellen? (Überschreibt aktuelle Notizen)`, {
            title: "Restore",
            danger: true,
            okText: "Wiederherstellen",
          });
          if (!ok) return;
          await restoreBackup(b);
          await refreshNotes();
        }, true)
      );
    }
  }

  document.body.appendChild(m);
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onDocKeydown, true);
}

function bind() {
  wireModalDismiss();
  els.newBtn.addEventListener("click", createNote);
  els.themeBtn.addEventListener("click", toggleTheme);
  els.exportBtn.addEventListener("click", onExport);
  els.backupBtn.addEventListener("click", (e) => {
    const r = els.backupBtn.getBoundingClientRect();
    openBackupMenu({ x: r.left, y: r.bottom + 6 });
  });

  els.importFile.addEventListener("change", async () => {
    const file = els.importFile.files?.[0];
    els.importFile.value = "";
    if (!file) return;
    try {
      await onImport(file);
    } catch (e) {
      console.error(e);
      await showAlert("Import fehlgeschlagen (ungültige Datei).", { title: "Import" });
    }
  });

  els.searchInput.addEventListener("input", () => renderList());
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      els.searchInput.value = "";
      renderList();
    }
  });

  document.addEventListener("keydown", async (e) => {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key.toLowerCase() === "n") {
      e.preventDefault();
      await createNote();
    }
    if (meta && e.key.toLowerCase() === "b") {
      e.preventDefault();
      openBackupMenu({ x: 16, y: 64 });
    }
  });

  bindListGestures();
}

async function bootstrap() {
  loadTheme();
  bind();
  await refreshNotes();
  els.searchMeta.textContent = `${state.notes.length} Notizen`;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  window.setInterval(() => snapshotBackup("interval").catch(() => {}), 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") snapshotBackup("hidden").catch(() => {});
  });
}

bootstrap().catch((e) => {
  console.error(e);
  showAlert("Start fehlgeschlagen.", { title: "Fehler" });
});
