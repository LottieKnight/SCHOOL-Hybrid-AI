import { ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing } from "../../theme/tokens";

export function Screen({
  children,
  scroll = false,
  noPadding = false,
}: {
  children?: ReactNode;
  scroll?: boolean;
  noPadding?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={noPadding ? styles.scrollBare : styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={noPadding ? styles.fixedBare : styles.fixed}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  scrollBare: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  fixed: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  fixedBare: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
