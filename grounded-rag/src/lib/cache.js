const DB_NAME = "grounded-rag";
const STORE_NAME = "embeddings";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a cached embedding index.
 *
 * @param {string} key
 * @returns {Promise<Float32Array[] | null>}
 */
export async function loadEmbeddings(key) {
  try {
    const database = await openDatabase();
    const record = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();

    if (
      !record ||
      !Array.isArray(record.vectors) ||
      record.vectors.length !== record.count
    ) {
      return null;
    }

    return record.vectors.map((vector) =>
      vector instanceof Float32Array ? vector : new Float32Array(vector),
    );
  } catch {
    return null;
  }
}

/**
 * Persist an embedding index. Failures are non-fatal (private mode, quota).
 *
 * @param {string} key
 * @param {Float32Array[]} vectors
 */
export async function saveEmbeddings(key, vectors) {
  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(
        {
          key,
          count: vectors.length,
          dim: vectors[0]?.length ?? 0,
          vectors,
          savedAt: Date.now(),
        },
        key,
      );
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // Ignore cache failures.
  }
}

export async function clearEmbeddings() {
  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // Ignore cache failures.
  }
}
