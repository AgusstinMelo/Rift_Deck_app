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
