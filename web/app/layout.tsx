import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { site } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    siteName: site.name,
    locale: site.locale,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="font-sans min-h-screen flex flex-col">
        <header className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              🪁 {site.name}
            </Link>
            <nav className="flex gap-5 text-sm" style={{ color: "var(--fg-muted)" }}>
              <Link href="/">Spot</Link>
              <Link href="/mese/gennaio">Per mese</Link>
              <Link href="/metodo">Metodo</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-8 flex-1">{children}</main>

        <footer className="border-t mt-8" style={{ borderColor: "var(--border)" }}>
          <div
            className="mx-auto max-w-5xl px-4 py-6 text-sm leading-relaxed"
            style={{ color: "var(--fg-subtle)" }}
          >
            <p>
              Dati: vento a 10 m dall&apos;archivio storico Open-Meteo (modello
              ERA5-seamless), 2021–2025. Un &quot;giorno utile&quot; = almeno 3 ore
              consecutive con vento ≥ 12 nodi nella finestra 9:00–19:00.
            </p>
            <p className="mt-2">
              Gli spot <strong style={{ color: "var(--yellow)" }}>gialli</strong> hanno
              vento locale/incanalato che il modello globale non coglie: per quelli il
              dato è indicativo e va corretto. {site.name} è uno strumento di
              pianificazione, non una previsione.{" "}
              <Link href="/metodo" style={{ color: "var(--accent)" }}>Come funziona →</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
