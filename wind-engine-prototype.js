// wind-engine-prototype.js
// Prototipo motore statistiche vento - Open-Meteo Historical Archive API
// Uso: node wind-engine-prototype.js [opzioni]
// Richiede Node 18+ (fetch nativo) e connessione internet verso archive-api.open-meteo.com
//
// Metodologia "giorno kiteable" (soglia ispirata a bstoked, personalizzabile):
// almeno N ore consecutive diurne con vento medio >= soglia in nodi.
//
// Le soglie sono configurabili da riga di comando, es:
//   node wind-engine-prototype.js --knots 15 --hours 4 --day-start 10 --day-end 18
//   node wind-engine-prototype.js --start 2019-01-01 --end 2023-12-31
// Usa --help per l'elenco completo delle opzioni.
//
// Modalita' offline (senza rete): usa un fixture JSON al posto delle API.
//   node generate-fixture.js               # genera wind-fixture.json
//   node wind-engine-prototype.js --offline
//   node wind-engine-prototype.js --offline --fixture ./altro-fixture.json

const fs = require("fs");

// tz: fuso IANA dello spot, cosi' Open-Meteo restituisce gli orari in ora
// locale e il filtro della finestra diurna (dayStart/dayEnd) e' corretto.
// Se omesso si usa "auto" (Open-Meteo lo deduce dalle coordinate).
const SPOTS = [
  { name: "Tarifa (Spagna)", lat: 36.067779, lon: -5.686508, tz: "Europe/Madrid" },
  { name: "Dakhla (Marocco)", lat: 23.7185, lon: -15.9370, tz: "Africa/El_Aaiun" },
  { name: "Lo Stagnone - Marsala (Sicilia)", lat: 37.877452, lon: 12.478322, tz: "Europe/Rome" },
  { name: "Essaouira (Marocco)", lat: 31.5085, lon: -9.7595, tz: "Africa/Casablanca" },
  { name: "Corralejo - Fuerteventura (Spagna)", lat: 28.7378, lon: -13.8671, tz: "Atlantic/Canary" },
  { name: "Paje - Zanzibar (Tanzania)", lat: -6.2703, lon: 39.5314, tz: "Africa/Dar_es_Salaam" },
  // Aggiungi altri spot qui: { name: "...", lat: ..., lon: ..., tz: "..." }
];

// Valori predefiniti (sovrascrivibili da CLI).
const DEFAULTS = {
  knots: 12,       // soglia vento minimo utile (nodi)
  hours: 3,        // ore consecutive minime
  dayStart: 9,     // finestra diurna: inizio
  dayEnd: 19,      // finestra diurna: fine
  start: "2021-01-01",
  end: "2025-12-31", // 5 anni di storico
  offline: false,
  fixture: "wind-fixture.json",
  model: "",   // modello Open-Meteo (es. era5_land); vuoto = default API
  only: "",    // filtro spot: sottostringhe separate da virgola
};

const OPTIONS = [
  { flags: ["--knots", "-k"], key: "knots", type: "int", help: "soglia vento minimo utile in nodi" },
  { flags: ["--hours", "-h"], key: "hours", type: "int", help: "ore consecutive minime sopra soglia" },
  { flags: ["--day-start"], key: "dayStart", type: "int", help: "ora inizio finestra diurna (0-23)" },
  { flags: ["--day-end"], key: "dayEnd", type: "int", help: "ora fine finestra diurna (0-23)" },
  { flags: ["--start"], key: "start", type: "date", help: "data inizio storico (YYYY-MM-DD)" },
  { flags: ["--end"], key: "end", type: "date", help: "data fine storico (YYYY-MM-DD)" },
  { flags: ["--model"], key: "model", type: "path", help: "modello Open-Meteo (es. era5_land)" },
  { flags: ["--only"], key: "only", type: "path", help: "esegui solo gli spot che contengono queste sottostringhe (virgola)" },
  { flags: ["--offline"], key: "offline", type: "bool", help: "usa il fixture JSON invece delle API" },
  { flags: ["--fixture"], key: "fixture", type: "path", help: "percorso del fixture JSON (con --offline)" },
];

const MONTH_NAMES = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

function printHelp() {
  console.log("Uso: node wind-engine-prototype.js [opzioni]\n");
  console.log("Opzioni:");
  const argHint = { int: " <n>", date: " <YYYY-MM-DD>", path: " <file>", bool: "" };
  for (const opt of OPTIONS) {
    const label = opt.flags.join(", ") + (argHint[opt.type] || "");
    console.log(`  ${label.padEnd(28)} ${opt.help} (default: ${DEFAULTS[opt.key]})`);
  }
  console.log(`  ${"--help".padEnd(28)} mostra questo messaggio`);
}

function parseArgs(argv) {
  const config = { ...DEFAULTS };
  const byFlag = {};
  for (const opt of OPTIONS) for (const f of opt.flags) byFlag[f] = opt;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help") { printHelp(); process.exit(0); }

    // Supporta sia "--flag valore" che "--flag=valore".
    let flag = arg, inlineValue;
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq !== -1) {
      flag = arg.slice(0, eq);
      inlineValue = arg.slice(eq + 1);
    }

    const opt = byFlag[flag];
    if (!opt) throw new Error(`Opzione sconosciuta: ${arg} (usa --help)`);

    // Le opzioni booleane non consumano un valore (a meno di --flag=true/false).
    if (opt.type === "bool") {
      if (inlineValue === undefined) { config[opt.key] = true; continue; }
      if (inlineValue !== "true" && inlineValue !== "false")
        throw new Error(`Valore booleano non valido per ${flag}: ${inlineValue} (usa true/false)`);
      config[opt.key] = inlineValue === "true";
      continue;
    }

    const raw = inlineValue !== undefined ? inlineValue : argv[++i];
    if (raw === undefined) throw new Error(`Valore mancante per ${flag}`);

    if (opt.type === "int") {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error(`Valore non intero per ${flag}: ${raw}`);
      config[opt.key] = n;
    } else if (opt.type === "path") {
      config[opt.key] = raw;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`Data non valida per ${flag}: ${raw} (formato YYYY-MM-DD)`);
      config[opt.key] = raw;
    }
  }

  if (config.dayStart < 0 || config.dayStart > 23 || config.dayEnd < 0 || config.dayEnd > 23)
    throw new Error("Le ore della finestra diurna devono essere tra 0 e 23");
  if (config.dayStart > config.dayEnd)
    throw new Error("--day-start non puo' essere maggiore di --day-end");
  if (config.hours < 1) throw new Error("--hours deve essere >= 1");
  if (config.start > config.end) throw new Error("--start non puo' essere successivo a --end");

  return config;
}

async function fetchHistoricalWind(lat, lon, startDate, endDate, tz, model) {
  const timezone = tz && tz.trim() ? tz : "auto";
  let url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&hourly=wind_speed_10m&wind_speed_unit=kn&timezone=${encodeURIComponent(timezone)}`;
  if (model && model.trim()) url += `&models=${encodeURIComponent(model.trim())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${await res.text()}`);
  return res.json();
}

function loadFixture(path) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`Impossibile leggere il fixture "${path}": ${err.message}. Genera con: node generate-fixture.js`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Fixture "${path}" non e' JSON valido: ${err.message}`);
  }
  if (!json.spots || typeof json.spots !== "object")
    throw new Error(`Fixture "${path}" privo del campo "spots"`);
  return json;
}

function getFixtureWind(fixture, spot) {
  const data = fixture.spots[spot.name];
  if (!data || !data.hourly || !Array.isArray(data.hourly.time))
    throw new Error(`Nessun dato nel fixture per "${spot.name}"`);
  return data;
}

function computeMonthlyStats(data, config) {
  const times = data.hourly.time;
  const winds = data.hourly.wind_speed_10m;
  const dayMap = {};

  times.forEach((t, i) => {
    const [datePart, timePart] = t.split("T");
    const hour = parseInt(timePart.split(":")[0], 10);
    if (hour < config.dayStart || hour > config.dayEnd) return;
    if (!dayMap[datePart]) dayMap[datePart] = [];
    dayMap[datePart].push(winds[i]);
  });

  const monthlyTotals = {};

  Object.entries(dayMap).forEach(([date, hourlyWinds]) => {
    const month = date.split("-")[1];
    if (!monthlyTotals[month]) monthlyTotals[month] = { kiteableDays: 0, totalDays: 0 };
    monthlyTotals[month].totalDays += 1;

    let maxStreak = 0, streak = 0;
    hourlyWinds.forEach((w) => {
      if (w >= config.knots) { streak += 1; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    });
    if (maxStreak >= config.hours) monthlyTotals[month].kiteableDays += 1;
  });

  return monthlyTotals;
}

async function main() {
  let config;
  try {
    config = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Errore argomenti: ${err.message}`);
    process.exit(1);
  }

  const modelLabel = config.model && config.model.trim() ? config.model.trim() : "default";
  const source = config.offline
    ? `fixture ${config.fixture}`
    : `storico ${config.start} -> ${config.end} | modello ${modelLabel}`;
  console.log(
    `Criterio: >= ${config.hours}h consecutive con vento >= ${config.knots}kn ` +
    `nella finestra ${config.dayStart}:00-${config.dayEnd}:00 | ${source}`
  );

  let fixture;
  if (config.offline) {
    try {
      fixture = loadFixture(config.fixture);
    } catch (err) {
      console.error(`Errore fixture: ${err.message}`);
      process.exit(1);
    }
  }

  // Filtro opzionale --only: sottostringhe (case-insensitive) separate da virgola.
  const filters = config.only.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const spots = filters.length
    ? SPOTS.filter((s) => filters.some((f) => s.name.toLowerCase().includes(f)))
    : SPOTS;
  if (filters.length && spots.length === 0) {
    console.error(`Nessuno spot corrisponde a --only "${config.only}"`);
    process.exit(1);
  }

  for (const spot of spots) {
    console.log(`\n=== ${spot.name} (lat ${spot.lat}, lon ${spot.lon}) ===`);
    try {
      const data = config.offline
        ? getFixtureWind(fixture, spot)
        : await fetchHistoricalWind(spot.lat, spot.lon, config.start, config.end, spot.tz, config.model);
      const stats = computeMonthlyStats(data, config);
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const s = stats[mm];
        if (!s) continue;
        const pct = ((s.kiteableDays / s.totalDays) * 100).toFixed(0);
        console.log(`${MONTH_NAMES[m - 1]}: ${pct}% giorni utili (${s.kiteableDays}/${s.totalDays})`);
      }
    } catch (err) {
      console.error(`Errore per ${spot.name}:`, err.message);
    }
  }
}

main();
