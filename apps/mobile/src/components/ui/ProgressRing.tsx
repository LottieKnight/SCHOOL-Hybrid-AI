import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";

export function ProgressRing({
  progress,
  size = 72,
  strokeWidth = 5,
  label,
  color = colors.gold,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      />
      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          opacity: clamped,
        }}
      />
      <Text style={styles.percent}>{Math.round(clamped * 100)}%</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  percent: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  label: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
});
