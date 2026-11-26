import { withPlannerDbClient } from "@/lib/server/plannerDb";
import type { TopicSignalInput } from "@/lib/sessionTopicSignal";

export async function storeTopicSignal(input: TopicSignalInput) {
  await withPlannerDbClient(async (client) => {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO ai_session_topics (
          session_id,
          topic_text,
          subject_inferred,
          grade_inferred,
          weakness_detected,
          difficulty_level
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        input.sessionId,
        input.topic,
        input.subject,
        input.gradeInferred,
        input.weaknessDetected,
        input.difficultyLevel,
      ],
    );

    if (input.weaknessDetected) {
      await client.query(
        `
          INSERT INTO weakness_signals (
            user_id,
            subject,
            topic_text,
            signal_type,
            score,
            session_id
          )
          VALUES ($1, $2, $3, 'explicit_struggle', $4, $5)
        `,
        [input.userId, input.subject, input.topic, input.difficultyLevel / 5, input.sessionId],
      );
    }

    await client.query("COMMIT");
  });
}
