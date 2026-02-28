/**
 * IndexedDB store for uploaded Excel risk register files (multiple files supported).
 * List key: riskai_uploaded_excel_list_v2
 * Blob key per file: riskai_excel_blob_${id}
 */

import { makeId } from "@/lib/id";

const DB_NAME = "riskai_upload_db";
const STORE_NAME = "file";
const LIST_KEY = "riskai_uploaded_excel_list_v2";

function blobKey(id: string): string {
  return `riskai_excel_blob_${id}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
  });
}

export type StoredFileMeta = {
  id: string;
  name: string;
  uploadedAt: string;
  importedAt?: string;
  blob: Blob;
};

type StoredFileRecord = {
  id: string;
  name: string;
  uploadedAt: string;
  importedAt?: string;
};

type FileListPayload = {
  files: StoredFileRecord[];
};

/**
 * Save a new uploaded file. Appends to the list (does not replace).
 * Returns the new file's id.
 */
export function saveFile(file: File): Promise<string> {
  const id = makeId("excel");
  const record: StoredFileRecord = {
    id,
    name: file.name,
    uploadedAt: new Date().toISOString(),
  };
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const getListReq = store.get(LIST_KEY);
      getListReq.onsuccess = () => {
        const raw = getListReq.result;
        const list: FileListPayload = raw && typeof raw === "object" && Array.isArray(raw?.files)
          ? { files: [...raw.files, record] }
          : { files: [record] };
        store.put(list, LIST_KEY);
        store.put(file, blobKey(id));
      };
      getListReq.onerror = () => {
        db.close();
        reject(getListReq.error);
      };
      tx.oncomplete = () => {
        db.close();
        resolve(id);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  });
}

/**
 * Load all stored files (metadata + blobs).
 */
export function loadFiles(): Promise<StoredFileMeta[]> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getListReq = store.get(LIST_KEY);
      getListReq.onsuccess = () => {
        const raw = getListReq.result;
        const list: StoredFileRecord[] =
          raw && typeof raw === "object" && Array.isArray(raw?.files) ? raw.files : [];
        if (list.length === 0) {
          db.close();
          resolve([]);
          return;
        }
        const results: StoredFileMeta[] = [];
        let done = 0;
        list.forEach((rec) => {
          const blobReq = store.get(blobKey(rec.id));
          blobReq.onsuccess = () => {
            const b = blobReq.result;
            if (b instanceof Blob) {
              results.push({
                id: rec.id,
                name: rec.name,
                uploadedAt: rec.uploadedAt,
                importedAt: rec.importedAt,
                blob: b,
              });
            }
            done++;
            if (done === list.length) {
              db.close();
              resolve(results.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)));
            }
          };
          blobReq.onerror = () => {
            done++;
            if (done === list.length) {
              db.close();
              resolve(results.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)));
            }
          };
        });
      };
      getListReq.onerror = () => {
        db.close();
        reject(getListReq.error);
      };
    });
  });
}

/**
 * Delete one file by id. Does not modify the risk list.
 */
export function deleteFile(id: string): Promise<void> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const getListReq = store.get(LIST_KEY);
      getListReq.onsuccess = () => {
        const raw = getListReq.result;
        const list: StoredFileRecord[] =
          raw && typeof raw === "object" && Array.isArray(raw?.files) ? raw.files : [];
        const next = list.filter((f) => f.id !== id);
        store.put({ files: next }, LIST_KEY);
        store.delete(blobKey(id));
      };
      getListReq.onerror = () => {
        db.close();
        reject(getListReq.error);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  });
}

/**
 * Mark a file as translated to risks (sets importedAt).
 */
export function markFileImported(id: string): Promise<void> {
  return openDb().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getListReq = store.get(LIST_KEY);
      getListReq.onsuccess = () => {
        const raw = getListReq.result;
        const list: StoredFileRecord[] =
          raw && typeof raw === "object" && Array.isArray(raw?.files) ? raw.files : [];
        const now = new Date().toISOString();
        const next = list.map((f) =>
          f.id === id ? { ...f, importedAt: now } : f
        );
        store.put({ files: next }, LIST_KEY);
      };
      getListReq.onerror = () => {
        db.close();
        reject(getListReq.error);
      };
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  });
}
