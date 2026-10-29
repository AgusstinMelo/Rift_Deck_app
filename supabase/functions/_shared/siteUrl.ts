// Dominio público de la app para las URLs de retorno de los pagos (back_url, return_url, cancel_url).
const DEFAULT_SITE_URL = "https://www.riftdeckapp.com";

export function getSiteUrl() {
  return (Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
}
