const DB_NAME = "notiz_db";
const DB_VERSION = 1;
const STORE = "notes";
const LS_KEY = "notiz_notes_v1";

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} title
 * @property {string} content
 * @property {string=} category
 * @property {string[]=} tags
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
      store.createIndex("title", "title");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function nativeStore() {
  // @ts-ignore Android WebView bridge
  const bridge = globalThis.NotizAndroid;
  return bridge &&
    typeof bridge.getNotesJson === "function" &&
    typeof bridge.setNotesJson === "function"
    ? bridge
    : null;
}

function readLocalNotes() {
  try {
    const bridge = nativeStore();
    const raw = bridge ? bridge.getNotesJson() : localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => n && typeof n.id === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalNotes(notes) {
  const json = JSON.stringify(notes);
  const bridge = nativeStore();
  if (bridge) bridge.setNotesJson(json);
  try {
    localStorage.setItem(LS_KEY, json);
  } catch {
    // Native Android storage is primary inside APK.
    if (!bridge) throw new Error("Lokaler Speicher nicht verfügbar");
  }
}

function upsertLocalNote(note) {
  const notes = readLocalNotes();
  const index = notes.findIndex((n) => n.id === note.id);
  if (index >= 0) notes[index] = note;
  else notes.push(note);
  writeLocalNotes(notes);
}

function deleteLocalNote(id) {
  writeLocalNotes(readLocalNotes().filter((n) => n.id !== id));
}

function mergeNotes(primary, secondary) {
  const map = new Map();
  for (const note of secondary) map.set(note.id, note);
  for (const note of primary) map.set(note.id, note);
  return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/** @param {(store: IDBObjectStore) => void} fn */
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    fn(store);
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** @returns {Promise<Note[]>} */
export async function listNotes() {
  const localNotes = readLocalNotes();
  try {
    const db = await openDb();
    const idbNotes = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readonly");
      const store = transaction.objectStore(STORE);
      const index = store.index("updatedAt");
      const request = index.openCursor(null, "prev");
      /** @type {Note[]} */
      const notes = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(notes);
        notes.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    const merged = mergeNotes(/** @type {Note[]} */ (localNotes), /** @type {Note[]} */ (idbNotes));
    try {
      writeLocalNotes(merged);
    } catch {
      // ignore
    }
    return merged;
  } catch {
    return localNotes;
  }
}

/** @param {string} id @returns {Promise<Note | null>} */
export async function getNote(id) {
  const local = readLocalNotes().find((n) => n.id === id);
  if (local) return local;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readonly");
      const store = transaction.objectStore(STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/** @param {Note} note */
export async function putNote(note) {
  let saved = false;
  let lastError = null;
  try {
    upsertLocalNote(note);
    saved = true;
  } catch (e) {
    lastError = e;
  }
  try {
    await tx("readwrite", (store) => store.put(note));
    saved = true;
  } catch (e) {
    lastError = e;
  }
  if (!saved) throw lastError || new Error("Speichern fehlgeschlagen");
}

/** @param {string} id */
export async function deleteNote(id) {
  try {
    deleteLocalNote(id);
  } catch {
    // ignore
  }
  await tx("readwrite", (store) => store.delete(id)).catch(() => {});
}

/** @returns {Promise<string>} */
export async function exportJson() {
  const notes = await listNotes();
  return JSON.stringify(
    {
      schema: 1,
      exportedAt: Date.now(),
      notes,
    },
    null,
    2
  );
}

/** @param {any} payload */
export async function importJson(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Ungültiges JSON");
  const notes = Array.isArray(payload.notes) ? payload.notes : [];
  const now = Date.now();
  /** @type {Note[]} */
  const normalized = notes
    .map((n) => ({
      id: typeof n.id === "string" ? n.id : crypto.randomUUID(),
      title: typeof n.title === "string" ? n.title : "",
      content: typeof n.content === "string" ? n.content : "",
      createdAt: typeof n.createdAt === "number" ? n.createdAt : now,
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : now,
    }))
    .filter((n) => typeof n.id === "string" && n.id.length > 0);

  writeLocalNotes(normalized);
  await tx("readwrite", (store) => {
    for (const note of normalized) store.put(note);
  }).catch(() => {});
}
