"use client";

import { useState } from "react";
import { MONTHS_SHORT, type MonthStat } from "@/lib/data";

function topRoundedBar(x: number, top: number, w: number, baseline: number, r: number) {
  const rr = Math.min(r, w / 2, baseline - top);
  return [
    `M ${x} ${baseline}`,
    `L ${x} ${top + rr}`,
    `Q ${x} ${top} ${x + rr} ${top}`,
    `L ${x + w - rr} ${top}`,
    `Q ${x + w} ${top} ${x + w} ${top + rr}`,
    `L ${x + w} ${baseline}`,
    "Z",
  ].join(" ");
}

export function WindChart({
  monthly,
  stats,
  muted = false,
}: {
  monthly: (number | null)[];
  stats: Record<number, MonthStat>;
  muted?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  const W = 360, H = 200;
  const padL = 26, padR = 6, padT = 10, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseline = padT + plotH;
  const gap = 5;
  const bw = (plotW - gap * 11) / 12;
  const x = (i: number) => padL + i * (bw + gap);
  const yFor = (v: number) => padT + plotH * (1 - v / 100);

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Percentuale di giorni utili per mese"
          onMouseLeave={() => setActive(null)}
        >
          {/* griglia */}
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line
                x1={padL} x2={W - padR} y1={yFor(g)} y2={yFor(g)}
                stroke="var(--border)" strokeWidth={1}
              />
              <text
                x={padL - 6} y={yFor(g) + 3} textAnchor="end"
                fontSize={9} fill="var(--fg-subtle)"
              >
                {g}
              </text>
            </g>
          ))}

          {/* barre */}
          {monthly.map((v, i) => {
            const val = v ?? 0;
            const top = v == null ? baseline : yFor(val);
            const isActive = active === i;
            return (
              <path
                key={i}
                d={topRoundedBar(x(i), Math.min(top, baseline - 0.5), bw, baseline, 4)}
                fill={muted ? "var(--bar-soft)" : "var(--bar)"}
                opacity={active == null || isActive ? 1 : 0.55}
              />
            );
          })}

          {/* etichette mesi */}
          {MONTHS_SHORT.map((m, i) => (
            <text
              key={m} x={x(i) + bw / 2} y={H - 7} textAnchor="middle"
              fontSize={8.5} fill="var(--fg-subtle)"
            >
              {m}
            </text>
          ))}

          {/* hit targets */}
          {monthly.map((_, i) => (
            <rect
              key={i} x={x(i) - gap / 2} y={padT} width={bw + gap} height={plotH}
              fill="transparent" onMouseEnter={() => setActive(i)}
            />
          ))}
        </svg>

        {active != null && (
          <div
            className="absolute pointer-events-none card px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${((x(active) + bw / 2) / W) * 100}%`,
              top: 0,
              transform: "translate(-50%, -4px)",
              whiteSpace: "nowrap",
            }}
          >
            <div className="font-semibold">{MONTHS_SHORT[active]}</div>
            <div style={{ color: "var(--fg-muted)" }}>
              {monthly[active] == null ? "n/d" : `${Math.round(monthly[active]!)}% giorni utili`}
            </div>
            {stats[active + 1] && (
              <div style={{ color: "var(--fg-subtle)" }}>
                {stats[active + 1].kiteable_days}/{stats[active + 1].total_days} giorni
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vista tabellare accessibile (sr-only) */}
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr><th>Mese</th><th>% giorni utili</th></tr>
          </thead>
          <tbody>
            {monthly.map((v, i) => (
              <tr key={i}>
                <td>{MONTHS_SHORT[i]}</td>
                <td>{v == null ? "n/d" : `${Math.round(v)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
