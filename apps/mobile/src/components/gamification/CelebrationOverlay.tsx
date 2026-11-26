import * as Haptics from "expo-haptics";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useCelebrationStore } from "../../store/celebrationStore";
import { colors, radius, spacing } from "../../theme/tokens";

const CONFETTI_COUNT = 20;
const AUTO_DISMISS_MS = 2500;
const PALETTE = [colors.gold, colors.green, colors.amber, colors.blue, colors.red, colors.goldStrong];

type ConfettiPiece = {
  id: number;
  left: number;
  size: number;
  delay: number;
  drift: number;
  spin: number;
  color: string;
};

function createSeeded(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function createPieces(seed: number, width: number): ConfettiPiece[] {
  const random = createSeeded(seed + 1);
  return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const color = PALETTE[index % PALETTE.length] ?? colors.gold;
    return {
      id: index,
      left: Math.max(16, Math.floor(random() * Math.max(120, width - 32))),
      size: 6 + Math.floor(random() * 8),
      delay: Math.floor(random() * 400),
      drift: (random() - 0.5) * 140,
      spin: (random() - 0.5) * 1080,
      color,
    };
  });
}

function ConfettiParticle({
  piece,
  height,
  visibleKey,
}: {
  piece: ConfettiPiece;
  height: number;
  visibleKey: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(piece.delay, withTiming(1, { duration: AUTO_DISMISS_MS - 150 }));
  }, [piece.delay, progress, visibleKey]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [-24, height + 64]);
    const translateX = piece.drift * progress.value;
    const rotate = `${piece.spin * progress.value}deg`;
    const opacity = interpolate(progress.value, [0, 0.05, 0.85, 1], [0, 1, 1, 0]);

    return {
      opacity,
      transform: [{ translateX }, { translateY }, { rotate }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          width: piece.size,
          height: piece.size * 1.2,
          borderRadius: Math.max(2, piece.size / 3),
          left: piece.left,
          backgroundColor: piece.color,
          top: -20,
        },
        animatedStyle,
      ]}
    />
  );
}

export function CelebrationOverlay() {
  const { width, height } = useWindowDimensions();
  const { isVisible, id, title, message, dismiss } = useCelebrationStore((state) => ({
    isVisible: state.isVisible,
    id: state.id,
    title: state.title,
    message: state.message,
    dismiss: state.dismiss,
  }));

  const pieces = useMemo(() => createPieces(id, width), [id, width]);

  useEffect(() => {
    if (!isVisible) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const timeout = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [dismiss, id, isVisible]);

  if (!isVisible) return null;

  return (
    <Pressable accessibilityRole="button" onPress={dismiss} style={styles.overlay}>
      <View style={styles.backdrop} />
      {pieces.map((piece) => (
        <ConfettiParticle key={`${id}-${piece.id}`} piece={piece} height={height} visibleKey={id} />
      ))}
      <View style={styles.card}>
        <Text style={styles.kicker}>CELEBRATION</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.hint}>Tap anywhere to close</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4, 12, 24, 0.78)",
  },
  piece: {
    position: "absolute",
    shadowColor: colors.gold,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  card: {
    width: "84%",
    maxWidth: 360,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: "rgba(12, 22, 40, 0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.18)",
    alignItems: "center",
    gap: spacing.sm,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  hint: {
    color: colors.textSoft,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
