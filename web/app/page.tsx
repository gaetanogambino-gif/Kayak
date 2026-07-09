import { getAllSpots } from "@/lib/data";
import { SpotExplorer } from "@/components/SpotExplorer";
import { site } from "@/config/site";

export const revalidate = 86400;

export default async function Home() {
  const spots = await getAllSpots();
  const green = spots.filter((s) => s.status === "green").length;

  return (
    <div>
      <section className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
          Dove e quando andare a <span style={{ color: "var(--accent)" }}>kitesurf</span>
        </h1>
        <p className="mt-3 text-lg max-w-2xl" style={{ color: "var(--fg-muted)" }}>
          {site.tagline} {green} spot di costa aperta con statistiche di vento su 5 anni,
          più le grandi mete iconiche. Scegli il mese e trova dove c&apos;è vento.
        </p>
      </section>

      <SpotExplorer spots={spots} />
    </div>
  );
}
