// Reduce cada captura en el cliente antes de subirla: lado mayor hasta 2048 px, JPEG 0.8.
// Una captura de 3-6 MB queda en ~200-500 KB y el EXIF (ubicación, etc.) se descarta.
// 2048 (y no menos) para no perder detalle en los íconos chicos de objetos y hechizos,
// que se identifican comparando píxeles.

export const MAX_SIDE = 2048;
export const JPEG_QUALITY = 0.8;

/** Tamaño final manteniendo la proporción; nunca agranda. */
export function fitWithin(width, height, maxSide = MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function loadImage(file) {
  // createImageBitmap respeta la orientación EXIF y no bloquea el hilo principal.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // iOS viejos no aceptan las opciones: se cae al <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {File} file
 * @returns {Promise<{ media_type: 'image/jpeg', data: string, previewUrl: string }>}
 *   data: base64 sin prefijo (lo que espera la edge function); previewUrl: data URL para miniaturas.
 */
export async function resizeCapture(file) {
  const source = await loadImage(file);
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) throw new Error('invalid_image');

  const { width, height } = fitWithin(sourceWidth, sourceHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0, width, height);
  source.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return { media_type: 'image/jpeg', data: dataUrl.split(',')[1], previewUrl: dataUrl };
}

/**
 * Versión más chica de una captura ya reducida (por ejemplo, para mandarla al modelo,
 * que solo necesita leer texto). Si ya es chica, la devuelve igual.
 * @param {{ media_type: string, data: string, previewUrl: string }} capture
 * @param {number} maxSide
 */
export async function downscaleCapture(capture, maxSide) {
  const image = new Image();
  image.src = capture.previewUrl;
  await image.decode();
  const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight, maxSide);
  if (width === image.naturalWidth) return capture;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return { media_type: 'image/jpeg', data: dataUrl.split(',')[1], previewUrl: dataUrl };
}

/**
 * Recorte AMPLIADO de la esquina superior izquierda del marcador: el modo
 * ("CLASIFICATORIA", "PVP"...) y debajo "Wild Rift·mm:ss" con la duración. Ese texto es
 * muy chico en la captura completa; ampliado, el modelo lo lee sin dudas, y el pedido
 * pesa unos pocos KB. Las posiciones son las del marcador (escalan con el alto).
 * @param {{ previewUrl: string }} capture
 */
export async function cropDurationCorner(capture) {
  const image = new Image();
  image.src = capture.previewUrl;
  await image.decode();
  const W = image.naturalWidth;
  const H = image.naturalHeight;
  const sx = Math.max(0, W / 2 - 0.93 * H);
  const sw = 0.45 * H;
  const sy = 0.015 * H;
  const sh = 0.1 * H;
  const scale = Math.min(4, Math.max(1, 220 / sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  canvas.width = 0;
  canvas.height = 0;
  return { media_type: 'image/jpeg', data: dataUrl.split(',')[1], previewUrl: dataUrl };
}
