// Borrador de la carga con capturas: si el usuario sale de la app a mitad de la carga,
// al volver encuentra todo como lo dejó.
// - Estado (paso, campos extraídos, formulario): localStorage, por usuario.
// - Capturas reducidas (~300 KB c/u, demasiado para localStorage): IndexedDB.
// Todo envuelto en try/catch: en modo privado o con el almacenamiento bloqueado el
// flujo funciona igual, solo que sin borrador.

const STATE_PREFIX = 'rd-match-capture-draft:';
const DB_NAME = 'rd-match-capture';
const STORE = 'images';
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const stateKey = userId => `${STATE_PREFIX}${userId || 'anon'}`;

export function loadDraftState(userId) {
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft?.savedAt || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(stateKey(userId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraftState(userId, state) {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // Sin espacio o bloqueado: seguimos sin borrador.
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const result = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(result?.result);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function saveDraftImages(userId, images) {
  try {
    await withStore('readwrite', store => store.put(images, stateKey(userId)));
  } catch {
    // Ignorado: el borrador queda sin capturas.
  }
}

export async function loadDraftImages(userId) {
  try {
    return (await withStore('readonly', store => store.get(stateKey(userId)))) || [];
  } catch {
    return [];
  }
}

export async function clearDraft(userId) {
  try {
    localStorage.removeItem(stateKey(userId));
  } catch {
    // Ignorado.
  }
  try {
    await withStore('readwrite', store => store.delete(stateKey(userId)));
  } catch {
    // Ignorado.
  }
}

/** Caché genérico en la misma base (láminas de referencia por catálogo). */
export async function cacheGet(key) {
  try {
    return await withStore('readonly', store => store.get(key));
  } catch {
    return null;
  }
}

export async function cacheSet(key, value) {
  try {
    await withStore('readwrite', store => store.put(value, key));
  } catch {
    // Sin caché: se vuelven a armar la próxima vez.
  }
}

export function hasDraft(userId) {
  return Boolean(loadDraftState(userId));
}
