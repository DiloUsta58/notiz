import { exportJson, importJson } from "./db.js";

const KEY = "notiz_backups_v1";
const MAX = 5;
const MAX_CHARS = 2_000_000; // ~2MB to avoid storage issues

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function snapshotBackup(reason) {
  const json = await exportJson();
  if (json.length > MAX_CHARS) return;
  const list = readAll();
  const entry = { ts: Date.now(), reason: reason || "auto", json };
  const next = [entry, ...list].slice(0, MAX);
  writeAll(next);
}

export function listBackups() {
  return readAll();
}

export async function restoreBackup(entry) {
  if (!entry || typeof entry.json !== "string") throw new Error("Ungültiges Backup");
  const payload = JSON.parse(entry.json);
  await importJson(payload);
}

