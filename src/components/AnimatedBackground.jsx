import { useEffect, useRef } from 'react';
import { createRiftBackground } from '@/lib/riftBackground';

// Canvas fijo detrás del contenido. scrollSelector apunta al contenedor que
// scrollea (en Layout es <main class="rd-main-content">); sin él usa window.
export default function AnimatedBackground({ intensity = 1, scrollSelector }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const scrollElement = scrollSelector ? document.querySelector(scrollSelector) : null;
    return createRiftBackground(canvas, { intensity, scrollElement });
  }, [intensity, scrollSelector]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
