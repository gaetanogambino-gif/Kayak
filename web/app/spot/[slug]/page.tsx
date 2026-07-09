import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllSpots, getSpot, MONTHS, monthTitle, CRITERION, verdict,
} from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { WindChart } from "@/components/WindChart";
import { site } from "@/config/site";

export const revalidate = 86400;

export async function generateStaticParams() {
  const spots = await getAllSpots();
  return spots.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const spot = await getSpot(params.slug);
  if (!spot) return {};
  const best = bestMonth(spot.monthly);
  return {
    title: `Kite a ${spot.name}: quando andare`,
    description:
      `Statistiche di vento per il kitesurf a ${spot.name}${spot.country ? ` (${spot.country})` : ""}: ` +
      `percentuale di giorni utili mese per mese su 5 anni. Mese migliore: ${monthTitle(best.month)} (${Math.round(best.pct)}%).`,
    alternates: { canonical: `/spot/${spot.slug}` },
  };
}

function bestMonth(monthly: (number | null)[]) {
  let month = 1, pct = -1;
  monthly.forEach((v, i) => { if ((v ?? -1) > pct) { pct = v ?? -1; month = i + 1; } });
  return { month, pct: Math.max(0, pct) };
}

export default async function SpotPage({ params }: { params: { slug: string } }) {
  const spot = await getSpot(params.slug);
  if (!spot) notFound();

  const ranked = spot.monthly
    .map((v, i) => ({ month: i + 1, pct: v ?? 0 }))
    .sort((a, b) => b.pct - a.pct);
  const top = ranked.slice(0, 3);
  const isYellow = spot.status === "yellow";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: spot.name,
    address: spot.country ?? undefined,
    geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lon },
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="text-sm mb-4" style={{ color: "var(--fg-subtle)" }}>
        <Link href="/">Spot</Link> <span aria-hidden>›</span> {spot.name}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{spot.name}</h1>
          <p className="mt-1" style={{ color: "var(--fg-muted)" }}>
            {spot.country} · {spot.lat.toFixed(3)}, {spot.lon.toFixed(3)}
          </p>
        </div>
        <StatusBadge status={spot.status} />
      </header>

      {isYellow && spot.notes && (
        <div
          className="card p-4 mb-6 text-sm"
          style={{ borderColor: "var(--yellow)", color: "var(--fg-muted)" }}
        >
          <strong style={{ color: "var(--yellow)" }}>Dato indicativo.</strong> {spot.notes}
        </div>
      )}

      <section className="card p-5 mb-6">
        <h2 className="font-semibold mb-1">Giorni utili per mese</h2>
        <p className="text-sm mb-4" style={{ color: "var(--fg-subtle)" }}>
          % di giorni con almeno {CRITERION.hours}h consecutive di vento ≥ {CRITERION.knots} nodi
          (fascia {CRITERION.dayStart}:00–{CRITERION.dayEnd}:00), media {CRITERION.years}.
        </p>
        <WindChart monthly={spot.monthly} stats={spot.stats} muted={isYellow} />
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-3">Mesi migliori</h2>
        <div className="flex flex-wrap gap-2">
          {top.map((t) => (
            <Link
              key={t.month}
              href={`/kite/${spot.slug}/${MONTHS[t.month - 1]}`}
              className="card px-3 py-2 text-sm"
            >
              <span className="font-medium">{monthTitle(t.month)}</span>{" "}
              <span style={{ color: "var(--accent)" }}>{Math.round(t.pct)}%</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Tutti i mesi</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {spot.monthly.map((v, i) => (
            <Link
              key={i}
              href={`/kite/${spot.slug}/${MONTHS[i]}`}
              className="card px-3 py-2 text-sm flex items-center justify-between"
            >
              <span>{monthTitle(i + 1)}</span>
              <span style={{ color: "var(--fg-muted)" }}>{v == null ? "n/d" : `${Math.round(v)}%`}</span>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm" style={{ color: "var(--fg-subtle)" }}>
          In sintesi: a {spot.name} il mese migliore è {monthTitle(top[0].month)} con{" "}
          {Math.round(top[0].pct)}% di giorni utili ({verdict(top[0].pct)}).
        </p>
      </section>
    </article>
  );
}
