// generate-fixture.js
// Genera un fixture JSON con dati di vento orari sintetici ma realistici,
// usato dalla modalita' offline di wind-engine-prototype.js (--offline).
// Uso: node generate-fixture.js [file-output]   (default: wind-fixture.json)
//
// I dati NON sono reali: sono generati in modo deterministico (seed fisso)
// con pattern stagionali e diurni plausibili, cosi' l'output della modalita'
// offline e' stabile e riproducibile senza rete.

const fs = require("fs");

// Deve combaciare (per nome) con SPOTS in wind-engine-prototype.js.
// baseKn = vento medio di base; seasonalKn = ampiezza stagionale;
// thermalKn = spinta termica pomeridiana; noiseKn = rumore.
const SPOTS = [
  { name: "Tarifa (Spagna)",                 baseKn: 14, seasonalKn: 3, thermalKn: 4, noiseKn: 6 },
  { name: "Dakhla (Marocco)",                baseKn: 17, seasonalKn: 2, thermalKn: 5, noiseKn: 5 },
  { name: "Lo Stagnone - Marsala (Sicilia)", baseKn: 9,  seasonalKn: 4, thermalKn: 6, noiseKn: 6 },
];

const YEAR = 2021; // un anno di storico sintetico

// PRNG deterministico (mulberry32) per riproducibilita'.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n) { return String(n).padStart(2, "0"); }

function generateSpot(spot) {
  const time = [];
  const wind = [];
  // Seed derivato dal nome per avere serie diverse ma stabili per spot.
  let nameSeed = 0;
  for (const ch of spot.name) nameSeed = (nameSeed * 31 + ch.charCodeAt(0)) | 0;
  const rand = mulberry32(nameSeed);

  const start = Date.UTC(YEAR, 0, 1, 0, 0, 0);
  const end = Date.UTC(YEAR + 1, 0, 1, 0, 0, 0);
  for (let ts = start; ts < end; ts += 3600 * 1000) {
    const d = new Date(ts);
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const hour = d.getUTCHours();
    const dayOfYear = Math.floor((ts - start) / (86400 * 1000));

    // Componente stagionale: picco d'estate (giorno ~200).
    const seasonal = Math.cos(((dayOfYear - 200) / 365) * 2 * Math.PI) * spot.seasonalKn;
    // Componente termica diurna: picco verso le 15:00, nulla di notte.
    const thermal = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * spot.thermalKn;
    // Rumore centrato su zero.
    const noise = (rand() - 0.5) * 2 * spot.noiseKn;

    const kn = Math.max(0, spot.baseKn + seasonal + thermal + noise);
    time.push(`${YEAR}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:00`);
    wind.push(Math.round(kn * 10) / 10);
  }

  return { hourly: { time, wind_speed_10m: wind } };
}

function main() {
  const outFile = process.argv[2] || "wind-fixture.json";
  const spots = {};
  for (const spot of SPOTS) spots[spot.name] = generateSpot(spot);

  const fixture = {
    _note: "Dati di vento SINTETICI generati da generate-fixture.js. Non reali.",
    generatedAt: new Date().toISOString(),
    year: YEAR,
    spots,
  };

  fs.writeFileSync(outFile, JSON.stringify(fixture));
  const hours = Object.values(spots)[0].hourly.time.length;
  console.log(`Scritto ${outFile}: ${Object.keys(spots).length} spot x ${hours} ore (anno ${YEAR}).`);
}

main();
