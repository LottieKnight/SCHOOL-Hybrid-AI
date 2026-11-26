import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { useAuthStore } from "../../src/store/authStore";
import { useThemeStore, type InstitutionCode, type ThemeName } from "../../src/store/themeStore";
import { fetchLocaleOptions, fetchProfileMe, updateProfileMe } from "../../src/lib/api/profile";

type AIpersona = "standard" | "mzansi" | "strict";

const THEME_SWATCHES: { name: ThemeName; label: string; bg: string; accent: string }[] = [
  { name: "scholar", label: "Scholar", bg: "#0a0a0a", accent: "#e8c15a" },
  { name: "light",   label: "Light",   bg: "#f4f4f5", accent: "#b8862f" },
  { name: "obsidian",label: "Obsidian",bg: "#080808", accent: "#e8c15a" },
  { name: "vanta",   label: "Vanta",   bg: "#000000", accent: "#cc0000" },
];

const INSTITUTIONS: { code: InstitutionCode; label: string }[] = [
  { code: null,   label: "None" },
  { code: "NWU",  label: "NWU" },
  { code: "UCT",  label: "UCT" },
  { code: "UJ",   label: "UJ" },
  { code: "WITS", label: "WITS" },
  { code: "UP",   label: "UP" },
];

function ThemeSwatchCard({ swatch, selected, onPress }: { swatch: typeof THEME_SWATCHES[0]; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.themeCard, selected && styles.themeCardSelected, pressed && styles.chipPressed]}
    >
      <View style={[styles.themeSwatch, { backgroundColor: swatch.bg, borderColor: swatch.accent }]}>
        <View style={[styles.themeAccentDot, { backgroundColor: swatch.accent }]} />
      </View>
      <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>{swatch.label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={14} color={colors.goldStrong} style={styles.themeCheck} /> : null}
    </Pressable>
  );
}

type SettingsChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function SettingsChip({ label, selected, onPress }: SettingsChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const { theme, institution, setTheme, setInstitution } = useThemeStore();
  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: fetchProfileMe,
  });
  const localesQuery = useQuery({
    queryKey: ["locale-options"],
    queryFn: fetchLocaleOptions,
  });

  const profile = profileQuery.data;
  const [language, setLanguage] = useState("en");
  const [aiPersona, setAiPersona] = useState<AIpersona>("standard");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const appPreferences = profile?.profile.appPreferences as {
      language?: string;
      personalisation?: { aiPersona?: AIpersona };
    } | undefined;

    if (appPreferences?.language) {
      setLanguage(appPreferences.language);
    }
    if (appPreferences?.personalisation?.aiPersona) {
      setAiPersona(appPreferences.personalisation.aiPersona);
    }
  }, [profile]);

  const localeLabels = useMemo(() => {
    return localesQuery.data?.locales ?? [];
  }, [localesQuery.data]);

  const saveSettings = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      await updateProfileMe({
        appPreferences: {
          language,
          personalisation: {
            aiPersona,
          },
        },
      });
      setNotice("Settings saved.");
      await profileQuery.refetch();
    } catch {
      setNotice("Unable to save settings right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/(auth)/welcome");
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.kicker}>ACCOUNT</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Language and AI preferences sync to your SCHOOL profile.</Text>
      </View>

      <GlassCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons name="color-palette-outline" size={18} color={colors.goldStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <Text style={styles.sectionCopy}>Pick a colour theme and institution accent.</Text>
          </View>
        </View>
        <View style={styles.themeGrid}>
          {THEME_SWATCHES.map((swatch) => (
            <ThemeSwatchCard
              key={swatch.name}
              swatch={swatch}
              selected={theme === swatch.name}
              onPress={() => setTheme(swatch.name)}
            />
          ))}
        </View>
        <Text style={[styles.sectionCopy, { marginTop: spacing.md, marginBottom: spacing.xs }]}>Institution accent</Text>
        <View style={styles.chipGrid}>
          {INSTITUTIONS.map((inst) => (
            <SettingsChip
              key={inst.code ?? "none"}
              label={inst.label}
              selected={institution === inst.code}
              onPress={() => setInstitution(inst.code)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons name="language-outline" size={18} color={colors.goldStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Language</Text>
            <Text style={styles.sectionCopy}>Choose the language you want the app profile to remember.</Text>
          </View>
        </View>
        <View style={styles.chipGrid}>
          {localeLabels.map((locale) => (
            <SettingsChip
              key={locale.code}
              label={locale.label}
              selected={locale.code === language}
              onPress={() => setLanguage(locale.code)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Ionicons name="sparkles-outline" size={18} color={colors.goldStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>AI persona</Text>
            <Text style={styles.sectionCopy}>Sets the assistant tone used across SCHOOL surfaces.</Text>
          </View>
        </View>
        <View style={styles.chipGrid}>
          {(["standard", "mzansi", "strict"] as const).map((option) => (
            <SettingsChip
              key={option}
              label={option === "standard" ? "Standard" : option === "mzansi" ? "Mzansi" : "Strict"}
              selected={option === aiPersona}
              onPress={() => setAiPersona(option)}
            />
          ))}
        </View>
      </GlassCard>

      {notice ? (
        <GlassCard>
          <Text style={styles.notice}>{notice}</Text>
        </GlassCard>
      ) : null}

      <View style={styles.actions}>
        <Button onPress={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
        <Button variant="ghost" onPress={() => void handleSignOut()}>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.2)",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: "rgba(255,215,0,0.14)",
    borderColor: "rgba(255,215,0,0.45)",
  },
  chipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: colors.goldStrong,
  },
  notice: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  themeCard: {
    width: "48%",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  themeCardSelected: {
    borderColor: "rgba(255,215,0,0.5)",
    backgroundColor: "rgba(255,215,0,0.06)",
  },
  themeSwatch: {
    width: "100%",
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 6,
  },
  themeAccentDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  themeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  themeLabelSelected: {
    color: colors.goldStrong,
  },
  themeCheck: {
    position: "absolute",
    top: 6,
    right: 6,
  },
});
