import type { Metadata } from "next";
import Link from "next/link";
import { getAllSpots, CRITERION } from "@/lib/data";
import { site } from "@/config/site";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Il metodo: come calcoliamo il vento",
  description:
    "Come KiteQuando misura i giorni utili al kitesurf: criterio, dati storici Open-Meteo " +
    "(ERA5), e perché alcuni spot sono 'verdi' (dato affidabile) e altri 'gialli' (dato indicativo).",
  alternates: { canonical: "/metodo" },
};

export default async function MetodoPage() {
  const spots = await getAllSpots();
  const green = spots.filter((s) => s.status === "green").length;
  const yellow = spots.length - green;

  return (
    <article className="max-w-2xl">
      <nav className="text-sm mb-4" style={{ color: "var(--fg-subtle)" }}>
        <Link href="/">Spot</Link> <span aria-hidden>›</span> Il metodo
      </nav>

      <h1 className="text-3xl font-bold tracking-tight mb-3">Come funziona {site.name}</h1>
      <p className="text-lg mb-8" style={{ color: "var(--fg-muted)" }}>
        {site.name} non è una previsione: è uno strumento di <strong>pianificazione</strong>.
        Ti dice, spot per spot e mese per mese, quanto spesso <em>storicamente</em> c&apos;è
        stato vento buono per il kite — così scegli dove e quando andare con dati reali, non
        con il passaparola.
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Cos&apos;è un &quot;giorno utile&quot;</h2>
        <p style={{ color: "var(--fg-muted)" }}>
          Un giorno conta come utile se ha almeno <strong>{CRITERION.hours} ore consecutive</strong>{" "}
          con vento medio <strong>≥ {CRITERION.knots} nodi</strong>, nella fascia diurna{" "}
          <strong>{CRITERION.dayStart}:00–{CRITERION.dayEnd}:00</strong>. La percentuale che vedi
          su ogni spot è la quota di giorni utili in quel mese, mediata su 5 anni.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">I dati</h2>
        <p style={{ color: "var(--fg-muted)" }}>
          Vento a 10 m dall&apos;archivio storico <strong>Open-Meteo</strong> (modello{" "}
          <strong>ERA5-seamless</strong>), periodo <strong>{CRITERION.years}</strong> — circa
          43.800 ore per spot. Nessuna stima a occhio: ogni ora è confrontata con la soglia e
          contata.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Verde e giallo: perché non tutti gli spot sono uguali</h2>
        <p className="mb-4" style={{ color: "var(--fg-muted)" }}>
          Il modello globale coglie bene il vento su <strong>larga scala</strong> (alisei,
          monsoni, meltemi) ma <strong>non</strong> i venti iper-locali. Per questo classifichiamo
          ogni spot:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="font-semibold mb-1" style={{ color: "var(--green)" }}>
              🟢 Dato affidabile ({green} spot)
            </div>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Costa aperta, vento su larga scala. Il dato gratuito rappresenta bene la
              realtà. Es. Dakhla, Cabo de la Vela, Fuerteventura, Capo Verde.
            </p>
          </div>
          <div className="card p-4">
            <div className="font-semibold mb-1" style={{ color: "var(--yellow)" }}>
              🟡 Dato indicativo ({yellow} spot)
            </div>
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Vento incanalato, venturi tra isole o termico locale: il modello sottostima il
              vento reale. Es. Tarifa, La Ventana, Cape Town, El Médano. Il valore è di
              orientamento e va corretto con dati locali.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Onestà sui limiti</h2>
        <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--fg-muted)" }}>
          <li>È una <strong>media storica</strong>, non dice se ci sarà vento domani.</li>
          <li>La griglia del modello è grossolana (~10 km): per i gialli il numero è indicativo.</li>
          <li>La soglia 12 nodi è pensata per un rider medio; con attrezzatura leggera si naviga anche con meno.</li>
        </ul>
      </section>

      <Link href="/" className="inline-block card px-4 py-2 text-sm">
        ← Esplora gli spot
      </Link>
    </article>
  );
}
