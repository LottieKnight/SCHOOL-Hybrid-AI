import { insertSchools } from "../db/schools.js";

type Args = {
  iso?: string;
  country?: string;
  limit?: number;
};

const OVERPASS_URL =
  process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";

const parseArgs = (argv: string[]): Args => {
  const args: Args = {};
  for (const arg of argv) {
    if (arg.startsWith("--iso=")) args.iso = arg.slice("--iso=".length).trim();
    if (arg.startsWith("--country=")) args.country = arg.slice("--country=".length).trim();
    if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length));
  }
  return args;
};

const pickTag = (tags: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const value = tags[key];
    if (value) return value;
  }
  return null;
};

const buildQuery = (iso: string) => `
[out:json][timeout:180];
area["ISO3166-1"="${iso}"]->.searchArea;
(
  node["amenity"="school"](area.searchArea);
  way["amenity"="school"](area.searchArea);
  relation["amenity"="school"](area.searchArea);
);
out center tags;
`;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const iso = args.iso?.toUpperCase();
  const country = args.country?.trim() || iso;

  if (!iso || !country) {
    console.error(
      "Usage: tsx src/scripts/import-osm-schools.ts --iso=ZA --country=\"South Africa\" [--limit=500]"
    );
    process.exit(1);
  }

  const query = buildQuery(iso);
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    elements: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const schools = data.elements
    .map((element) => {
      const tags = element.tags || {};
      const name = tags.name || tags["name:en"];
      if (!name) return null;
      const latitude = element.lat ?? element.center?.lat ?? null;
      const longitude = element.lon ?? element.center?.lon ?? null;
      const province = pickTag(tags, [
        "addr:state",
        "addr:province",
        "state",
        "province",
        "is_in:state",
      ]);
      const city = pickTag(tags, ["addr:city", "city", "is_in:city"]);

      return {
        name,
        country,
        province,
        city,
        latitude,
        longitude,
      };
    })
    .filter(Boolean) as Array<{
    name: string;
    country: string;
    province?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>;

  const limited = args.limit ? schools.slice(0, args.limit) : schools;
  const inserted = await insertSchools(limited);
  console.log(
    `Imported ${inserted} of ${limited.length} schools from OSM for ${country} (${iso}).`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
