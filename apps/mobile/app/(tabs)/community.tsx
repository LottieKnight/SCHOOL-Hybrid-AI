import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, spacing } from "../../src/theme/tokens";
import {
  fetchCommunityPosts,
  fetchCommunityStreak,
  fetchLeaderboard,
  createPost,
  type CommunityPost,
} from "../../src/lib/api/community";
import { fetchModuleCatalog, getFeaturedModule } from "../../src/lib/api/learn";
import { queryClient } from "../../src/lib/queryClient";
import { MusicFeed } from "../../src/components/community/MusicFeed";

type CommunityTab = "discussion" | "music";
type Filter = "recent" | "unanswered" | "for-you";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "unanswered", label: "Unanswered" },
  { key: "for-you", label: "For you" },
];

function StreakBadge() {
  const { data } = useQuery({
    queryKey: ["community-streak"],
    queryFn: fetchCommunityStreak,
  });
  if (!data?.current) return null;
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakFire}>🔥</Text>
      <Text style={styles.streakNum}>{data.current}</Text>
      <Text style={styles.streakLabel}>day streak</Text>
    </View>
  );
}

function PostCard({ post }: { post: CommunityPost }) {
  const totalReactions = Object.values(post.reactionCounts ?? {}).reduce((a, b) => a + b, 0);
  const timeAgo = formatTimeAgo(post.createdAt);

  return (
    <GlassCard style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>
            {post.isAnonymous ? "Anonymous" : post.authorName}
          </Text>
          <Text style={styles.postDot}>·</Text>
          <Text style={styles.postModule}>{post.moduleCode}</Text>
        </View>
        <Text style={styles.postTime}>{timeAgo}</Text>
      </View>
      <Text style={styles.postContent} numberOfLines={4}>
        {post.content}
      </Text>
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.textSoft} />
          <Text style={styles.postStatText}>{post.commentCount}</Text>
        </View>
        {totalReactions > 0 && (
          <View style={styles.postStat}>
            <Ionicons name="heart-outline" size={13} color={colors.textSoft} />
            <Text style={styles.postStatText}>{totalReactions}</Text>
          </View>
        )}
        <View style={[styles.typePill, post.postType === "question" && styles.typePillQuestion]}>
          <Text style={styles.typePillText}>{post.postType}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

function LeaderboardSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["community-leaderboard"],
    queryFn: fetchLeaderboard,
  });

  if (isLoading || !data?.length) return null;

  return (
    <GlassCard>
      <Text style={styles.sectionTitle}>Leaderboard</Text>
      <View style={styles.leaderRows}>
        {data.slice(0, 3).map((entry, i) => (
          <View key={entry.userId} style={styles.leaderRow}>
            <Text style={[styles.leaderRank, i === 0 && styles.leaderRankGold]}>
              {i === 0 ? "★" : `${i + 1}`}
            </Text>
            <Text style={styles.leaderName} numberOfLines={1}>
              {entry.username ?? entry.displayName}
            </Text>
            <Text style={styles.leaderScore}>{entry.score}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function AskSheet({ moduleCode, onDismiss }: { moduleCode: string; onDismiss: () => void }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await createPost({ moduleCode, content: text.trim(), postType: "question" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void queryClient.invalidateQueries({ queryKey: ["community-posts"] });
      onDismiss();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={styles.askSheet}>
      <View style={styles.askHeader}>
        <Text style={styles.askTitle}>Ask the community</Text>
        <Pressable onPress={onDismiss}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={styles.askModule}>{moduleCode}</Text>
      <TextInput
        style={styles.askInput}
        value={text}
        onChangeText={setText}
        placeholder="What do you need help with?"
        placeholderTextColor={colors.textSoft}
        multiline
        autoFocus
        maxLength={1000}
      />
      <Button onPress={() => void submit()} disabled={!text.trim() || posting}>
        {posting ? "Posting..." : "Post question"}
      </Button>
    </View>
  );
}

function formatTimeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function CommunityScreen() {
  const [tab, setTab] = useState<CommunityTab>("discussion");
  const [filter, setFilter] = useState<Filter>("recent");
  const [showAsk, setShowAsk] = useState(false);

  const switchTab = (next: CommunityTab) => {
    void Haptics.selectionAsync();
    setTab(next);
  };

  const postsQuery = useQuery({
    queryKey: ["community-posts", filter],
    queryFn: () => fetchCommunityPosts(filter),
  });

  const catalogQuery = useQuery({
    queryKey: ["module-catalog"],
    queryFn: fetchModuleCatalog,
  });

  const featured = catalogQuery.data ? getFeaturedModule(catalogQuery.data.modules) : null;
  const moduleCode = featured?.moduleCode ?? "GENERAL";

  if (showAsk) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <AskSheet moduleCode={moduleCode} onDismiss={() => setShowAsk(false)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={postsQuery.isFetching}
          onRefresh={() => void postsQuery.refetch()}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>COMMUNITY</Text>
        <View style={styles.heroRow}>
          <Text style={styles.title}>Study together.</Text>
          <StreakBadge />
        </View>
      </View>

      {/* Top-level tab switcher */}
      <View style={styles.tabRow}>
        {(["discussion", "music"] as CommunityTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => switchTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "discussion" ? "Discussion" : "Music"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "music" ? (
        <MusicFeed />
      ) : (
        <>
          <LeaderboardSection />

          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.askBtn}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowAsk(true);
              }}
            >
              <Ionicons name="add" size={18} color={colors.backgroundDeep} />
              <Text style={styles.askBtnText}>Ask</Text>
            </Pressable>
          </View>

          {postsQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : postsQuery.isError ? (
            <GlassCard>
              <Text style={styles.emptyText}>Could not load posts. Pull to refresh.</Text>
            </GlassCard>
          ) : !postsQuery.data?.length ? (
            <GlassCard>
              <Text style={styles.emptyText}>No posts yet. Be the first to ask a question.</Text>
            </GlassCard>
          ) : (
            postsQuery.data.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: 120 },
  hero: { paddingTop: spacing.xxl, paddingBottom: spacing.md, gap: spacing.xs },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: colors.gold, fontWeight: "800", letterSpacing: 2, fontSize: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.25)",
  },
  streakFire: { fontSize: 14 },
  streakNum: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  streakLabel: { color: colors.textSoft, fontSize: 11 },
  sectionTitle: { color: colors.text, fontWeight: "700", fontSize: 15, marginBottom: spacing.sm },
  leaderRows: { gap: spacing.xs },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  leaderRank: { width: 24, color: colors.textSoft, fontWeight: "700", fontSize: 13 },
  leaderRankGold: { color: colors.gold },
  leaderName: { flex: 1, color: colors.text, fontSize: 14 },
  leaderScore: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  tabRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.full,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderColor: "rgba(255,215,0,0.35)",
  },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: colors.gold },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderColor: "rgba(255,215,0,0.35)",
  },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: colors.gold },
  askBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    marginLeft: "auto",
  },
  askBtnText: { color: colors.backgroundDeep, fontSize: 13, fontWeight: "700" },
  center: { paddingVertical: spacing.xxl, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  postCard: { marginBottom: spacing.sm },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  postMeta: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
  postAuthor: { color: colors.text, fontSize: 13, fontWeight: "600" },
  postDot: { color: colors.textSoft },
  postModule: { color: colors.gold, fontSize: 12, fontWeight: "700" },
  postTime: { color: colors.textSoft, fontSize: 11 },
  postContent: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  postFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  postStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  postStatText: { color: colors.textSoft, fontSize: 12 },
  typePill: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
  },
  typePillQuestion: { backgroundColor: "rgba(96,165,250,0.1)" },
  typePillText: {
    color: colors.textSoft,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  askSheet: { gap: spacing.md },
  askHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
  askTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  askModule: { color: colors.gold, fontSize: 13, fontWeight: "700" },
  askInput: {
    minHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
});
