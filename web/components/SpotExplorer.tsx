"use client";

import { useMemo, useState } from "react";
import { MONTHS, type SpotWithStats, type SpotStatus } from "@/lib/data";
import { SpotCard } from "./SpotCard";

type StatusFilter = "all" | SpotStatus;

export function SpotExplorer({ spots }: { spots: SpotWithStats[] }) {
  const [month, setMonth] = useState(0); // 0 = qualsiasi mese
  const [status, setStatus] = useState<StatusFilter>("all");

  const shown = useMemo(() => {
    let list = spots.filter((s) => (status === "all" ? true : s.status === status));
    if (month > 0) {
      list = [...list].sort(
        (a, b) => (b.monthly[month - 1] ?? -1) - (a.monthly[month - 1] ?? -1),
      );
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [spots, month, status]);

  const selectStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--fg)",
  } as const;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="text-sm">
          <span className="block mb-1" style={{ color: "var(--fg-muted)" }}>Mese</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm"
            style={selectStyle}
          >
            <option value={0}>Qualsiasi</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1" style={{ color: "var(--fg-muted)" }}>Affidabilità dato</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="rounded-lg px-3 py-2 text-sm"
            style={selectStyle}
          >
            <option value="all">Tutti</option>
            <option value="green">Solo dato affidabile</option>
            <option value="yellow">Solo dato indicativo</option>
          </select>
        </label>

        <div className="text-sm ml-auto self-center" style={{ color: "var(--fg-subtle)" }}>
          {shown.length} spot
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <SpotCard key={s.slug} spot={s} month={month || undefined} />
        ))}
      </div>
    </div>
  );
}
