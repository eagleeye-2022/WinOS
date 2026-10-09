// One-off exporter: copies country / state / city data and country flag SVGs into
// scripts/data/locations/ so the app reads its own files and needs no location libraries at
// runtime. Writes FILES ONLY — it never touches the database.
//
// To re-run (e.g. to refresh the data), temporarily install the two source packages:
//   npm install --no-save countries-states-cities-service@1.5.1 country-flag-icons@1.6.20
//   node scripts/export-location-data.mjs

import { mkdirSync, writeFileSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Countries, States, Cities } = require("countries-states-cities-service");

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(root, "data", "locations");
const flagsOut = path.join(outDir, "flags");
mkdirSync(flagsOut, { recursive: true });

const byName = (a, b) => a.name.localeCompare(b.name);

// countries.json — [{ code, name }] sorted by name (ISO 3166-1 alpha-2 codes)
const countries = Countries.getCountries()
  .map((c) => ({ code: c.iso2, name: c.name }))
  .filter((c) => /^[A-Z]{2}$/.test(c.code))
  .sort(byName);

// states.json — { [countryCode]: [{ code, name }] }
const states = {};
for (const s of States.getStates()) {
  if (!s.country_code || !s.state_code) continue;
  (states[s.country_code] ||= []).push({ code: s.state_code, name: s.name });
}
for (const list of Object.values(states)) list.sort(byName);

// cities.json — { [countryCode]: { [stateCode]: [cityName] } } (names only, de-duplicated)
const cities = {};
for (const c of Cities.getCities()) {
  if (!c.country_code || !c.state_code || !c.name) continue;
  ((cities[c.country_code] ||= {})[c.state_code] ||= new Set()).add(c.name);
}
const citiesOut = {};
let cityCount = 0;
for (const [cc, byState] of Object.entries(cities)) {
  citiesOut[cc] = {};
  for (const [sc, set] of Object.entries(byState)) {
    citiesOut[cc][sc] = Array.from(set).sort((a, b) => a.localeCompare(b));
    cityCount += set.size;
  }
}

writeFileSync(path.join(outDir, "countries.json"), JSON.stringify(countries));
writeFileSync(path.join(outDir, "states.json"), JSON.stringify(states));
writeFileSync(path.join(outDir, "cities.json"), JSON.stringify(citiesOut));

// flags/XX.svg — 3:2 SVG flags, one file per ISO code
const flagSrc = path.join(path.dirname(require.resolve("country-flag-icons/package.json")), "3x2");
for (const f of readdirSync(flagsOut)) rmSync(path.join(flagsOut, f));
let flagCount = 0;
for (const file of readdirSync(flagSrc)) {
  if (!/^[A-Z]{2}\.svg$/.test(file)) continue;
  copyFileSync(path.join(flagSrc, file), path.join(flagsOut, file));
  flagCount++;
}

console.log(
  `countries: ${countries.length}, states: ${Object.values(states).flat().length}, ` +
    `cities: ${cityCount}, flags: ${flagCount} → ${path.relative(process.cwd(), outDir)}`
);
