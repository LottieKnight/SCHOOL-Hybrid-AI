import fs from "node:fs";
import { insertSchools } from "../db/schools.js";

type Args = {
  file?: string;
  country?: string;
  limit?: number;
};

const parseArgs = (argv: string[]): Args => {
  const args: Args = {};
  for (const arg of argv) {
    if (arg.startsWith("--file=")) args.file = arg.slice("--file=".length).trim();
    if (arg.startsWith("--country=")) args.country = arg.slice("--country=".length).trim();
    if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length));
  }
  return args;
};

const parseCsvLine = (line: string) => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error(
      "Usage: tsx src/scripts/import-schools-csv.ts --file=schools.csv [--country=\"South Africa\"] [--limit=1000]"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(args.file, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    console.error("CSV file appears to be empty.");
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const getIndex = (name: string) => headers.indexOf(name);

  const nameIndex = getIndex("name");
  const countryIndex = getIndex("country");
  const provinceIndex = getIndex("province");
  const cityIndex = getIndex("city");
  const latIndex = getIndex("latitude");
  const lonIndex = getIndex("longitude");

  if (nameIndex === -1) {
    console.error("CSV must include a 'name' column.");
    process.exit(1);
  }

  const schools = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const name = values[nameIndex]?.trim();
    if (!name) return null;
    const country = values[countryIndex] || args.country || "Unknown";
    const province = provinceIndex !== -1 ? values[provinceIndex] || null : null;
    const city = cityIndex !== -1 ? values[cityIndex] || null : null;
    const latitude = latIndex !== -1 ? Number(values[latIndex]) || null : null;
    const longitude = lonIndex !== -1 ? Number(values[lonIndex]) || null : null;
    return { name, country, province, city, latitude, longitude };
  });

  const filtered = schools.filter(Boolean) as Array<{
    name: string;
    country: string;
    province?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>;

  const limited = args.limit ? filtered.slice(0, args.limit) : filtered;
  const inserted = await insertSchools(limited);
  console.log(`Imported ${inserted} of ${limited.length} schools from CSV.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
