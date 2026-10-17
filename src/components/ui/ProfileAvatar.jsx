import { useEffect, useState } from 'react';
import { User } from 'lucide-react';

/**
 * Imagen de perfil tolerante a fallos: las URLs vienen de CDNs externos que a veces
 * fallan de forma intermitente. Reintenta una vez y, si sigue fallando, muestra el ícono.
 */
export default function ProfileAvatar({ src, alt = '', iconSize = 13 }) {
  const [attempt, setAttempt] = useState(0);

  // Al cambiar de imagen, se vuelve a intentar desde cero.
  useEffect(() => setAttempt(0), [src]);

  if (!src || attempt > 1) return <User size={iconSize} className="text-primary" />;

  // El reintento evita que el navegador reuse la respuesta fallida.
  const url = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`;

  return (
    <img
      key={attempt}
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setAttempt(current => current + 1)}
      className="h-full w-full rounded-full object-cover"
    />
  );
}
