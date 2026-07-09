import type { SpotStatus } from "@/lib/data";

export function StatusBadge({ status, size = "md" }: { status: SpotStatus; size?: "sm" | "md" }) {
  const green = status === "green";
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad}`}
      style={{
        color: green ? "var(--green)" : "var(--yellow)",
        background: green ? "var(--green-bg)" : "var(--yellow-bg)",
      }}
      title={
        green
          ? "Costa aperta, vento su larga scala: dato affidabile."
          : "Vento locale/incanalato: dato grezzo indicativo, da correggere."
      }
    >
      <span
        aria-hidden
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: green ? "var(--green)" : "var(--yellow)" }}
      />
      {green ? "Dato affidabile" : "Dato indicativo"}
    </span>
  );
}
