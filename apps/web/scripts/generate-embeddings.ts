import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { loadCapsScaffold } from "@saedu/shared";
import { generateEmbedding } from "@/lib/embeddings";
import { queryPlannerDb } from "@/lib/server/plannerDb";

type TopicEmbeddingSeed = {
  entityId: string;
  contentText: string;
};

function createDeterministicUuid(input: string) {
  const hash = createHash("sha1").update(input).digest("hex");
  const segment1 = hash.slice(0, 8);
  const segment2 = hash.slice(8, 12);
  const segment3 = `5${hash.slice(13, 16)}`;
  const variantNibble = ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  const segment4 = `${variantNibble}${hash.slice(17, 20)}`;
  const segment5 = hash.slice(20, 32);
  return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
}

function flattenScaffoldTopics() {
  const scaffold = loadCapsScaffold();
  const topics: TopicEmbeddingSeed[] = [];

  for (const [phaseKey, phase] of Object.entries(scaffold.phases ?? {})) {
    for (const [gradeKey, grade] of Object.entries(phase.grades ?? {})) {
      for (const [groupKey, group] of Object.entries(grade.groups ?? {})) {
        for (const [subjectKey, subject] of Object.entries(group.subjects ?? {})) {
          for (const [termKey, term] of Object.entries(subject.terms ?? {})) {
            for (const [index, week] of (term.weeks ?? []).entries()) {
              const identity = `${phaseKey}:${gradeKey}:${groupKey}:${subjectKey}:${termKey}:${index + 1}`;
              const entityId = createDeterministicUuid(identity);
              const contentText = [
                phase.name || phaseKey,
                grade.name || gradeKey,
                group.name || groupKey,
                subject.name || subjectKey,
                term.name || termKey,
                week.name || `Week ${index + 1}`,
                week.topic_title || "Topic not yet available",
                week.summary_md || "",
              ]
                .filter(Boolean)
                .join(" | ");

              topics.push({
                entityId,
                contentText,
              });
            }
          }
        }
      }
    }
  }

  return topics;
}

async function hasExistingEmbedding(entityId: string) {
  const result = await queryPlannerDb<{ entity_id: string }>(
    `
      SELECT entity_id::text AS entity_id
      FROM embeddings
      WHERE entity_type = 'topic' AND entity_id = $1
      LIMIT 1
    `,
    [entityId]
  );

  return (result.rowCount ?? 0) > 0;
}

async function insertEmbedding(entityId: string, contentText: string, embedding: number[]) {
  const vectorLiteral = `[${embedding.join(",")}]`;

  await queryPlannerDb(
    `
      INSERT INTO embeddings (entity_type, entity_id, content_text, embedding, model)
      VALUES ('topic', $1, $2, $3::vector, 'text-embedding-3-small')
      ON CONFLICT (entity_type, entity_id) DO NOTHING
    `,
    [entityId, contentText, vectorLiteral]
  );
}

async function main() {
  const topics = flattenScaffoldTopics();
  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  for (const topic of topics) {
    processed += 1;

    if (await hasExistingEmbedding(topic.entityId)) {
      skipped += 1;
    } else {
      const embedding = await generateEmbedding(topic.contentText);
      await insertEmbedding(topic.entityId, topic.contentText, embedding);
      inserted += 1;
      await delay(100);
    }

    if (processed % 10 === 0) {
      console.info(
        `[embed:curriculum] processed=${processed} inserted=${inserted} skipped=${skipped}`
      );
    }
  }

  console.info(`[embed:curriculum] complete processed=${processed} inserted=${inserted} skipped=${skipped}`);
}

main().catch((error) => {
  console.error("[embed:curriculum] failed", error);
  process.exitCode = 1;
});
