// Builds lib/distance/zip-centroids.json from the U.S. Census Bureau ZCTA
// Gazetteer file (public domain). Usage:
//   node scripts/build-zip-centroids.mjs <path to 20XX_Gaz_zcta_national.txt>
// Source: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
// Only the ZIP code and its internal point latitude/longitude are kept.
import { readFileSync, writeFileSync } from "node:fs";

const source = process.argv[2];
if (!source) {
  console.error("Pass the path to the Census ZCTA Gazetteer .txt file.");
  process.exit(1);
}
const [header, ...rows] = readFileSync(source, "utf8").trim().split(/\r?\n/);
const columns = header.split("|").map((name) => name.trim());
const zipColumn = columns.indexOf("GEOID");
const latColumn = columns.indexOf("INTPTLAT");
const lngColumn = columns.indexOf("INTPTLONG");
if ([zipColumn, latColumn, lngColumn].includes(-1)) {
  console.error("Unexpected Gazetteer columns:", columns.join(", "));
  process.exit(1);
}

const centroids = {};
for (const row of rows) {
  const values = row.split("|");
  const zip = values[zipColumn]?.trim();
  const lat = Number(values[latColumn]);
  const lng = Number(values[lngColumn]);
  if (!/^\d{5}$/.test(zip ?? "")) continue;
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) continue;
  if (!Number.isFinite(lng) || Math.abs(lng) > 180) continue;
  // Three decimals is about 110 m, plenty for a ZIP-level estimate.
  centroids[zip] = [Number(lat.toFixed(3)), Number(lng.toFixed(3))];
}

const output = new URL("../lib/distance/zip-centroids.json", import.meta.url);
writeFileSync(output, JSON.stringify(centroids) + "\n");
console.log(`Wrote ${Object.keys(centroids).length} ZIP centroids.`);
