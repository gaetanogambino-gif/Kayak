import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MONTHS, monthTitle, monthFromSlug, bestForMonth } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";

export const revalidate = 86400;

export async function generateStaticParams() {
  return MONTHS.map((mese) => ({ mese }));
}

export async function generateMetadata({ params }: { params: { mese: string } }): Promise<Metadata> {
  const month = monthFromSlug(params.mese);
  if (!month) return {};
  return {
    title: `Dove fare kitesurf a ${monthTitle(month)}`,
    description:
      `Le migliori destinazioni kite a ${monthTitle(month)}, ordinate per percentuale di ` +
      `giorni di vento utile (media storica 2021–2025).`,
    alternates: { canonical: `/mese/${params.mese}` },
  };
}

export default async function MesePage({ params }: { params: { mese: string } }) {
  const month = monthFromSlug(params.mese);
  if (!month) notFound();

  const green = await bestForMonth(month, "green");
  const yellow = await bestForMonth(month, "yellow");

  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;

  return (
    <div>
      <nav className="text-sm mb-4" style={{ color: "var(--fg-subtle)" }}>
        <Link href="/">Spot</Link> <span aria-hidden>›</span> {monthTitle(month)}
      </nav>

      <h1 className="text-3xl font-bold tracking-tight mb-1">
        Dove fare kitesurf a {monthTitle(month)}
      </h1>
      <p className="mb-6" style={{ color: "var(--fg-muted)" }}>
        Spot ordinati per percentuale di giorni utili a {monthTitle(month)} (media 2021–2025).
      </p>

      <ol className="flex flex-col gap-2 mb-8">
        {green.map(({ spot, pct }, i) => (
          <li key={spot.slug}>
            <Link
              href={`/kite/${spot.slug}/${params.mese}`}
              className="card px-4 py-3 flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-3">
                <span className="w-6 text-right font-semibold" style={{ color: "var(--fg-subtle)" }}>
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{spot.name}</span>{" "}
                  <span className="text-sm" style={{ color: "var(--fg-subtle)" }}>· {spot.country}</span>
                </span>
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                {Math.round(pct)}%
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {yellow.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            Mete iconiche <StatusBadge status="yellow" size="sm" />
          </h2>
          <p className="text-sm mb-3" style={{ color: "var(--fg-subtle)" }}>
            Spot molto noti dove il vento locale non è colto bene dal dato gratuito: valori indicativi.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {yellow.slice(0, 8).map(({ spot, pct }) => (
              <Link
                key={spot.slug}
                href={`/kite/${spot.slug}/${params.mese}`}
                className="card px-3 py-2 text-sm flex items-center justify-between"
              >
                <span>{spot.name} <span style={{ color: "var(--fg-subtle)" }}>· {spot.country}</span></span>
                <span style={{ color: "var(--fg-muted)" }}>{Math.round(pct)}%</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <Link href={`/mese/${MONTHS[prev - 1]}`} className="card px-3 py-2 text-sm">
          ← {monthTitle(prev)}
        </Link>
        <Link href={`/mese/${MONTHS[next - 1]}`} className="card px-3 py-2 text-sm">
          {monthTitle(next)} →
        </Link>
      </div>
    </div>
  );
}
