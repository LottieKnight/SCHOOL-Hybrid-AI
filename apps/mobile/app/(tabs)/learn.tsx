import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/ui/Screen";
import { colors, spacing } from "../../src/theme/tokens";
import { fetchModuleCatalog, type ModuleSummary } from "../../src/lib/api/learn";
import { ModuleCard } from "../../src/components/study/ModuleCard";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { OFFLINE_CACHE } from "../../src/lib/queryClient";

export default function LearnScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["module-catalog"],
    queryFn: fetchModuleCatalog,
    ...OFFLINE_CACHE,
  });

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.kicker}>LEARN</Text>
        <Text style={styles.title}>Your modules, tuned for mobile.</Text>
        <Text style={styles.copy}>Open a module, continue where you left off, and read in short focused bursts.</Text>
      </View>

      {isLoading ? (
        <GlassCard>
          <Text style={styles.copy}>Loading live module catalog...</Text>
        </GlassCard>
      ) : isError ? (
        <GlassCard>
          <Text style={styles.copy}>Could not load the live module catalog just now.</Text>
        </GlassCard>
      ) : (
        <View style={{ gap: spacing.md }}>
          {data?.modules?.map((module: ModuleSummary) => (
            <ModuleCard key={module.moduleCode} module={module} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  copy: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
});
