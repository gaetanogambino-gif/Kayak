import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllSpots, getSpot, MONTHS, monthTitle, monthFromSlug, CRITERION, verdict, bestForMonth,
} from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { site } from "@/config/site";

export const revalidate = 86400;

export async function generateStaticParams() {
  const spots = await getAllSpots();
  return spots.flatMap((s) => MONTHS.map((mese) => ({ slug: s.slug, mese })));
}

export async function generateMetadata(
  { params }: { params: { slug: string; mese: string } },
): Promise<Metadata> {
  const spot = await getSpot(params.slug);
  const month = monthFromSlug(params.mese);
  if (!spot || !month) return {};
  const pct = spot.monthly[month - 1];
  const pctTxt = pct == null ? "" : ` — ${Math.round(pct)}% di giorni utili`;
  return {
    title: `Kite a ${spot.name} a ${monthTitle(month)}: c'è vento?`,
    description:
      `Quanto vento c'è per il kitesurf a ${spot.name} a ${monthTitle(month)}${pctTxt}, ` +
      `dalla media storica 2021–2025. Criterio: ≥3h a ≥12 nodi tra le 9 e le 19.`,
    alternates: { canonical: `/kite/${spot.slug}/${params.mese}` },
  };
}

export default async function KiteMonthPage(
  { params }: { params: { slug: string; mese: string } },
) {
  const spot = await getSpot(params.slug);
  const month = monthFromSlug(params.mese);
  if (!spot || !month) notFound();

  const stat = spot.stats[month];
  const pct = spot.monthly[month - 1] ?? 0;

  // Posizione del mese nell'anno per questo spot
  const rank =
    spot.monthly.filter((v) => (v ?? -1) > pct).length + 1;

  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;

  // Alternative: migliori spot verdi in quel mese (escluso l'attuale)
  const alternatives = (await bestForMonth(month, "green"))
    .filter((x) => x.spot.slug !== spot.slug)
    .slice(0, 4);

  return (
    <article>
      <nav className="text-sm mb-4" style={{ color: "var(--fg-subtle)" }}>
        <Link href="/">Spot</Link> <span aria-hidden>›</span>{" "}
        <Link href={`/spot/${spot.slug}`}>{spot.name}</Link> <span aria-hidden>›</span>{" "}
        {monthTitle(month)}
      </nav>

      <header className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight">
          Kite a {spot.name} a {monthTitle(month)}
        </h1>
        <div className="mt-2"><StatusBadge status={spot.status} /></div>
      </header>

      <section className="card p-6 mb-6">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-bold" style={{ color: "var(--accent)" }}>
            {Math.round(pct)}%
          </span>
          <span style={{ color: "var(--fg-muted)" }}>giorni utili a {monthTitle(month)}</span>
        </div>
        <p className="mt-3" style={{ color: "var(--fg-muted)" }}>
          A {monthTitle(month)} a {spot.name} il vento è <strong>{verdict(pct)}</strong>:{" "}
          in media {stat ? stat.kiteable_days : 0} giornate utili su {stat ? stat.total_days : 0}{" "}
          analizzate (2021–2025). È il {rank}º mese più ventoso dell&apos;anno qui.
        </p>
        {spot.status === "yellow" && spot.notes && (
          <p className="mt-3 text-sm" style={{ color: "var(--fg-subtle)" }}>
            ⚠ Dato indicativo: {spot.notes}
          </p>
        )}
      </section>

      <section className="mb-6 text-sm" style={{ color: "var(--fg-subtle)" }}>
        Come lo calcoliamo: un giorno è &quot;utile&quot; se ha almeno {CRITERION.hours} ore
        consecutive con vento ≥ {CRITERION.knots} nodi nella fascia{" "}
        {CRITERION.dayStart}:00–{CRITERION.dayEnd}:00, dai dati storici Open-Meteo
        (ERA5-seamless), media {CRITERION.years}.
      </section>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link href={`/spot/${spot.slug}`} className="card px-3 py-2 text-sm">
          ← Tutti i mesi di {spot.name}
        </Link>
        <Link href={`/kite/${spot.slug}/${MONTHS[prev - 1]}`} className="card px-3 py-2 text-sm">
          {monthTitle(prev)}
        </Link>
        <Link href={`/kite/${spot.slug}/${MONTHS[next - 1]}`} className="card px-3 py-2 text-sm">
          {monthTitle(next)}
        </Link>
      </div>

      {alternatives.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Altri spot con vento a {monthTitle(month)}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {alternatives.map(({ spot: s, pct: p }) => (
              <Link
                key={s.slug}
                href={`/kite/${s.slug}/${MONTHS[month - 1]}`}
                className="card px-3 py-2 text-sm flex items-center justify-between"
              >
                <span>{s.name} <span style={{ color: "var(--fg-subtle)" }}>· {s.country}</span></span>
                <span style={{ color: "var(--accent)" }}>{Math.round(p)}%</span>
              </Link>
            ))}
          </div>
          <p className="mt-4">
            <Link href={`/mese/${MONTHS[month - 1]}`} style={{ color: "var(--accent)" }}>
              Classifica completa: dove fare kite a {monthTitle(month)} →
            </Link>
          </p>
        </section>
      )}
    </article>
  );
}
