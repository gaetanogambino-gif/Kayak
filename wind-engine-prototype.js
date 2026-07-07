// wind-engine-prototype.js
// Prototipo motore statistiche vento - Open-Meteo Historical Archive API
// Uso: node wind-engine-prototype.js
// Richiede Node 18+ (fetch nativo) e connessione internet verso archive-api.open-meteo.com
//
// Metodologia "giorno kiteable" (soglia ispirata a bstoked, personalizzabile):
// almeno N ore consecutive diurne con vento medio >= soglia in nodi.

const SPOTS = [
  { name: "Tarifa (Spagna)", lat: 36.0128, lon: -5.6012 },
  { name: "Dakhla (Marocco)", lat: 23.7185, lon: -15.9370 },
  { name: "Lo Stagnone - Marsala (Sicilia)", lat: 37.8656, lon: 12.4390 },
  // Aggiungi altri spot qui: { name: "...", lat: ..., lon: ... }
];

const KNOTS_THRESHOLD = 12;       // soglia vento minimo utile (nodi)
const MIN_CONSECUTIVE_HOURS = 3;  // ore consecutive minime
const DAY_START_HOUR = 9;         // finestra diurna: inizio
const DAY_END_HOUR = 19;          // finestra diurna: fine

const MONTH_NAMES = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

async function fetchHistoricalWind(lat, lon, startDate, endDate) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=wind_speed_10m&wind_speed_unit=kn`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${await res.text()}`);
  return res.json();
}

function computeMonthlyStats(data) {
  const times = data.hourly.time;
  const winds = data.hourly.wind_speed_10m;
  const dayMap = {};

  times.forEach((t, i) => {
    const [datePart, timePart] = t.split("T");
    const hour = parseInt(timePart.split(":")[0], 10);
    if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) return;
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
      if (w >= KNOTS_THRESHOLD) { streak += 1; maxStreak = Math.max(maxStreak, streak); }
      else streak = 0;
    });
    if (maxStreak >= MIN_CONSECUTIVE_HOURS) monthlyTotals[month].kiteableDays += 1;
  });

  return monthlyTotals;
}

async function main() {
  const startDate = "2021-01-01";
  const endDate = "2025-12-31"; // 5 anni di storico

  for (const spot of SPOTS) {
    console.log(`\n=== ${spot.name} ===`);
    try {
      const data = await fetchHistoricalWind(spot.lat, spot.lon, startDate, endDate);
      const stats = computeMonthlyStats(data);
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
