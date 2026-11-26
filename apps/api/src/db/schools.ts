import { pool } from "./pool.js";

export type SchoolRecord = {
  id: string;
  name: string;
  country: string;
  province: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

export async function searchSchools(filters: {
  query?: string;
  country?: string;
  province?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
}): Promise<SchoolRecord[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (filters.query) {
    clauses.push(`LOWER(name) LIKE $${index}`);
    values.push(`%${filters.query.toLowerCase()}%`);
    index += 1;
  }
  if (filters.country) {
    clauses.push(`LOWER(country) = $${index}`);
    values.push(filters.country.toLowerCase());
    index += 1;
  }
  if (filters.province) {
    clauses.push(`LOWER(province) = $${index}`);
    values.push(filters.province.toLowerCase());
    index += 1;
  }
  if (filters.city) {
    clauses.push(`LOWER(city) = $${index}`);
    values.push(filters.city.toLowerCase());
    index += 1;
  }

  let distanceExpr = "";
  if (filters.lat !== undefined && filters.lng !== undefined) {
    // Basic Haversine approximation in SQL (6371 * acos(...))
    // We use a simpler bounding box or Euclidean if precision isn't critical for sorting
    distanceExpr = `, (6371 * acos(cos(radians($${index})) * cos(radians(latitude)) * cos(radians(longitude) - radians($${index + 1})) + sin(radians($${index})) * sin(radians(latitude)))) AS distance`;
    values.push(filters.lat, filters.lng);
    index += 2;

    if (filters.radiusKm) {
      clauses.push(`(6371 * acos(cos(radians($${index - 2})) * cos(radians(latitude)) * cos(radians(longitude) - radians($${index - 1})) + sin(radians($${index - 2})) * sin(radians(latitude)))) <= $${index}`);
      values.push(filters.radiusKm);
      index += 1;
    }
  }

  const limit = Math.min(filters.limit ?? 15, 25);
  values.push(limit);

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy = distanceExpr ? "ORDER BY distance ASC" : "ORDER BY name ASC";
  
  const result = await pool.query<SchoolRecord>(
    `SELECT id, name, country, province, city, latitude, longitude, created_at ${distanceExpr}
     FROM schools
     ${whereClause}
     ${orderBy}
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

export async function getSchoolById(id: string): Promise<SchoolRecord | null> {
  const result = await pool.query<SchoolRecord>(
    "SELECT id, name, country, province, city, latitude, longitude, created_at FROM schools WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function insertSchools(
  schools: Array<{
    name: string;
    country: string;
    province?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }>
) {
  if (!schools.length) return 0;

  const names = schools.map((school) => school.name);
  const countries = schools.map((school) => school.country);
  const provinces = schools.map((school) => school.province ?? null);
  const cities = schools.map((school) => school.city ?? null);
  const latitudes = schools.map((school) => school.latitude ?? null);
  const longitudes = schools.map((school) => school.longitude ?? null);

  const result = await pool.query(
    `INSERT INTO schools (name, country, province, city, latitude, longitude)
     SELECT * FROM UNNEST(
       $1::text[],
       $2::text[],
       $3::text[],
       $4::text[],
       $5::float8[],
       $6::float8[]
     )
     ON CONFLICT (name, country, province, city) DO NOTHING`,
    [names, countries, provinces, cities, latitudes, longitudes]
  );

  return result.rowCount ?? 0;
}
