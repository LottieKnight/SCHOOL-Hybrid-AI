import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { PanResponder, Text, View } from "react-native";
import {
  fetchLessonDetail,
  fetchModuleDetail,
  lessonSectionsToChapterBody,
  resolveLessonLookup,
  type LessonContent,
  type ModuleChapter,
} from "../../../../src/lib/api/learn";
import { ChapterReader } from "../../../../src/components/study/ChapterReader";
import { Screen } from "../../../../src/components/ui/Screen";
import { GlassCard } from "../../../../src/components/ui/GlassCard";
import { colors } from "../../../../src/theme/tokens";

function chapterSections(chapter: ModuleChapter): { heading: string; body: string }[] {
  const sections = [
    {
      heading: "Summary",
      body: chapter.summary,
    },
  ];

  if (chapter.outcomes.length) {
    sections.push({
      heading: "Outcomes",
      body: chapter.outcomes.map((outcome) => `• ${outcome}`).join("\n"),
    });
  }

  if (chapter.formulas.length) {
    sections.push({
      heading: "Formulas",
      body: chapter.formulas.join("\n"),
    });
  }

  if (chapter.definitions.length) {
    sections.push({
      heading: "Definitions",
      body: chapter.definitions.map((item) => `${item.term}: ${item.definition}`).join("\n\n"),
    });
  }

  if (chapter.revisionPrompts.length) {
    sections.push({
      heading: "Revision prompts",
      body: chapter.revisionPrompts.map((prompt) => `• ${prompt}`).join("\n"),
    });
  }

  if (chapter.saContext) {
    sections.push({
      heading: "South African context",
      body: chapter.saContext,
    });
  }

  return sections;
}

function lessonChapterSections(lesson: LessonContent) {
  return lessonSectionsToChapterBody(lesson);
}

export default function ChapterScreen() {
  const params = useLocalSearchParams<{ moduleCode?: string; id?: string }>();
  const moduleCode = params.moduleCode ?? "";
  const chapterId = params.id ?? "";

  const moduleQuery = useQuery({
    queryKey: ["module", moduleCode],
    queryFn: () => fetchModuleDetail(moduleCode),
    enabled: Boolean(moduleCode),
  });

  const chapterIndex = moduleQuery.data?.chapters.findIndex((chapter: ModuleChapter) => chapter.id === chapterId) ?? -1;
  const chapter = chapterIndex >= 0 ? moduleQuery.data?.chapters[chapterIndex] ?? null : null;
  const lessonLookup = resolveLessonLookup(moduleCode, chapterId);

  const lessonQuery = useQuery({
    queryKey: ["lesson", lessonLookup?.grade, lessonLookup?.subject, lessonLookup?.term, lessonLookup?.week],
    queryFn: () => {
      if (!lessonLookup) {
        throw new Error("Missing lesson lookup");
      }
      return fetchLessonDetail(lessonLookup);
    },
    enabled: Boolean(lessonLookup && chapter),
    retry: false,
  });

  const liveLesson = lessonQuery.data ?? null;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) =>
      Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
    onPanResponderRelease: (_, gestureState) => {
      if (!moduleQuery.data) return;
      if (gestureState.dx > 60 && chapterIndex > 0) {
        router.replace(`/learn/${moduleQuery.data.moduleCode.toLowerCase()}/chapter/${moduleQuery.data.chapters[chapterIndex - 1].id}`);
      }
      if (gestureState.dx < -60 && chapterIndex < moduleQuery.data.chapters.length - 1) {
        router.replace(`/learn/${moduleQuery.data.moduleCode.toLowerCase()}/chapter/${moduleQuery.data.chapters[chapterIndex + 1].id}`);
      }
    },
  });

  if (moduleQuery.isLoading || (chapter && lessonQuery.isLoading && !lessonQuery.isError)) {
    return (
      <Screen>
        <GlassCard>
          <Text style={{ color: colors.textMuted }}>Loading chapter...</Text>
        </GlassCard>
      </Screen>
    );
  }

  if (moduleQuery.isError || !moduleQuery.data || !chapter) {
    return (
      <Screen>
        <GlassCard>
          <Text style={{ color: colors.textMuted }}>Chapter not found.</Text>
        </GlassCard>
      </Screen>
    );
  }

  const sections = liveLesson ? lessonChapterSections(liveLesson) : chapterSections(chapter);
  const title = liveLesson?.title ?? chapter.title;
  const summary = liveLesson?.summary ?? chapter.summary;

  return (
    <Screen noPadding>
      <View {...panResponder.panHandlers} style={{ flex: 1 }}>
        <ChapterReader
          chapterNumber={chapter.id}
          title={title}
          summary={summary}
          sections={sections}
          onBack={() => router.back()}
          onPrev={
            chapterIndex > 0
              ? () => router.replace(`/learn/${moduleQuery.data.moduleCode.toLowerCase()}/chapter/${moduleQuery.data.chapters[chapterIndex - 1].id}`)
              : undefined
          }
          onNext={
            chapterIndex < moduleQuery.data.chapters.length - 1
              ? () => router.replace(`/learn/${moduleQuery.data.moduleCode.toLowerCase()}/chapter/${moduleQuery.data.chapters[chapterIndex + 1].id}`)
              : undefined
          }
        />
      </View>
    </Screen>
  );
}
