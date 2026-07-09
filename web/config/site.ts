// Branding centralizzato. Cambia qui nome/dominio quando li decidi: è l'unico punto.
export const site = {
  name: "KiteQuando",
  tagline: "Dove e quando andare a kitesurf, con dati di vento reali.",
  description:
    "Statistiche di vento su 5 anni (2021–2025) per gli spot di kitesurf nel mondo: " +
    "percentuale di giorni utili mese per mese, calcolata da dati storici Open-Meteo (ERA5).",
  // Dominio definitivo da impostare a deploy (usato per canonical URL e sitemap).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kitequando.example",
  locale: "it_IT",
} as const;
