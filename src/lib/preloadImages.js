// Precarga de imágenes en segundo plano: baja y decodifica las imágenes antes de que una
// página las muestre, así aparecen al instante en vez de recuadros vacíos que se llenan
// de a poco. Prioridad baja y de a pocas a la vez, para no frenar lo que se está viendo.

const done = new Set();
// Las imágenes precargadas quedan referenciadas durante la sesión: si se sueltan, el
// navegador libera la copia decodificada y al cambiar de pestaña vuelve a leerlas y
// decodificarlas (recuadros vacíos un instante). Son íconos chicos (~400 en total).
const retained = new Map();

/** Equipos con poca memoria: se precarga igual, pero sin retener las imágenes. */
function shouldRetain() {
  const memory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined;
  return !memory || memory >= 4;
}

/** Conexión con ahorro de datos o muy lenta: no conviene bajar imágenes "por si acaso". */
export function shouldSkipPreload() {
  const connection = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (!connection) return false;
  return Boolean(connection.saveData) || ['slow-2g', '2g'].includes(connection.effectiveType);
}

function loadImage(url) {
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    // Las imágenes de la página actual van primero.
    if ('fetchPriority' in image) image.fetchPriority = 'low';
    const finish = () => {
      if (shouldRetain()) retained.set(url, image);
      resolve();
    };
    image.onload = () => (image.decode ? image.decode().then(finish, finish) : finish());
    image.onerror = () => resolve();
    image.src = url;
  });
}

/**
 * Baja las imágenes de la lista (sin repetir las ya precargadas en la sesión), de a
 * `concurrency` a la vez. Devuelve una función para cancelar lo que falte.
 * @param {string[]} urls
 * @param {{ concurrency?: number }} [options]
 */
export function preloadImages(urls, { concurrency = 6 } = {}) {
  const queue = [...new Set(urls.filter(Boolean).map(url => String(url).trim()))].filter(url => !done.has(url));
  let cancelled = false;
  const worker = async () => {
    while (!cancelled && queue.length) {
      const url = queue.shift();
      done.add(url);
      await loadImage(url);
    }
  };
  Array.from({ length: Math.min(concurrency, queue.length) }, worker);
  return () => {
    cancelled = true;
  };
}

/** Ejecuta `task` cuando el navegador está libre (o a los 1,5 s si no hay requestIdleCallback). */
export function whenIdle(task) {
  if (typeof window === 'undefined') return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 1500);
  return () => window.clearTimeout(id);
}
