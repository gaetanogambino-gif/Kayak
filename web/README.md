# KiteQuando — sito MVP (Next.js)

Sito che legge gli spot e le statistiche di vento da Supabase e genera pagine
statiche indicizzabili, incluse le pagine SEO programmatiche `spot × mese`.

## Stack
- Next.js 14 (App Router, SSG + ISR), TypeScript, Tailwind CSS
- `@supabase/supabase-js` — lettura con **anon key** (RLS sola-lettura pubblica su Supabase)

## Sviluppo locale
```bash
cd web
npm install
npm run dev      # http://localhost:3000
```
Le env hanno un fallback pubblico (URL + anon key, sicuri grazie alla RLS), quindi
gira senza configurazione. Per sovrascrivere, copia `.env.example` in `.env.local`.

## Build
```bash
npm run build && npm start
```
`build` pre-genera staticamente tutte le pagine (home, `/spot/[slug]`,
`/kite/[slug]/[mese]`, `/mese/[mese]`) più `sitemap.xml` e `robots.txt`.

## Deploy su Vercel
1. Importa il repo su Vercel e imposta **Root Directory = `web`**.
2. Aggiungi le Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://mzfbppxjgwkqveviynvm.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (anon key del progetto Supabase)
   - `NEXT_PUBLIC_SITE_URL` = dominio definitivo (es. `https://kitequando.com`)
3. Deploy. Le pagine si rigenerano (ISR) ogni 24h quando il DB cambia.

> Nota sicurezza: nel frontend va **solo** la anon key (pubblica). La
> `service_role` non deve mai comparire qui.

## Struttura
- `config/site.ts` — nome/tagline/dominio (branding in un solo punto)
- `lib/supabase.ts`, `lib/data.ts` — client e query tipizzate (+ cache di processo)
- `components/` — `WindChart` (SVG), `SpotCard`, `Sparkline`, `StatusBadge`, `SpotExplorer`
- `app/` — le rotte (home, spot, kite/spot×mese, mese) + `sitemap.ts` + `robots.ts`
