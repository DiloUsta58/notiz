const DB_NAME = "notiz_db";
const DB_VERSION = 1;
const STORE = "notes";

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
  const db = await openDb();
  return new Promise((resolve, reject) => {
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
}

/** @param {string} id @returns {Promise<Note | null>} */
export async function getNote(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** @param {Note} note */
export async function putNote(note) {
  await tx("readwrite", (store) => store.put(note));
}

/** @param {string} id */
export async function deleteNote(id) {
  await tx("readwrite", (store) => store.delete(id));
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

  await tx("readwrite", (store) => {
    for (const note of normalized) store.put(note);
  });
}
