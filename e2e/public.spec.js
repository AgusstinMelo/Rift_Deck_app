// Smoke de las páginas públicas: cargan, navegan y no tiran errores de JavaScript.
import { expect, test } from '@playwright/test';

// Errores de hidratación de React (#418 HTML distinto, #423 re-render en cliente, #425 texto).
// El prerender (entry-server.jsx) y el navegador renderizan el mismo árbol (AppShell).
const HYDRATION_ERROR = /Minified React error #(418|423|425)\b|Hydration|hydrat/i;

/** Errores de página y de consola de React, separando los de hidratación. */
function collectErrors(page) {
  const errors = { other: [], hydration: [] };
  const push = text => (HYDRATION_ERROR.test(text) ? errors.hydration : errors.other).push(text);
  page.on('pageerror', error => push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /React error|Hydration|hydrat/i.test(message.text())) push(message.text());
  });
  return errors;
}

test('la home pública carga', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#home-title')).toBeVisible();
  expect(errors.other).toEqual([]);
});

test('biblioteca de campeones: lista y ficha', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/campeones');
  const firstChampion = page.locator('a[href^="/campeones/"]').first();
  await expect(firstChampion).toBeVisible();
  await firstChampion.click();
  await expect(page).toHaveURL(/\/campeones\/[^/]+$/);
  expect(errors.other).toEqual([]);
});

test('ficha de objeto prerenderizada muestra la descripción', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/objetos');
  const firstItem = page.locator('a[href^="/objetos/"]').first();
  await expect(firstItem).toBeVisible();
  const href = await firstItem.getAttribute('href');
  // Carga directa (HTML prerenderizado + hidratación), no navegación del cliente.
  await page.goto(href);
  await expect(page.locator('.rd-ed-effect-list li').first()).toBeVisible();
  expect(errors.other).toEqual([]);
});

test('login muestra el formulario', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  expect(errors.other).toEqual([]);
});

// Las páginas prerenderizadas (home, listas y fichas) hidratan sin diferencias con el servidor.
for (const path of ['/', '/campeones', '/campeones/akali', '/objetos', '/runas']) {
  test(`hidrata sin diferencias: ${path}`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(path);
    await expect(page.locator('h1:visible').first()).toBeVisible();
    // La hidratación termina después de cargar las páginas públicas (main.jsx).
    await page.waitForLoadState('networkidle');
    expect(errors.hydration).toEqual([]);
    expect(errors.other).toEqual([]);
  });
}
