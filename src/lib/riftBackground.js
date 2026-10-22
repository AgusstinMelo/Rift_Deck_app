// Fondo animado de la app (canvas 2D, sin dependencias):
// 1. Grilla de puntos tenue con parallax respecto del scroll.
// 2. "Río": banda de luz dorada a 45° (la diagonal "\" del logo) que barre la
//    pantalla; los puntos de la grilla dentro de la banda se iluminan.
// 3. Partículas doradas con profundidad que derivan en esa diagonal y se estiran
//    como estelas verticales al scrollear rápido.
// 4. Halo que sigue al puntero y tiñe de dorado los puntos cercanos.
// Con prefers-reduced-motion se dibuja un único frame estático.

const GOLD = '201, 160, 66';
const BONE = '242, 239, 232';
const DIAGONAL = Math.SQRT1_2;

const MAX_DPR = 2;
const MAX_FRAME_DT = 0.05;

const GRID_GAP = 28;
const GRID_DOT_RADIUS = 0.75;
const GRID_ALPHA = 0.05;
const GRID_PARALLAX = 0.12;

const RIVER_PERIOD = 20;
const RIVER_HALF_WIDTH = 170;
const RIVER_ALPHA = 0.045;
const RIVER_DOT_ALPHA = 0.2;
const RIVER_SCROLL_PUSH = 0.35;
const RIVER_STATIC_PHASE = 0.42;

const HALO_RADIUS = 280;
const HALO_ALPHA = 0.07;
const CURSOR_DOT_RADIUS = 180;
const CURSOR_DOT_ALPHA = 0.5;

const AREA_PER_PARTICLE = 34000;
const MIN_PARTICLES = 18;
const MAX_PARTICLES = 60;
const MAX_STREAK = 90;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const gold = (alpha) => `rgba(${GOLD}, ${clamp(alpha, 0, 1)})`;

function createDotTile(rgb, dpr) {
  const size = Math.max(1, Math.round(GRID_GAP * dpr));
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tileCtx = tile.getContext('2d');
  // Centrado en el medio de un píxel: en un borde, el antialiasing reparte el
  // punto entre 4 píxeles y prácticamente desaparece.
  const center = Math.floor(size / 2) + 0.5;
  tileCtx.fillStyle = `rgb(${rgb})`;
  tileCtx.beginPath();
  tileCtx.arc(center, center, GRID_DOT_RADIUS * dpr, 0, Math.PI * 2);
  tileCtx.fill();
  return tile;
}

// El tile se dibuja en píxeles físicos; el patrón se escala a píxeles CSS para
// que los puntos queden nítidos con el transform del contexto (scale(dpr)).
function createDotPattern(context, rgb, dpr) {
  const pattern = context.createPattern(createDotTile(rgb, dpr), 'repeat');
  if (pattern && typeof DOMMatrix !== 'undefined') {
    pattern.setTransform(new DOMMatrix().scale(1 / dpr));
  }
  return pattern;
}

function createParticle(width, height) {
  const depth = Math.random();
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    depth,
    radius: 0.6 + depth * 1.6,
    speed: 5 + depth * 20,
    alpha: 0.12 + depth * 0.38,
    parallax: 0.04 + depth * 0.22,
    stretch: 0.012 + depth * 0.03,
    twinkleSpeed: 0.6 + Math.random() * 1.4,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}

export function createRiftBackground(canvas, { intensity = 1, scrollElement = null } = {}) {
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const maskCtx = mask.getContext('2d');
  if (!ctx || !maskCtx) return () => {};

  const strength = clamp(Number(intensity) || 0, 0, 2);
  const scrollTarget = scrollElement || window;
  const readScroll = () => (scrollElement ? scrollElement.scrollTop : window.scrollY);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listenerOptions = { passive: true };

  let reducedMotion = motionQuery.matches;
  let width = 0;
  let height = 0;
  let dpr = 0;
  let gridGap = GRID_GAP;
  let bonePattern = null;
  let goldPattern = null;
  let particles = [];
  let frameId = 0;
  let lastTime = 0;
  let elapsed = 0;
  let scrollY = readScroll();
  let lastScrollY = scrollY;
  let scrollDelta = 0;
  let scrollVelocity = 0;
  let riverPush = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, active: false, presence: 0, seen: false };

  function syncParticles() {
    const target = clamp(Math.round((width * height) / AREA_PER_PARTICLE), MIN_PARTICLES, MAX_PARTICLES);
    if (particles.length > target) particles = particles.slice(0, target);
    while (particles.length < target) particles.push(createParticle(width, height));
    // Las lejanas primero: las cercanas (más grandes y brillantes) quedan encima.
    particles.sort((a, b) => a.depth - b.depth);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width || window.innerWidth));
    height = Math.max(1, Math.round(rect.height || window.innerHeight));

    const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(width * nextDpr);
    canvas.height = Math.round(height * nextDpr);
    mask.width = canvas.width;
    mask.height = canvas.height;

    if (nextDpr !== dpr) {
      dpr = nextDpr;
      gridGap = Math.max(1, Math.round(GRID_GAP * dpr)) / dpr;
      bonePattern = createDotPattern(ctx, BONE, dpr);
      goldPattern = createDotPattern(maskCtx, GOLD, dpr);
    }

    // Cambiar el tamaño del canvas resetea su transform.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    syncParticles();
    if (reducedMotion) renderStatic();
  }

  // Coordenada perpendicular a la diagonal "\": u = (x - y) / √2.
  function riverCenter(phase) {
    const start = -height * DIAGONAL - RIVER_HALF_WIDTH;
    const span = width * DIAGONAL + RIVER_HALF_WIDTH - start;
    const progress = phase ?? (elapsed / RIVER_PERIOD + riverPush / span);
    return start + (progress % 1) * span;
  }

  function riverGradient(context, center, alpha) {
    const from = (center - RIVER_HALF_WIDTH) * DIAGONAL;
    const to = (center + RIVER_HALF_WIDTH) * DIAGONAL;
    const gradient = context.createLinearGradient(from, -from, to, -to);
    gradient.addColorStop(0, gold(0));
    gradient.addColorStop(0.25, gold(alpha * 0.35));
    gradient.addColorStop(0.5, gold(alpha));
    gradient.addColorStop(0.75, gold(alpha * 0.35));
    gradient.addColorStop(1, gold(0));
    return gradient;
  }

  function fillGrid(context, pattern) {
    if (!pattern) return;
    // Parallax: la grilla se mueve más lento que el contenido. Se redondea al
    // píxel físico para que los puntos no titilen con offsets fraccionarios.
    const offset = Math.round((-(scrollY * GRID_PARALLAX) % gridGap) * dpr) / dpr;
    context.save();
    context.translate(0, offset);
    context.fillStyle = pattern;
    context.fillRect(0, -gridGap, width, height + gridGap * 2);
    context.restore();
  }

  // Puntos iluminados: se arma una máscara (río + cursor) y se rellena con la
  // grilla dorada en modo source-in, así cada punto toma el alfa de la máscara.
  function drawLitDots(center, withCursor) {
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.fillStyle = riverGradient(maskCtx, center, RIVER_DOT_ALPHA * strength);
    maskCtx.fillRect(0, 0, width, height);

    if (withCursor && pointer.presence > 0.01) {
      const glow = maskCtx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, CURSOR_DOT_RADIUS);
      glow.addColorStop(0, gold(CURSOR_DOT_ALPHA * strength * pointer.presence));
      glow.addColorStop(1, gold(0));
      maskCtx.fillStyle = glow;
      maskCtx.fillRect(pointer.x - CURSOR_DOT_RADIUS, pointer.y - CURSOR_DOT_RADIUS, CURSOR_DOT_RADIUS * 2, CURSOR_DOT_RADIUS * 2);
    }

    maskCtx.globalCompositeOperation = 'source-in';
    fillGrid(maskCtx, goldPattern);
    maskCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(mask, 0, 0, width, height);
  }

  function drawHalo() {
    if (pointer.presence <= 0.01) return;
    const alpha = HALO_ALPHA * strength * pointer.presence;
    const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, HALO_RADIUS);
    halo.addColorStop(0, gold(alpha));
    halo.addColorStop(0.45, gold(alpha * 0.35));
    halo.addColorStop(1, gold(0));
    ctx.fillStyle = halo;
    ctx.fillRect(pointer.x - HALO_RADIUS, pointer.y - HALO_RADIUS, HALO_RADIUS * 2, HALO_RADIUS * 2);
  }

  function drawParticles(animated) {
    ctx.lineCap = 'round';
    for (const particle of particles) {
      const twinkle = animated ? 0.7 + 0.3 * Math.sin(elapsed * particle.twinkleSpeed + particle.twinklePhase) : 1;
      const alpha = particle.alpha * twinkle * strength;
      if (alpha < 0.005) continue;

      // Al scrollear hacia abajo el contenido sube: la estela queda por debajo.
      const trail = animated ? clamp(scrollVelocity * particle.stretch, -MAX_STREAK, MAX_STREAK) : 0;
      if (Math.abs(trail) > particle.radius * 1.5) {
        const streak = ctx.createLinearGradient(particle.x, particle.y, particle.x, particle.y + trail);
        streak.addColorStop(0, gold(alpha));
        streak.addColorStop(1, gold(0));
        ctx.strokeStyle = streak;
        ctx.lineWidth = particle.radius * 2;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x, particle.y + trail);
        ctx.stroke();
        continue;
      }

      if (particle.depth > 0.6) {
        ctx.fillStyle = gold(alpha * 0.15);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = gold(alpha);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(animated, riverPhase) {
    const center = riverCenter(riverPhase);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = riverGradient(ctx, center, RIVER_ALPHA * strength);
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = clamp(GRID_ALPHA * strength, 0, 1);
    fillGrid(ctx, bonePattern);
    ctx.globalAlpha = 1;

    drawLitDots(center, animated);
    if (animated) drawHalo();
    drawParticles(animated);
  }

  function wrap(particle) {
    const margin = MAX_STREAK;
    if (particle.x > width + margin) particle.x -= width + margin * 2;
    else if (particle.x < -margin) particle.x += width + margin * 2;
    if (particle.y > height + margin) particle.y -= height + margin * 2;
    else if (particle.y < -margin) particle.y += height + margin * 2;
  }

  function step(dt) {
    elapsed += dt;

    let delta = scrollY - lastScrollY;
    lastScrollY = scrollY;
    // Un salto de más de una pantalla (cambio de ruta) no cuenta como scroll.
    if (Math.abs(delta) > height) delta = 0;
    scrollDelta = delta;
    scrollVelocity += ((dt > 0 ? delta / dt : 0) - scrollVelocity) * ease(dt, 10);
    riverPush += Math.abs(delta) * RIVER_SCROLL_PUSH;

    const follow = ease(dt, 7);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    pointer.presence += ((pointer.active ? 1 : 0) - pointer.presence) * ease(dt, 4);

    for (const particle of particles) {
      const drift = particle.speed * dt * DIAGONAL;
      particle.x += drift;
      particle.y += drift - scrollDelta * particle.parallax;
      wrap(particle);
    }
  }

  function frame(now) {
    frameId = requestAnimationFrame(frame);
    const dt = lastTime ? Math.min((now - lastTime) / 1000, MAX_FRAME_DT) : 0;
    lastTime = now;
    step(dt);
    draw(true);
  }

  function renderStatic() {
    draw(false, RIVER_STATIC_PHASE);
  }

  function start() {
    if (frameId || reducedMotion || document.hidden) return;
    lastTime = 0;
    lastScrollY = scrollY;
    frameId = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function setPointer(event) {
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    if (!pointer.seen) {
      pointer.x = pointer.targetX;
      pointer.y = pointer.targetY;
      pointer.seen = true;
    }
    pointer.active = true;
  }

  const onScroll = () => {
    scrollY = readScroll();
  };
  const onPointerUp = (event) => {
    if (event.pointerType !== 'mouse') pointer.active = false;
  };
  // relatedTarget null = el puntero salió de la ventana.
  const onPointerOut = (event) => {
    if (!event.relatedTarget) pointer.active = false;
  };
  const onBlur = () => {
    pointer.active = false;
  };
  const onVisibilityChange = () => {
    if (document.hidden) stop();
    else start();
  };
  const onMotionChange = (event) => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      stop();
      renderStatic();
    } else {
      start();
    }
  };

  scrollTarget.addEventListener('scroll', onScroll, listenerOptions);
  window.addEventListener('resize', resize, listenerOptions);
  window.addEventListener('pointermove', setPointer, listenerOptions);
  window.addEventListener('pointerdown', setPointer, listenerOptions);
  window.addEventListener('pointerup', onPointerUp, listenerOptions);
  window.addEventListener('pointercancel', onPointerUp, listenerOptions);
  window.addEventListener('pointerout', onPointerOut, listenerOptions);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  motionQuery.addEventListener('change', onMotionChange);

  resize();
  start();

  return function destroy() {
    stop();
    scrollTarget.removeEventListener('scroll', onScroll, listenerOptions);
    window.removeEventListener('resize', resize, listenerOptions);
    window.removeEventListener('pointermove', setPointer, listenerOptions);
    window.removeEventListener('pointerdown', setPointer, listenerOptions);
    window.removeEventListener('pointerup', onPointerUp, listenerOptions);
    window.removeEventListener('pointercancel', onPointerUp, listenerOptions);
    window.removeEventListener('pointerout', onPointerOut, listenerOptions);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    motionQuery.removeEventListener('change', onMotionChange);
    mask.width = 0;
    mask.height = 0;
  };
}
