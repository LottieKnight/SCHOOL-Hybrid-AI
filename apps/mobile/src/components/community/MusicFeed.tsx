import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "../ui/GlassCard";
import { colors, radius, spacing } from "../../theme/tokens";
import { fetchMusicDiscovery, type MusicDiscoveryRecord } from "../../lib/api/community";

type Match = "similar" | "different";

const PAGE_SIZE = 12;

function GenreChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function MusicStudentCard({ record }: { record: MusicDiscoveryRecord }) {
  const name = [record.first_name, record.last_name].filter(Boolean).join(" ");
  const handle = record.username ? `@${record.username}` : null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{record.first_name?.[0]?.toUpperCase() ?? "?"}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardName}>{name}</Text>
          {handle && <Text style={styles.cardHandle}>{handle}</Text>}
          {record.school_name && (
            <Text style={styles.cardSchool} numberOfLines={1}>
              {record.school_name}
            </Text>
          )}
        </View>
        {(record.overlap_count ?? 0) > 0 && (
          <View style={styles.overlapBadge}>
            <Text style={styles.overlapText}>{record.overlap_count} shared</Text>
          </View>
        )}
      </View>

      {record.genres.length > 0 && (
        <View style={styles.chips}>
          {record.genres.slice(0, 4).map((g) => (
            <GenreChip key={g} label={g} />
          ))}
        </View>
      )}

      {record.artists.length > 0 && (
        <Text style={styles.artists} numberOfLines={1}>
          {record.artists.slice(0, 3).join(" · ")}
        </Text>
      )}

      {record.vibe_tags.length > 0 && (
        <Text style={styles.vibes} numberOfLines={1}>
          {record.vibe_tags.join(" · ")}
        </Text>
      )}

      {record.playlist_url && (
        <Pressable
          style={styles.playlistLink}
          onPress={() => void Linking.openURL(record.playlist_url!)}
        >
          <Ionicons name="musical-notes-outline" size={13} color={colors.gold} />
          <Text style={styles.playlistText} numberOfLines={1}>
            {record.playlist_title ?? "Open playlist"}
          </Text>
        </Pressable>
      )}
    </GlassCard>
  );
}

export function MusicFeed() {
  const [match, setMatch] = useState<Match>("similar");
  const [offset, setOffset] = useState(0);
  const [allRecords, setAllRecords] = useState<MusicDiscoveryRecord[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const query = useQuery({
    queryKey: ["music-discover", match, offset],
    queryFn: () => fetchMusicDiscovery(match, offset, PAGE_SIZE),
    staleTime: 5 * 60_000,
  });

  // Accumulate pages as offset increases
  const prevOffset = query.data?.offset ?? 0;
  if (query.data && !query.isError) {
    const incoming = query.data.results ?? [];
    if (offset === 0) {
      if (allRecords.length !== incoming.length || allRecords[0]?.user_id !== incoming[0]?.user_id) {
        setAllRecords(incoming);
        setHasMore(incoming.length === PAGE_SIZE);
      }
    } else if (prevOffset === offset && incoming.length > 0) {
      const lastKnown = allRecords[allRecords.length - 1]?.user_id;
      if (incoming[0]?.user_id !== lastKnown) {
        setAllRecords((prev) => [...prev, ...incoming]);
        setHasMore(incoming.length === PAGE_SIZE);
      }
    }
  }

  const switchMatch = (next: Match) => {
    void Haptics.selectionAsync();
    setMatch(next);
    setOffset(0);
    setAllRecords([]);
    setHasMore(true);
  };

  const noProfile = query.isError && query.error?.message === "complete_your_music_profile";

  return (
    <View style={styles.root}>
      {/* Match toggle */}
      <View style={styles.toggle}>
        {(["similar", "different"] as Match[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.toggleBtn, match === m && styles.toggleBtnActive]}
            onPress={() => switchMatch(m)}
          >
            <Text style={[styles.toggleText, match === m && styles.toggleTextActive]}>
              {m === "similar" ? "Similar taste" : "Different taste"}
            </Text>
          </Pressable>
        ))}
      </View>

      {noProfile ? (
        <GlassCard style={styles.promptCard}>
          <Ionicons name="musical-notes" size={28} color={colors.gold} style={styles.promptIcon} />
          <Text style={styles.promptTitle}>Set up your music profile</Text>
          <Text style={styles.promptBody}>
            Add your genres, artists and study vibes so others can discover you — and you can discover them.
          </Text>
          <Text style={styles.promptHint}>Available on the web app under Profile → Music.</Text>
        </GlassCard>
      ) : query.isLoading && allRecords.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : query.isError && !noProfile ? (
        <GlassCard>
          <Text style={styles.errorText}>Could not load music profiles. Pull to refresh.</Text>
        </GlassCard>
      ) : allRecords.length === 0 ? (
        <GlassCard>
          <Text style={styles.errorText}>No students found for this filter yet.</Text>
        </GlassCard>
      ) : (
        <>
          {allRecords.map((record) => (
            <MusicStudentCard key={record.user_id} record={record} />
          ))}
          {hasMore && (
            <Pressable
              style={styles.loadMore}
              onPress={() => setOffset((prev) => prev + PAGE_SIZE)}
              disabled={query.isFetching}
            >
              {query.isFetching ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  toggle: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.full,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  toggleBtnActive: {
    backgroundColor: "rgba(255,215,0,0.12)",
    borderColor: "rgba(255,215,0,0.35)",
  },
  toggleText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  toggleTextActive: { color: colors.gold },
  card: { gap: spacing.xs },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.gold, fontWeight: "800", fontSize: 16 },
  cardMeta: { flex: 1 },
  cardName: { color: colors.text, fontWeight: "700", fontSize: 14 },
  cardHandle: { color: colors.gold, fontSize: 12 },
  cardSchool: { color: colors.textSoft, fontSize: 11 },
  overlapBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,215,0,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.3)",
  },
  overlapText: { color: colors.gold, fontSize: 10, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
  },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  artists: { color: colors.textSoft, fontSize: 12 },
  vibes: { color: colors.textSoft, fontSize: 11, fontStyle: "italic" },
  playlistLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: 2,
  },
  playlistText: { color: colors.gold, fontSize: 12, flex: 1 },
  center: { paddingVertical: spacing.xxl, alignItems: "center" },
  errorText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  promptCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  promptIcon: { marginBottom: spacing.xs },
  promptTitle: { color: colors.text, fontWeight: "700", fontSize: 17, textAlign: "center" },
  promptBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  promptHint: { color: colors.textSoft, fontSize: 12, textAlign: "center" },
  loadMore: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  loadMoreText: { color: colors.gold, fontWeight: "600", fontSize: 14 },
});
