import { upsertInstitutionSeedData } from "@/lib/server/institutions";
import { withPlannerDbClient } from "@/lib/server/plannerDb";

async function tableExists(tableName: string) {
  return withPlannerDbClient(async (client) => {
    const result = await client.query<{ regclass: string | null }>(`SELECT to_regclass($1) AS regclass`, [tableName]);
    return Boolean(result.rows[0]?.regclass);
  });
}

async function columnExists(tableName: string, columnName: string) {
  return withPlannerDbClient(async (client) => {
    const result = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS exists
      `,
      [tableName, columnName]
    );
    return Boolean(result.rows[0]?.exists);
  });
}

async function tagFounderContent() {
  const hasInstitutionsTable = await tableExists("public.institutions");
  const hasBookstoreProducts = await tableExists("public.bookstore_products");
  const hasResources = await tableExists("public.resources");

  if (!hasInstitutionsTable) {
    throw new Error("institutions table does not exist.");
  }

  return withPlannerDbClient(async (client) => {
    const institutionResult = await client.query<{ id: string }>(
      `
        SELECT id::text AS id
        FROM institutions
        WHERE domain = 'nwu.ac.za'
           OR LOWER(name) = LOWER($1)
        ORDER BY created_at ASC
        LIMIT 1
      `,
      ["North-West University Vanderbijlpark"]
    );
    const institutionId = institutionResult.rows[0]?.id;
    if (!institutionId) {
      throw new Error("Unable to resolve the NWU institution id.");
    }

    if (hasBookstoreProducts && (await columnExists("bookstore_products", "institution_id"))) {
      await client.query(
        `
          UPDATE bookstore_products
          SET institution_id = $1
          WHERE institution_id IS NULL
            AND (
              title ILIKE '%EKIP 212%'
              OR title ILIKE '%EKRP 211%'
              OR title ILIKE '%Macroeconomics%'
              OR slug ILIKE '%ekip%'
              OR slug ILIKE '%ekrp%'
              OR slug ILIKE '%macroeconomics%'
              OR EXISTS (
                SELECT 1
                FROM unnest(subjects) AS subject_name
                WHERE subject_name ILIKE '%Macroeconomics%'
              )
            )
        `,
        [institutionId]
      );
    }

    if (hasResources && (await columnExists("resources", "institution_id"))) {
      const titleColumn =
        (await columnExists("resources", "title")) ? "title" : (await columnExists("resources", "name")) ? "name" : null;
      if (titleColumn) {
        await client.query(
          `
            UPDATE resources
            SET institution_id = $1
            WHERE institution_id IS NULL
              AND ${titleColumn} IS NOT NULL
              AND (
                ${titleColumn} ILIKE '%EKIP 212%'
                OR ${titleColumn} ILIKE '%EKRP 211%'
                OR ${titleColumn} ILIKE '%Macroeconomics%'
              )
          `,
          [institutionId]
        );
      }
    }
  });
}

async function main() {
  await upsertInstitutionSeedData();
  await tagFounderContent();
  console.error("Institution seeds applied.");
}

main().catch((error) => {
  console.error("Failed to seed institutions.", error);
  process.exit(1);
});
