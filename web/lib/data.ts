import { supabase } from "./supabase";

export type SpotStatus = "green" | "yellow";

export type Spot = {
  id: number;
  slug: string;
  name: string;
  country: string | null;
  status: SpotStatus;
  lat: number;
  lon: number;
  notes: string | null;
};

export type MonthStat = {
  spot_id: number;
  month: number; // 1-12
  pct_kiteable_days: number;
  kiteable_days: number;
  total_days: number;
};

export type SpotWithStats = Spot & {
  /** pct per mese, indice 0 = gennaio … 11 = dicembre (null se manca) */
  monthly: (number | null)[];
  stats: Record<number, MonthStat>;
};

// --- Costanti mese (in italiano, usate anche negli URL SEO) ---
export const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
] as const;
export const MONTHS_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function monthName(n: number): string {
  return MONTHS[n - 1] ?? "";
}
export function monthTitle(n: number): string {
  const m = monthName(n);
  return m.charAt(0).toUpperCase() + m.slice(1);
}
export function monthFromSlug(slug: string): number | null {
  const i = MONTHS.indexOf(slug as (typeof MONTHS)[number]);
  return i === -1 ? null : i + 1;
}

// Criterio usato dal motore (mostrato nelle pagine).
export const CRITERION = {
  knots: 12,
  hours: 3,
  dayStart: 9,
  dayEnd: 19,
  model: "era5_seamless",
  years: "2021–2025",
};

// --- Caricamento dati (cache a livello di processo: le pagine statiche
// condividono una sola fetch a build) ---
type DataBundle = { spots: SpotWithStats[]; bySlug: Map<string, SpotWithStats> };
let _cache: Promise<DataBundle> | null = null;

async function loadData(): Promise<DataBundle> {
  const [{ data: spots, error: e1 }, { data: stats, error: e2 }] = await Promise.all([
    supabase.from("spots").select("id,slug,name,country,status,lat,lon,notes").order("name"),
    supabase.from("wind_monthly_stats").select("spot_id,month,pct_kiteable_days,kiteable_days,total_days"),
  ]);
  if (e1) throw new Error(`Errore lettura spots: ${e1.message}`);
  if (e2) throw new Error(`Errore lettura stats: ${e2.message}`);

  const statsBySpot = new Map<number, MonthStat[]>();
  for (const s of (stats ?? []) as MonthStat[]) {
    const arr = statsBySpot.get(s.spot_id) ?? [];
    arr.push({ ...s, pct_kiteable_days: Number(s.pct_kiteable_days) });
    statsBySpot.set(s.spot_id, arr);
  }

  const withStats: SpotWithStats[] = (spots ?? []).map((raw) => {
    const s = { ...raw, lat: Number(raw.lat), lon: Number(raw.lon) } as Spot;
    const rows = statsBySpot.get(s.id) ?? [];
    const monthly: (number | null)[] = Array(12).fill(null);
    const byMonth: Record<number, MonthStat> = {};
    for (const r of rows) {
      monthly[r.month - 1] = r.pct_kiteable_days;
      byMonth[r.month] = r;
    }
    return { ...s, monthly, stats: byMonth };
  });

  return { spots: withStats, bySlug: new Map(withStats.map((s) => [s.slug, s])) };
}

export function getData(): Promise<DataBundle> {
  if (!_cache) _cache = loadData();
  return _cache;
}

export async function getAllSpots(): Promise<SpotWithStats[]> {
  return (await getData()).spots;
}
export async function getSpot(slug: string): Promise<SpotWithStats | undefined> {
  return (await getData()).bySlug.get(slug);
}

/** Spot ordinati per % del mese scelto (decrescente), opzionale filtro stato. */
export async function bestForMonth(
  month: number,
  status?: SpotStatus,
): Promise<{ spot: SpotWithStats; pct: number }[]> {
  const spots = await getAllSpots();
  return spots
    .filter((s) => (status ? s.status === status : true))
    .map((s) => ({ spot: s, pct: s.monthly[month - 1] ?? -1 }))
    .filter((x) => x.pct >= 0)
    .sort((a, b) => b.pct - a.pct);
}

/** Verdetto testuale (usato nelle pagine SEO). */
export function verdict(pct: number): string {
  if (pct >= 70) return "vento quasi garantito";
  if (pct >= 50) return "ottime probabilità di vento";
  if (pct >= 30) return "vento discreto, a fasi";
  if (pct >= 15) return "vento debole, poche giornate utili";
  return "raramente ventoso";
}

/** Colore/tier per una percentuale (per micro-badge). */
export function tier(pct: number): "alto" | "medio" | "basso" {
  if (pct >= 50) return "alto";
  if (pct >= 25) return "medio";
  return "basso";
}
