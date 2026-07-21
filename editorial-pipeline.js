// editorial-pipeline.js
// Automatizza due passaggi della pipeline editoriale: Ricercatore e Fact Checker.
//
// Flusso:
//   1. Prende un argomento (stringa) dalla riga di comando.
//   2. Chiama l'API di Claude con il prompt del RICERCATORE -> raccoglie informazioni.
//   3. Passa l'output del Ricercatore al prompt del FACT CHECKER, che verifica ogni
//      affermazione con gli stati: verificato | non_verificato | falso | richiede_fonte,
//      chiedendo fonti veterinarie/scientifiche per le affermazioni di salute.
//   4. Salva i due output in file separati (Ricercatore .md, Fact Checker .json).
//
// Uso:
//   ANTHROPIC_API_KEY=sk-ant-... node editorial-pipeline.js "alimentazione gatti sterilizzati"
//
// Nessuna dipendenza esterna: usa il fetch nativo di Node 18+.

const fs = require("fs");
const path = require("path");

// --- Configurazione -------------------------------------------------------

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
// Modello di default; sovrascrivibile con la variabile d'ambiente CLAUDE_MODEL.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const OUTPUT_DIR = path.join(__dirname, "output");

// --- Prompt dei due agenti ------------------------------------------------

const RICERCATORE_SYSTEM = `Sei il RICERCATORE di una redazione editoriale specializzata in contenuti su animali domestici e temi correlati.

Il tuo compito: dato un argomento, raccogliere e organizzare le informazioni piu' rilevanti che serviranno a scrivere un articolo affidabile.

Linee guida:
- Scrivi in italiano, in Markdown leggibile.
- Struttura l'output con sezioni chiare (es. Panoramica, Punti chiave, Aspetti di salute, Errori comuni, Domande frequenti).
- Per ogni affermazione importante, sii esplicito e verificabile: preferisci frasi puntuali e distinte piuttosto che paragrafi vaghi. Il tuo output verra' controllato affermazione per affermazione da un Fact Checker.
- Segnala chiaramente quando un'informazione riguarda la SALUTE (alimentazione, patologie, dosaggi, comportamenti a rischio): sono le affermazioni che richiederanno fonti veterinarie/scientifiche.
- Non inventare dati numerici precisi (percentuali, grammi, calorie) se non sei ragionevolmente certo: se citi un valore, indicalo come indicativo e da verificare.
- Non aggiungere fonti inventate. Se pensi che una fonte serva, dillo esplicitamente ("da verificare con fonte veterinaria") senza fabbricare riferimenti.`;

const FACT_CHECKER_SYSTEM = `Sei il FACT CHECKER di una redazione editoriale.

Ricevi l'output del Ricercatore su un argomento. Il tuo compito: estrarre ogni affermazione verificabile e assegnarle uno stato.

Stati ammessi (usa esattamente queste stringhe):
- "verificato": affermazione ampiamente accettata e corretta secondo il consenso scientifico/veterinario.
- "non_verificato": plausibile ma non puoi confermarla con certezza; serve controllo.
- "falso": affermazione errata o contraria al consenso.
- "richiede_fonte": affermazione che, per essere pubblicata, DEVE essere accompagnata da una fonte autorevole (soprattutto se riguarda la salute).

Regole importanti:
- Ogni affermazione che riguarda la SALUTE (alimentazione, patologie, dosaggi, farmaci, comportamenti a rischio) va trattata con rigore: se non e' un dato di consenso solido, assegna "richiede_fonte" e, in "fonti_suggerite", indica il TIPO di fonte necessaria (es. "linee guida veterinarie", "studio scientifico peer-reviewed", "parere di un medico veterinario"). Non inventare titoli, autori o URL di fonti specifiche.
- Metti "categoria_salute": true per le affermazioni di salute, false altrimenti.
- In "note" spiega brevemente il motivo dello stato assegnato.
- Sii conservativo: nel dubbio su un tema di salute, preferisci "richiede_fonte" a "verificato".
- Rispondi SOLO con l'oggetto JSON richiesto dallo schema, senza testo aggiuntivo.`;

// Schema JSON per l'output strutturato del Fact Checker.
const FACT_CHECKER_SCHEMA = {
  type: "object",
  properties: {
    affermazioni: {
      type: "array",
      items: {
        type: "object",
        properties: {
          affermazione: { type: "string" },
          stato: {
            type: "string",
            enum: ["verificato", "non_verificato", "falso", "richiede_fonte"],
          },
          categoria_salute: { type: "boolean" },
          note: { type: "string" },
          fonti_suggerite: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "affermazione",
          "stato",
          "categoria_salute",
          "note",
          "fonti_suggerite",
        ],
        additionalProperties: false,
      },
    },
    riepilogo: { type: "string" },
  },
  required: ["affermazioni", "riepilogo"],
  additionalProperties: false,
};

// --- Chiamata all'API -----------------------------------------------------

// Esegue una richiesta a /v1/messages e restituisce il testo concatenato dei
// blocchi di tipo "text" (ignorando gli eventuali blocchi di thinking).
async function callClaude({ apiKey, system, userText, jsonSchema }) {
  const outputConfig = { effort: "high" };
  if (jsonSchema) {
    outputConfig.format = { type: "json_schema", schema: jsonSchema };
  }

  const body = {
    model: MODEL,
    max_tokens: 8000,
    system,
    thinking: { type: "adaptive" }, // il modello decide quanto ragionare
    output_config: outputConfig,
    messages: [{ role: "user", content: userText }],
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore API (${res.status}): ${errText}`);
  }

  const data = await res.json();

  if (data.stop_reason === "refusal") {
    throw new Error(
      "Il modello ha rifiutato la richiesta (stop_reason: refusal). " +
        "Rivedi l'argomento o riprova."
    );
  }

  // Concatena solo i blocchi di testo (i blocchi thinking hanno type !== "text").
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!text.trim()) {
    throw new Error("Risposta vuota dal modello.");
  }
  return text;
}

// --- Utility --------------------------------------------------------------

// Crea uno slug sicuro per il nome file a partire dall'argomento.
function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // rimuove accenti (segni combinanti)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "argomento";
}

// --- Main -----------------------------------------------------------------

async function main() {
  const argomento = process.argv.slice(2).join(" ").trim();
  if (!argomento) {
    console.error('Uso: node editorial-pipeline.js "<argomento>"');
    console.error('Esempio: node editorial-pipeline.js "alimentazione gatti sterilizzati"');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Errore: variabile d'ambiente ANTHROPIC_API_KEY non impostata.");
    console.error('Esempio: ANTHROPIC_API_KEY=sk-ant-... node editorial-pipeline.js "..."');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const slug = slugify(argomento);
  const ricercatoreFile = path.join(OUTPUT_DIR, `${slug}-ricercatore.md`);
  const factCheckerFile = path.join(OUTPUT_DIR, `${slug}-factchecker.json`);

  // --- Fase 1: Ricercatore ---
  console.log(`[1/2] Ricercatore in corso su: "${argomento}" ...`);
  const ricercatoreOutput = await callClaude({
    apiKey,
    system: RICERCATORE_SYSTEM,
    userText: `Argomento da approfondire: "${argomento}".\n\nRaccogli e organizza le informazioni utili per un articolo affidabile.`,
  });
  fs.writeFileSync(ricercatoreFile, ricercatoreOutput, "utf8");
  console.log(`      Salvato: ${path.relative(__dirname, ricercatoreFile)}`);

  // --- Fase 2: Fact Checker (usa l'output del Ricercatore come input) ---
  console.log("[2/2] Fact Checker in corso ...");
  const factCheckerRaw = await callClaude({
    apiKey,
    system: FACT_CHECKER_SYSTEM,
    userText:
      `Argomento: "${argomento}".\n\n` +
      `Di seguito l'output del Ricercatore da verificare, affermazione per affermazione:\n\n` +
      `---\n${ricercatoreOutput}\n---`,
    jsonSchema: FACT_CHECKER_SCHEMA,
  });

  // L'output strutturato e' gia' JSON valido: lo re-indentiamo per leggibilita'.
  let factCheckerPretty;
  try {
    factCheckerPretty = JSON.stringify(JSON.parse(factCheckerRaw), null, 2);
  } catch (e) {
    // Fallback difensivo: se per qualche motivo non fosse JSON, salviamo il grezzo.
    factCheckerPretty = factCheckerRaw;
  }
  fs.writeFileSync(factCheckerFile, factCheckerPretty, "utf8");
  console.log(`      Salvato: ${path.relative(__dirname, factCheckerFile)}`);

  console.log("\nFatto. Puoi rileggere cosa e' successo in ciascuna fase nei due file.");
}

main().catch((err) => {
  console.error("\nErrore:", err.message);
  process.exit(1);
});
