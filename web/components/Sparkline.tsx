// Mini istogramma 12 mesi per le card. Nessuna interazione (è un'anteprima).
export function Sparkline({ monthly, highlight }: { monthly: (number | null)[]; highlight?: number }) {
  const W = 168, H = 34, n = 12, gap = 3;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Andamento mensile del vento">
      {monthly.map((v, i) => {
        const val = v ?? 0;
        const h = Math.max(1, (val / 100) * H);
        const isHi = highlight === i + 1;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            rx={1.5}
            fill={isHi ? "var(--bar)" : "var(--bar-soft)"}
          />
        );
      })}
    </svg>
  );
}
