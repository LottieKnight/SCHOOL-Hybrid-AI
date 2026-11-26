"use client";

import type { GeneratedLessonContent } from "@saedu/shared";
import { LessonQuiz } from "@/components/LessonQuiz";
import { Markdown } from "@/components/Markdown";
import { LessonVisualView } from "@/components/LessonVisual";

type Props = {
  lesson: GeneratedLessonContent;
  meta: { phase: string; grade: number; subjectKey: string; term: number; week: number };
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function AiLessonView({ lesson, meta }: Props) {
  const lessonKey = `${pad2(meta.grade)}-${meta.subjectKey}-${pad2(meta.term)}-${pad2(meta.week)}`;

  return (
    <div className="week-card">
      <div className="pill">Topic: {lesson.topic}</div>

      <div>
        <strong>Summary</strong>
        {lesson.summary ? <div><Markdown>{lesson.summary}</Markdown></div> : <p className="badge">No summary yet.</p>}
      </div>

      {lesson.visuals?.length ? (
        <div>
          <strong>Visual aids</strong>
          {lesson.visuals.map((visual, idx) => (
            <LessonVisualView key={idx} visual={visual} />
          ))}
        </div>
      ) : null}

      <div>
        <strong>Learning outcomes</strong>
        {lesson.learningOutcomes?.length ? (
          <ul>
            {lesson.learningOutcomes.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="badge">No learning outcomes yet.</p>
        )}
      </div>

      <div>
        <strong>Lesson notes</strong>
        {lesson.lessonNotes?.length ? (
          <div className="grid">
            {lesson.lessonNotes.map((section, idx) => (
              <div key={`${section.title}-${idx}`} className="list-item">
                <strong>{section.title}</strong>
                <ul>
                  {section.bullets.map((bullet, bulletIdx) => (
                    <li key={`${section.title}-${bulletIdx}`}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="badge">No lesson notes yet.</p>
        )}
      </div>

      {lesson.workedExamples?.length ? (
        <div>
          <strong>Worked examples</strong>
          <ul>
            {lesson.workedExamples.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <strong>Practice</strong>
        <div className="grid">
          <div className="list-item">
            <strong>Easy</strong>
            <ul>
              {(lesson.practice?.easy || []).map((item, idx) => (
                <li key={`easy-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="list-item">
            <strong>Medium</strong>
            <ul>
              {(lesson.practice?.medium || []).map((item, idx) => (
                <li key={`medium-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="list-item">
            <strong>Hard</strong>
            <ul>
              {(lesson.practice?.hard || []).map((item, idx) => (
                <li key={`hard-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {lesson.teacherNotes?.length ? (
        <div>
          <strong>Teacher notes</strong>
          <ul>
            {lesson.teacherNotes.map((note, idx) => (
              <li key={`${note}-${idx}`}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {lesson.memo?.length ? (
        <div>
          <strong>Memo / Answers</strong>
          <ul>
            {lesson.memo.map((entry, idx) => (
              <li key={`${entry.questionId}-${idx}`}>
                <strong>{entry.questionId}:</strong> {entry.answer}
                {entry.explanation ? ` — ${entry.explanation}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lesson.citations?.length ? (
        <div>
          <strong>Citations</strong>
          <ul>
            {lesson.citations.map((citation, idx) => (
              <li key={`${citation.file_path}-${idx}`}>
                {citation.file_path} (pp. {citation.page_start}-{citation.page_end})
                {citation.note ? ` · ${citation.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <LessonQuiz
        quiz={lesson.quiz}
        meta={{
          subject: meta.subjectKey,
          grade: meta.grade,
          topicTag: lesson.topic || undefined,
          lessonKey,
        }}
      />
    </div>
  );
}
