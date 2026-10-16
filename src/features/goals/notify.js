import { toast } from '@/components/ui/use-toast';

const SUCCESS_MS = 3000;
const ERROR_MS = 5000;

/**
 * Muestra un aviso que se cierra solo (el toast del proyecto no tiene duración propia),
 * igual que showTemporaryToast en la página Partidas. Los errores duran un poco más.
 * @param {{ title: string, description?: string, variant?: 'default' | 'destructive' }} options
 */
export function notify(options) {
  const notification = toast(options);
  const duration = options.variant === 'destructive' ? ERROR_MS : SUCCESS_MS;
  globalThis.setTimeout(() => notification.dismiss(), duration);
  return notification;
}
