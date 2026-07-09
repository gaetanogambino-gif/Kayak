import Link from "next/link";
import type { SpotWithStats } from "@/lib/data";
import { StatusBadge } from "./StatusBadge";
import { Sparkline } from "./Sparkline";

export function SpotCard({ spot, month }: { spot: SpotWithStats; month?: number }) {
  const pct = month ? spot.monthly[month - 1] : null;
  return (
    <Link
      href={`/spot/${spot.slug}`}
      className="card p-4 flex flex-col gap-3 transition-colors hover:border-current"
      style={{ textDecoration: "none" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold leading-tight">{spot.name}</div>
          <div className="text-sm" style={{ color: "var(--fg-subtle)" }}>
            {spot.country}
          </div>
        </div>
        {pct != null && (
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold leading-none" style={{ color: "var(--accent)" }}>
              {Math.round(pct)}%
            </div>
            <div className="text-[11px]" style={{ color: "var(--fg-subtle)" }}>
              giorni utili
            </div>
          </div>
        )}
      </div>
      <Sparkline monthly={spot.monthly} highlight={month} />
      <StatusBadge status={spot.status} size="sm" />
    </Link>
  );
}
