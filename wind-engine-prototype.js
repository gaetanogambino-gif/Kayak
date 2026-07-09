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
// Ogni spot: name (pulito), country, slug (chiave upsert su Supabase), status
// ('green' = dato affidabile su costa aperta / vento sinottico; 'yellow' = vento
// incanalato o termico iper-locale, il dato gratuito va corretto), lat, lon, tz.
const SPOTS = [
  { slug: "tarifa-valdevaqueros", name: "Tarifa - Valdevaqueros", country: "Spagna", status: "yellow", lat: 36.067779, lon: -5.686508, tz: "Europe/Madrid" },
  { slug: "dakhla", name: "Dakhla", country: "Marocco", status: "green", lat: 23.7185, lon: -15.9370, tz: "Africa/El_Aaiun" },
  { slug: "lo-stagnone-marsala", name: "Lo Stagnone - Marsala", country: "Italia", status: "yellow", lat: 37.877452, lon: 12.478322, tz: "Europe/Rome" },
  { slug: "essaouira", name: "Essaouira", country: "Marocco", status: "green", lat: 31.500, lon: -9.770, tz: "Africa/Casablanca" },
  { slug: "corralejo-fuerteventura", name: "Corralejo - Fuerteventura", country: "Spagna", status: "green", lat: 28.7378, lon: -13.8671, tz: "Atlantic/Canary" },
  { slug: "paje-zanzibar", name: "Paje - Zanzibar", country: "Tanzania", status: "yellow", lat: -6.2703, lon: 39.5314, tz: "Africa/Dar_es_Salaam" },
  { slug: "cumbuco", name: "Cumbuco", country: "Brasile", status: "green", lat: -3.6167, lon: -38.7167, tz: "America/Fortaleza" },
  // Jericoacoara: costa aperta, aliseo sinottico; cella marina e cella villaggio
  // danno numeri identici -> confermato verde.
  { slug: "jericoacoara", name: "Jericoacoara", country: "Brasile", status: "green", lat: -2.7975, lon: -40.5137, tz: "America/Fortaleza" },
  { slug: "cabarete", name: "Cabarete", country: "Repubblica Dominicana", status: "green", lat: 19.758, lon: -70.419, tz: "America/Santo_Domingo" },
  // Watamu: coordinata spostata dal lato Mida Creek (riparato) alla spiaggia oceanica (Watamu ward).
  { slug: "watamu", name: "Watamu", country: "Kenya", status: "green", lat: -3.3570, lon: 40.0260, tz: "Africa/Nairobi" },
  { slug: "punta-prosciutto-salento", name: "Punta Prosciutto - Salento", country: "Italia", status: "green", lat: 40.2947, lon: 17.7570, tz: "Europe/Rome" },
  // Espansione spot verdi (costa aperta, vento sinottico/aliseo/monsone/meltemi).
  { slug: "taiba", name: "Taiba", country: "Brasile", status: "green", lat: -3.028, lon: -38.878, tz: "America/Fortaleza" },
  { slug: "santa-maria-sal", name: "Santa Maria - Sal", country: "Capo Verde", status: "green", lat: 16.591, lon: -22.904, tz: "Atlantic/Cape_Verde" },
  { slug: "sal-rei-boa-vista", name: "Sal Rei - Boa Vista", country: "Capo Verde", status: "green", lat: 16.181, lon: -22.918, tz: "Atlantic/Cape_Verde" },
  { slug: "le-morne", name: "Le Morne", country: "Mauritius", status: "green", lat: -20.457, lon: 57.312, tz: "Indian/Mauritius" },
  { slug: "kalpitiya", name: "Kalpitiya", country: "Sri Lanka", status: "green", lat: 8.234, lon: 79.700, tz: "Asia/Colombo" },
  { slug: "mui-ne", name: "Mui Ne", country: "Vietnam", status: "green", lat: 10.933, lon: 108.287, tz: "Asia/Ho_Chi_Minh" },
  { slug: "famara-lanzarote", name: "Famara - Lanzarote", country: "Spagna", status: "green", lat: 29.118, lon: -13.552, tz: "Atlantic/Canary" },
  { slug: "sotavento-fuerteventura", name: "Sotavento - Fuerteventura", country: "Spagna", status: "green", lat: 28.135, lon: -14.230, tz: "Atlantic/Canary" },
  { slug: "afiartis-karpathos", name: "Afiartis - Karpathos", country: "Grecia", status: "green", lat: 35.421, lon: 27.150, tz: "Europe/Athens" },
  // Espansione 2: spot verdi a picco invernale boreale (bilanciamento del calendario).
  { slug: "cabo-de-la-vela", name: "Cabo de la Vela", country: "Colombia", status: "green", lat: 12.190, lon: -72.155, tz: "America/Bogota" },
  { slug: "bonaire-atlantis", name: "Bonaire - Atlantis", country: "Bonaire", status: "green", lat: 12.033, lon: -68.283, tz: "America/Kralendijk" },
  { slug: "aruba-fishermans-huts", name: "Aruba - Fisherman's Huts", country: "Aruba", status: "green", lat: 12.577, lon: -70.045, tz: "America/Aruba" },
  { slug: "geraldton", name: "Geraldton", country: "Australia", status: "green", lat: -28.774, lon: 114.612, tz: "Australia/Perth" },
  { slug: "tobago-pigeon-point", name: "Tobago - Pigeon Point", country: "Trinidad e Tobago", status: "green", lat: 11.165, lon: -60.850, tz: "America/Port_of_Spain" },
  { slug: "boracay-bulabog", name: "Boracay - Bulabog", country: "Filippine", status: "green", lat: 11.968, lon: 121.930, tz: "Asia/Manila" },
  { slug: "lancelin", name: "Lancelin", country: "Australia", status: "green", lat: -31.017, lon: 115.330, tz: "Australia/Perth" },
  { slug: "sao-miguel-do-gostoso", name: "São Miguel do Gostoso", country: "Brasile", status: "green", lat: -5.123, lon: -35.635, tz: "America/Fortaleza" },
  { slug: "los-roques", name: "Los Roques", country: "Venezuela", status: "green", lat: 11.948, lon: -66.752, tz: "America/Caracas" },
  { slug: "diani-beach", name: "Diani Beach", country: "Kenya", status: "green", lat: -4.297, lon: 39.591, tz: "Africa/Nairobi" },
  // Aggiungi altri spot qui: { slug: "...", name: "...", country: "...", status: "green|yellow", lat: ..., lon: ..., tz: "..." }
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
  writeSupabase: false, // fai upsert dei risultati su Supabase (REST + service_role)
  emitSql: false,       // stampa l'SQL di upsert invece di scrivere (per revisione/MCP)
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
  { flags: ["--write-supabase"], key: "writeSupabase", type: "bool", help: "upsert dei risultati su Supabase (env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)" },
  { flags: ["--emit-sql"], key: "emitSql", type: "bool", help: "stampa l'SQL di upsert invece di scrivere sul DB" },
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

// Trasforma i totali mensili nelle righe della tabella wind_monthly_stats.
function buildStatRows(config, monthlyTotals) {
  const model = config.model && config.model.trim() ? config.model.trim() : "default";
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const s = monthlyTotals[String(m).padStart(2, "0")];
    if (!s) continue;
    rows.push({
      month: m,
      pct_kiteable_days: Number(((s.kiteableDays / s.totalDays) * 100).toFixed(1)),
      kiteable_days: s.kiteableDays,
      total_days: s.totalDays,
      model,
      threshold_knots: config.knots,
      min_consecutive_hours: config.hours,
      day_start_hour: config.dayStart,
      day_end_hour: config.dayEnd,
    });
  }
  return rows;
}

// Upsert idempotente via PostgREST. Il service_role bypassa la RLS.
async function upsertRest(baseUrl, key, table, rows, onConflict) {
  if (rows.length === 0) return [];
  const res = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase ${table}: HTTP ${res.status} - ${await res.text()}`);
  return res.json();
}

// Scrive spots + wind_monthly_stats su Supabase. Chiave di upsert: spots.slug
// e wind_monthly_stats(spot_id, month).
async function writeToSupabase(results, config) {
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key)
    throw new Error("Servono le variabili d'ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");

  const spotRows = results.map(({ spot }) => ({
    slug: spot.slug, name: spot.name, country: spot.country,
    status: spot.status, lat: spot.lat, lon: spot.lon,
  }));
  const returned = await upsertRest(baseUrl, key, "spots", spotRows, "slug");
  const idBySlug = {};
  returned.forEach((r) => { idBySlug[r.slug] = r.id; });

  const statRows = [];
  for (const { spot, monthlyTotals } of results) {
    const spotId = idBySlug[spot.slug];
    for (const r of buildStatRows(config, monthlyTotals)) statRows.push({ spot_id: spotId, ...r });
  }
  await upsertRest(baseUrl, key, "wind_monthly_stats", statRows, "spot_id,month");
  console.log(`\nSupabase: upsert di ${spotRows.length} spot e ${statRows.length} righe mensili completato.`);
}

// Genera l'SQL di upsert (per revisione o esecuzione via un altro canale).
function sqlLit(v) {
  return v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;
}
function emitUpsertSql(results, config) {
  const model = config.model && config.model.trim() ? config.model.trim() : "default";
  const out = [];

  // spots: un solo insert multi-riga con upsert su slug
  const spotVals = results.map(({ spot }) =>
    `  (${sqlLit(spot.slug)}, ${sqlLit(spot.name)}, ${sqlLit(spot.country)}, ${sqlLit(spot.status)}, ${spot.lat}, ${spot.lon})`
  ).join(",\n");
  out.push(
    "insert into public.spots (slug, name, country, status, lat, lon) values\n" + spotVals + "\n" +
    "on conflict (slug) do update set name=excluded.name, country=excluded.country, " +
    "status=excluded.status, lat=excluded.lat, lon=excluded.lon;"
  );

  // wind_monthly_stats: CTE (slug, month, pct, k, tot) join spots -> upsert su (spot_id, month)
  const statVals = [];
  for (const { spot, monthlyTotals } of results)
    for (const r of buildStatRows(config, monthlyTotals))
      statVals.push(`  (${sqlLit(spot.slug)}, ${r.month}, ${r.pct_kiteable_days}, ${r.kiteable_days}, ${r.total_days})`);
  out.push(
    "with s(slug, month, pct, k, tot) as (values\n" + statVals.join(",\n") + "\n)\n" +
    "insert into public.wind_monthly_stats (spot_id, month, pct_kiteable_days, kiteable_days, total_days, " +
    "model, threshold_knots, min_consecutive_hours, day_start_hour, day_end_hour)\n" +
    `select sp.id, s.month, s.pct, s.k, s.tot, ${sqlLit(model)}, ${config.knots}, ${config.hours}, ${config.dayStart}, ${config.dayEnd}\n` +
    "from s join public.spots sp on sp.slug = s.slug\n" +
    "on conflict (spot_id, month) do update set pct_kiteable_days=excluded.pct_kiteable_days, " +
    "kiteable_days=excluded.kiteable_days, total_days=excluded.total_days, model=excluded.model, " +
    "threshold_knots=excluded.threshold_knots, min_consecutive_hours=excluded.min_consecutive_hours, " +
    "day_start_hour=excluded.day_start_hour, day_end_hour=excluded.day_end_hour, last_updated=now();"
  );
  return out.join("\n\n");
}

async function main() {
  let config;
  try {
    config = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Errore argomenti: ${err.message}`);
    process.exit(1);
  }

  // In modalita' --emit-sql l'output deve essere solo SQL: i log umani vanno su stderr.
  const quiet = config.emitSql;
  const log = quiet ? (...a) => console.error(...a) : (...a) => console.log(...a);

  const modelLabel = config.model && config.model.trim() ? config.model.trim() : "default";
  const source = config.offline
    ? `fixture ${config.fixture}`
    : `storico ${config.start} -> ${config.end} | modello ${modelLabel}`;
  log(
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

  const results = [];
  for (const spot of spots) {
    log(`\n=== ${spot.name} (lat ${spot.lat}, lon ${spot.lon}) ===`);
    try {
      const data = config.offline
        ? getFixtureWind(fixture, spot)
        : await fetchHistoricalWind(spot.lat, spot.lon, config.start, config.end, spot.tz, config.model);
      const stats = computeMonthlyStats(data, config);
      results.push({ spot, monthlyTotals: stats });
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const s = stats[mm];
        if (!s) continue;
        const pct = ((s.kiteableDays / s.totalDays) * 100).toFixed(0);
        log(`${MONTH_NAMES[m - 1]}: ${pct}% giorni utili (${s.kiteableDays}/${s.totalDays})`);
      }
    } catch (err) {
      console.error(`Errore per ${spot.name}:`, err.message);
    }
  }

  // Scrittura opzionale su Supabase (oppure emissione dell'SQL corrispondente).
  if (config.emitSql) {
    console.log(emitUpsertSql(results, config));
  } else if (config.writeSupabase) {
    try {
      await writeToSupabase(results, config);
    } catch (err) {
      console.error(`Errore Supabase: ${err.message}`);
      process.exit(1);
    }
  }
}

main();
