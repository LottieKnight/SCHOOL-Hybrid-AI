import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Screen } from "../../../src/components/ui/Screen";
import { GlassCard } from "../../../src/components/ui/GlassCard";
import { Button } from "../../../src/components/ui/Button";
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { fetchPastPaperDetail } from "../../../src/lib/api/pastPapers";

function formatGrade(grade: number | null) {
  if (grade === null) return "University";
  if (grade === 0) return "Grade R";
  return `Grade ${grade}`;
}

export default function PastPaperViewerScreen() {
  const params = useLocalSearchParams<{ paperId: string }>();
  const paperId = typeof params.paperId === "string" ? params.paperId : "";
  const detailQuery = useQuery({
    queryKey: ["past-paper-detail", paperId],
    queryFn: () => fetchPastPaperDetail(paperId),
    enabled: Boolean(paperId),
  });

  const [showMemo, setShowMemo] = useState(false);

  const detail = detailQuery.data;
  const activeUrl = useMemo(() => {
    if (!detail) return null;
    return showMemo ? detail.memoUrl : detail.paperUrl;
  }, [detail, showMemo]);

  if (detailQuery.isLoading) {
    return (
      <Screen>
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingText}>Loading paper...</Text>
        </View>
      </Screen>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <Screen>
        <GlassCard>
          <Text style={styles.errorTitle}>Paper unavailable</Text>
          <Text style={styles.errorCopy}>We couldn’t load this past paper right now.</Text>
          <Button variant="ghost" onPress={() => router.back()}>
            Back
          </Button>
        </GlassCard>
      </Screen>
    );
  }

  return (
    <Screen noPadding>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>PAST PAPER</Text>
          <Text style={styles.title}>{detail.subject}</Text>
          <Text style={styles.subtitle}>
            {formatGrade(detail.grade)} · {detail.year ?? "—"} · {detail.session} · Paper {detail.paperNumber}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            variant={showMemo ? "ghost" : "primary"}
            disabled={!detail.paperUrl}
            onPress={() => setShowMemo(false)}
            style={styles.actionButton}
          >
            Paper
          </Button>
          <Button
            variant={showMemo ? "primary" : "ghost"}
            disabled={!detail.memoUrl}
            onPress={() => setShowMemo(true)}
            style={styles.actionButton}
          >
            Memo
          </Button>
        </View>
      </View>

      <GlassCard style={styles.metaCard}>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{detail.language}</Text>
          </View>
          {typeof detail.totalMarks === "number" ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{detail.totalMarks} marks</Text>
            </View>
          ) : null}
          {typeof detail.durationMinutes === "number" ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{detail.durationMinutes} min</Text>
            </View>
          ) : null}
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{detail.hasMemo ? "Memo available" : "Memo pending"}</Text>
          </View>
        </View>
      </GlassCard>

      {activeUrl ? (
        <View style={styles.viewerWrap}>
          <WebView
            source={{ uri: activeUrl }}
            style={styles.viewer}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingState}>
                <ActivityIndicator color={colors.gold} />
                <Text style={styles.loadingText}>Opening document...</Text>
              </View>
            )}
          />
        </View>
      ) : (
        <GlassCard>
          <Text style={styles.errorCopy}>No PDF URL is available for this paper.</Text>
        </GlassCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  backText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  headerCopy: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  metaCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  viewerWrap: {
    flex: 1,
    minHeight: 520,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  viewer: {
    flex: 1,
    backgroundColor: colors.backgroundDeep,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.backgroundDeep,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  errorCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
