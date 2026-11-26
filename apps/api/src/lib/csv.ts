// apps/api/src/lib/csv.ts
//
// Minimal RFC 4180 CSV parser supporting quoted fields, embedded commas,
// quotes (doubled) and newlines. Avoids a runtime dependency (no csv lib in
// the project) and is sufficient for structured bulk-import files.

export type CsvRow = Record<string, string>;

/** Split one CSV record into field values (handles quoted fields). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Parse a full CSV document into rows keyed by their header. Multi-line quoted
 * fields are handled by tracking quote state while splitting records on \n.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (c === "\r" || c === "\n") {
        field += c;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (c === "\r") {
      // ignore CR
    } else {
      field += c;
    }
  }
  // flush last record
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }

  if (!records.length) return { headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim().toLowerCase());
  if (!headers.length) return { headers: [], rows: [] };

  const rows: CsvRow[] = [];
  for (let r = 1; r < records.length; r++) {
    const line = records[r];
    if (line.length === 1 && line[0].trim() === "") continue;
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = (line[i] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}
