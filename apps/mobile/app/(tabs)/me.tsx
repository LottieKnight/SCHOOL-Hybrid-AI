import { useQuery } from "@tanstack/react-query";
import { Text, View, StyleSheet, ScrollView, Pressable } from "react-native";
import type { ComponentProps } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { colors, spacing, radius } from "../../src/theme/tokens";
import { useAuthStore } from "../../src/store/authStore";
import { fetchProfileMe } from "../../src/lib/api/profile";

function Avatar({ initials }: { initials: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AchievementBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="ribbon-outline" size={13} color={colors.gold} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function MenuRow({
  label,
  description,
  icon,
  onPress,
}: {
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={colors.goldStrong} />
      </View>
      <View style={styles.menuText}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
    </Pressable>
  );
}

export default function MeScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: fetchProfileMe,
    enabled: Boolean(user),
  });

  const profile = profileQuery.data;
  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <Screen scroll>
      <View style={styles.heroRow}>
        <Avatar initials={initials} />
        <View style={styles.heroText}>
          <Text style={styles.name}>
            {user ? `${user.firstName} ${user.lastName}` : "Profile"}
          </Text>
          <Text style={styles.email}>{user?.email ?? ""}</Text>
          {profile?.profile.username ? (
            <Text style={styles.username}>@{profile.profile.username}</Text>
          ) : null}
        </View>
      </View>

      {profile && (
        <View style={styles.statsRow}>
          <StatPill label="Following" value={profile.stats.followingCount} />
          <StatPill label="Followers" value={profile.stats.followersCount} />
          <StatPill label="Achievements" value={profile.achievements.length} />
        </View>
      )}

      {profile && typeof profile.completion === "number" && (
        <GlassCard>
          <View style={styles.completionRow}>
            <Text style={styles.cardTitle}>Profile</Text>
            <Text style={styles.completionPct}>{Math.round(profile.completion * 100)}%</Text>
          </View>
          <View style={styles.completionBarBg}>
            <View style={[styles.completionBarFill, { width: `${profile.completion * 100}%` }]} />
          </View>
          {profile.completion < 1 && (
            <Text style={styles.completionHint}>Complete your profile to unlock community features.</Text>
          )}
        </GlassCard>
      )}

      {profile && profile.achievements.length > 0 && (
        <GlassCard>
          <Text style={styles.cardTitle}>Achievements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
            <View style={styles.badgeRow}>
              {profile.achievements.slice(0, 8).map((a) => (
                <AchievementBadge key={a.id} label={a.label} />
              ))}
            </View>
          </ScrollView>
        </GlassCard>
      )}

      <GlassCard>
        <Text style={styles.cardTitle}>Account</Text>
        <MenuRow
          label="Settings"
          description="Language, AI persona, and account preferences"
          icon="settings-outline"
          onPress={() => router.push("/me/settings")}
        />
        <MenuRow
          label="Wallet"
          description="View Scholar Credits and recent transactions"
          icon="wallet-outline"
          onPress={() => router.push("/me/wallet")}
        />
        {user ? (
          <Button
            variant="ghost"
            onPress={async () => {
              await logout();
              router.replace("/(auth)/welcome");
            }}
          >
            Sign out
          </Button>
        ) : (
          <Button onPress={() => router.replace("/(auth)/login")}>Sign in</Button>
        )}
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.gold, fontSize: 22, fontWeight: "800" },
  heroText: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 22, fontWeight: "800" },
  email: { color: colors.textMuted, fontSize: 13 },
  username: { color: colors.textSoft, fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "800" },
  statLabel: { color: colors.textSoft, fontSize: 11, marginTop: 2 },
  cardTitle: { color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: spacing.sm },
  completionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  completionPct: { color: colors.gold, fontWeight: "800", fontSize: 15 },
  completionBarBg: { height: 4, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: "hidden", marginBottom: spacing.sm },
  completionBarFill: { height: "100%", backgroundColor: colors.gold, borderRadius: radius.full },
  completionHint: { color: colors.textSoft, fontSize: 12, lineHeight: 17 },
  badgeScroll: { marginTop: spacing.xs },
  badgeRow: { flexDirection: "row", gap: spacing.xs },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.2)",
  },
  badgeText: { color: colors.gold, fontSize: 12, fontWeight: "600" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  menuRowPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  menuDescription: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 16,
  },
});
