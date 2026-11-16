// Smoke de las páginas públicas: cargan, navegan y no tiran errores de JavaScript.
import { expect, test } from '@playwright/test';

// Errores de hidratación de React (#418 texto distinto, #423 re-render en cliente, #425).
// Ya estaban antes de estos tests: el HTML prerenderizado no coincide con el primer render
// del cliente. Se siguen en el test marcado con test.fail() al final.
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
  await expect(page.locator('p.my-1\\.5').first()).toBeVisible();
  expect(errors.other).toEqual([]);
});

test('login muestra el formulario', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/login');
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  expect(errors.other).toEqual([]);
});

// Falla esperada: documenta el problema de hidratación. Cuando se corrija, Playwright avisa
// que este test "pasó inesperadamente": ahí hay que sacar el test.fail().
test('las páginas prerenderizadas hidratan sin diferencias', async ({ page }) => {
  test.fail();
  const errors = collectErrors(page);
  await page.goto('/campeones');
  await expect(page.locator('a[href^="/campeones/"]').first()).toBeVisible();
  expect(errors.hydration).toEqual([]);
});
