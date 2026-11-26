import { getDbPool, closeDbPool } from "../src/gen/db";
import { ensureCapsScaffold, type CapsScaffoldSubject } from "../src/gen/caps-scaffold";

type NodeType = "LEARN" | "PHASE" | "GRADE" | "SUBJECT" | "TERM" | "WEEK" | "LESSON";

type UpsertInput = {
  parentId: string | null;
  type: NodeType;
  key: string;
  title: string;
  orderIndex: number;
  metadata?: Record<string, any>;
};

function parseNumber(value: string) {
  const match = value.match(/\d+/);
  if (!match) return null;
  const num = Number.parseInt(match[0], 10);
  return Number.isFinite(num) ? num : null;
}

function parseGradeKey(gradeKey: string) {
  const trimmed = gradeKey.trim().toLowerCase();
  if (trimmed === "r") return 0;
  const num = parseNumber(trimmed);
  return num ?? null;
}

async function upsertNode(input: UpsertInput) {
  const pool = getDbPool();
  const metadata = input.metadata ?? {};
  const metadataPayload = JSON.stringify(metadata);
  if (!input.parentId) {
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM curriculum_nodes WHERE parent_id IS NULL AND type = $1 AND key = $2",
      [input.type, input.key]
    );
    if (existing.rows[0]) {
      const id = existing.rows[0].id;
      await pool.query(
        "UPDATE curriculum_nodes SET title = $2, order_index = $3, metadata = $4, updated_at = NOW() WHERE id = $1",
        [id, input.title, input.orderIndex, metadataPayload]
      );
      return id;
    }
    const inserted = await pool.query<{ id: string }>(
      "INSERT INTO curriculum_nodes (parent_id, type, key, title, order_index, metadata) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id",
      [input.type, input.key, input.title, input.orderIndex, metadataPayload]
    );
    return inserted.rows[0].id;
  }

  const result = await pool.query<{ id: string }>(
    "INSERT INTO curriculum_nodes (parent_id, type, key, title, order_index, metadata) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (parent_id, type, key) DO UPDATE SET title = EXCLUDED.title, order_index = EXCLUDED.order_index, metadata = EXCLUDED.metadata, updated_at = NOW() RETURNING id",
    [input.parentId, input.type, input.key, input.title, input.orderIndex, metadataPayload]
  );
  return result.rows[0].id;
}

async function seedSubjectTree(options: {
  phaseKey: string;
  gradeKey: string;
  gradeNumber: number;
  groupKey: string;
  subjectKey: string;
  subject: CapsScaffoldSubject;
  parentId: string;
  orderIndex: number;
  parentSubjectKey?: string;
}) {
  const {
    phaseKey,
    gradeKey,
    gradeNumber,
    groupKey,
    subjectKey,
    subject,
    parentId,
    orderIndex,
    parentSubjectKey,
  } = options;

  const subjectId = await upsertNode({
    parentId,
    type: "SUBJECT",
    key: subjectKey,
    title: subject.name,
    orderIndex,
    metadata: {
      phase: phaseKey,
      grade: gradeNumber,
      gradeKey,
      groupKey,
      subjectKey,
      parentSubjectKey: parentSubjectKey ?? null,
      isChild: Boolean(parentSubjectKey),
      displayName: subject.name,
    },
  });

  if (subject.children && Object.keys(subject.children).length > 0) {
    let childIndex = 0;
    for (const [childKey, childValue] of Object.entries(subject.children)) {
      await seedSubjectTree({
        phaseKey,
        gradeKey,
        gradeNumber,
        groupKey,
        subjectKey: childKey,
        subject: childValue,
        parentId: subjectId,
        orderIndex: childIndex,
        parentSubjectKey: subjectKey,
      });
      childIndex += 1;
    }
  }

  if (subject.terms) {
    let termIndex = 0;
    for (const [termKey, term] of Object.entries(subject.terms)) {
      const termNumber = parseNumber(termKey) ?? termIndex + 1;
      const termId = await upsertNode({
        parentId: subjectId,
        type: "TERM",
        key: termKey,
        title: term.name,
        orderIndex: termIndex,
        metadata: {
          phase: phaseKey,
          grade: gradeNumber,
          gradeKey,
          subjectKey,
          term: termNumber,
          termKey,
        },
      });

      if (Array.isArray(term.weeks)) {
        for (let idx = 0; idx < term.weeks.length; idx += 1) {
          const week = term.weeks[idx];
          const weekNumber = idx + 1;
          await upsertNode({
            parentId: termId,
            type: "WEEK",
            key: `week-${String(weekNumber).padStart(2, "0")}`,
            title: week.name || `Week ${weekNumber}`,
            orderIndex: idx,
            metadata: {
              phase: phaseKey,
              grade: gradeNumber,
              gradeKey,
              subjectKey,
              term: termNumber,
              termKey,
              week: weekNumber,
              topicTitle: week.topic_title,
              summary: week.summary_md ?? "",
              outcomes: week.outcomes ?? [],
            },
          });
        }
      }
      termIndex += 1;
    }
  }
}

async function main() {
  const scaffold = ensureCapsScaffold();
  const rootId = await upsertNode({
    parentId: null,
    type: "LEARN",
    key: "learn",
    title: "Learn",
    orderIndex: 0,
    metadata: {},
  });

  let phaseIndex = 0;
  for (const [phaseKey, phaseValue] of Object.entries(scaffold.phases)) {
    const phaseId = await upsertNode({
      parentId: rootId,
      type: "PHASE",
      key: phaseKey,
      title: phaseValue.name,
      orderIndex: phaseIndex,
      metadata: { phase: phaseKey },
    });

    let gradeIndex = 0;
    for (const [gradeKey, gradeValue] of Object.entries(phaseValue.grades)) {
      const gradeNumber = parseGradeKey(gradeKey);
      if (gradeNumber === null) {
        console.warn(`Skipping grade ${gradeKey} (invalid grade key).`);
        continue;
      }
      const gradeId = await upsertNode({
        parentId: phaseId,
        type: "GRADE",
        key: gradeKey,
        title: gradeValue.name,
        orderIndex: gradeIndex,
        metadata: { phase: phaseKey, grade: gradeNumber, gradeKey },
      });

      for (const [groupKey, groupValue] of Object.entries(gradeValue.groups)) {
        let subjectIndex = 0;
        for (const [subjectKey, subjectValue] of Object.entries(groupValue.subjects)) {
          await seedSubjectTree({
            phaseKey,
            gradeKey,
            gradeNumber,
            groupKey,
            subjectKey,
            subject: subjectValue,
            parentId: gradeId,
            orderIndex: subjectIndex,
          });
          subjectIndex += 1;
        }
      }
      gradeIndex += 1;
    }
    phaseIndex += 1;
  }

  await closeDbPool();
  console.log("Curriculum seeded from caps_scaffold.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
