import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import readline from "node:readline";

const parseCsvLine = (line) => {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  fields.push(value);
  return fields;
};

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const csvPath = args.get("--csv");
const selectionPath = args.get("--selection");
if (!csvPath || !selectionPath) {
  throw new Error("Usage: node scripts/verify-pdmx-selection.mjs --csv <PDMX.csv> --selection <pdmx.json>");
}

const selection = JSON.parse(await readFile(selectionPath, "utf8"));
const wanted = new Map(selection.map((entry) => [entry.archivePath, entry]));
const found = new Set();
const input = createReadStream(csvPath, { encoding: "utf8" });
const lines = readline.createInterface({ input, crlfDelay: Infinity });
let headers;
for await (const line of lines) {
  if (!headers) {
    headers = parseCsvLine(line);
    continue;
  }
  if (!line.startsWith("./data/")) continue;
  const fields = parseCsvLine(line);
  const row = Object.fromEntries(headers.map((header, index) => [header, fields[index]]));
  const selected = wanted.get(row.mxl);
  if (!selected) continue;
  const expectedLicense = selected.licenseKind === "CC0-1.0" ? "cc-zero" : "publicdomain";
  const requirements = {
    "subset:no_license_conflict": "True",
    "subset:all_valid": "True",
    "subset:deduplicated": "True",
    has_paywall: "False",
    is_official: "False",
    license: expectedLicense,
  };
  for (const [field, expected] of Object.entries(requirements)) {
    if (row[field] !== expected) {
      throw new Error(`${selected.id}: expected ${field}=${expected}, found ${row[field]}`);
    }
  }
  if (!row.metadata.endsWith(`/${selected.recordId}.json`)) {
    throw new Error(`${selected.id}: recordId does not match PDMX metadata path`);
  }
  found.add(row.mxl);
}

const missing = [...wanted.keys()].filter((value) => !found.has(value));
if (missing.length) throw new Error(`PDMX selection contains ${missing.length} missing records`);
console.log(`PDMX selection OK: ${found.size} approved records meet all required flags.`);
