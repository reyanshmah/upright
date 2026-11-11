"use client";

/**
 * Local-first result store (MASTER.md "Backend and data"). sessionStorage
 * clears when the tab closes, so every finished result is also written to
 * IndexedDB BEFORE the results screen opens. Results only: no landmark
 * streams, no name. Every call is safe when IndexedDB is unavailable
 * (private window, blocked site data): it returns false / [] and the app works.
 */
import type { ChairStandResult, TugResult } from "./contract";
import { CONFIG_VERSION } from "./signal/thresholds";
import { APP_VERSION } from "./version";

export interface StoredRun {
  /** Session id from the landmark stream: one row per finished test. */
  id: string;
  savedAt: string;
  kind: "tug" | "chair";
  appVersion: string;
  configVersion: string;
  result: TugResult | ChairStandResult;
  /** Set once a later sync step has uploaded the row. */
  synced?: boolean;
}

const DB = "upright";
const STORE = "runs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRun(run: { id: string; kind: "tug" | "chair"; result: TugResult | ChairStandResult }): Promise<boolean> {
  try {
    const db = await open();
    const row: StoredRun = { ...run, savedAt: new Date().toISOString(), appVersion: APP_VERSION, configVersion: CONFIG_VERSION };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function listRuns(): Promise<StoredRun[]> {
  try {
    const db = await open();
    const rows = await new Promise<StoredRun[]>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as StoredRun[]);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows;
  } catch {
    return [];
  }
}
