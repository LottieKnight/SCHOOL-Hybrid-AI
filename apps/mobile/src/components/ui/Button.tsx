import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing } from "../../theme/tokens";

export function Button({
  children,
  onPress,
  variant = "primary",
  style,
  disabled = false,
}: {
  children: ReactNode;
  onPress?: () => void | Promise<void>;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        if (!disabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.ghost,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabledState,
        style,
      ]}
    >
      <Text style={[styles.label, variant === "ghost" && styles.labelGhost, disabled && styles.labelDisabled]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.gold,
  },
  ghost: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  disabledState: {
    opacity: 0.38,
  },
  label: {
    color: "#08111f",
    fontWeight: "700",
    fontSize: 15,
  },
  labelGhost: {
    color: colors.text,
  },
  labelDisabled: {
    opacity: 0.6,
  },
});
