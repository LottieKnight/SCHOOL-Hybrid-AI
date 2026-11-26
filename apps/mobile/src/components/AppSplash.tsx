import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, spacing } from "../theme/tokens";
import { getSplashVariant } from "../hooks/useSplashTiming";
import { useAuthStore } from "../store/authStore";

const LETTERS = "SCHOOL".split("");
const NUM_LETTERS = LETTERS.length;

const ROLE_TAGLINES: Record<string, string> = {
  student: "Your next chapter starts here.",
  teacher: "Guiding the next generation.",
  admin: "Command center ready.",
};

export function AppSplash({ onComplete }: { onComplete: () => void }) {
  const [variant, setVariant] = useState<"full" | "brief">("brief");
  const userRole = useAuthStore((state) => state.user?.role);
  const tagline = ROLE_TAGLINES[userRole ?? "student"] ?? ROLE_TAGLINES.student;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const letterOpacity0 = useSharedValue(0);
  const letterOpacity1 = useSharedValue(0);
  const letterOpacity2 = useSharedValue(0);
  const letterOpacity3 = useSharedValue(0);
  const letterOpacity4 = useSharedValue(0);
  const letterOpacity5 = useSharedValue(0);

  const letterTranslate0 = useSharedValue(20);
  const letterTranslate1 = useSharedValue(20);
  const letterTranslate2 = useSharedValue(20);
  const letterTranslate3 = useSharedValue(20);
  const letterTranslate4 = useSharedValue(20);
  const letterTranslate5 = useSharedValue(20);

  const lineScale = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0.4);
  const bgOpacity = useSharedValue(0);
  const counterValue = useSharedValue(0);

  const letterOpacities = [
    letterOpacity0,
    letterOpacity1,
    letterOpacity2,
    letterOpacity3,
    letterOpacity4,
    letterOpacity5,
  ];
  const letterTranslates = [
    letterTranslate0,
    letterTranslate1,
    letterTranslate2,
    letterTranslate3,
    letterTranslate4,
    letterTranslate5,
  ];

  useEffect(() => {
    getSplashVariant().then(setVariant);
  }, []);

  useEffect(() => {
    const baseDelay = variant === "full" ? 200 : 50;
    const stagger = variant === "full" ? 80 : 20;

    bgOpacity.value = withTiming(1, { duration: 300 });

    for (let i = 0; i < NUM_LETTERS; i++) {
      letterOpacities[i].value = withDelay(
        baseDelay + i * stagger,
        withTiming(1, { duration: variant === "full" ? 400 : 150 }),
      );
      letterTranslates[i].value = withDelay(
        baseDelay + i * stagger,
        withSpring(0, { mass: 0.3, damping: 14, stiffness: 180 }),
      );
    }

    const ringStart = baseDelay + NUM_LETTERS * stagger + 100;

    ringScale.value = withDelay(
      ringStart,
      withRepeat(
        withSequence(withTiming(2.5, { duration: 800 }), withTiming(0, { duration: 0 })),
        -1,
        false,
      ),
    );
    ringOpacity.value = withDelay(
      ringStart,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 800 }),
          withTiming(0.4, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );

    lineScale.value = withDelay(ringStart, withTiming(1, { duration: 500 }));
    taglineOpacity.value = withDelay(ringStart + 200, withTiming(1, { duration: 400 }));
    counterValue.value = withDelay(
      0,
      withTiming(100, { duration: variant === "full" ? 1200 : 400 }),
    );

    const duration = variant === "full" ? 1400 : 500;
    const timer = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: lineScale.value }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  const counterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(counterValue.value, [0, 100], [0, 0.5]),
  }));

  const letterStyle0 = useAnimatedStyle(() => ({
    opacity: letterOpacities[0].value,
    transform: [{ translateY: letterTranslates[0].value }],
  }));
  const letterStyle1 = useAnimatedStyle(() => ({
    opacity: letterOpacities[1].value,
    transform: [{ translateY: letterTranslates[1].value }],
  }));
  const letterStyle2 = useAnimatedStyle(() => ({
    opacity: letterOpacities[2].value,
    transform: [{ translateY: letterTranslates[2].value }],
  }));
  const letterStyle3 = useAnimatedStyle(() => ({
    opacity: letterOpacities[3].value,
    transform: [{ translateY: letterTranslates[3].value }],
  }));
  const letterStyle4 = useAnimatedStyle(() => ({
    opacity: letterOpacities[4].value,
    transform: [{ translateY: letterTranslates[4].value }],
  }));
  const letterStyle5 = useAnimatedStyle(() => ({
    opacity: letterOpacities[5].value,
    transform: [{ translateY: letterTranslates[5].value }],
  }));

  const letterStyles = [letterStyle0, letterStyle1, letterStyle2, letterStyle3, letterStyle4, letterStyle5];

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        isLandscape && styles.landscape,
        bgStyle,
      ]}
    >
      {/* Ring pulse */}
      <Animated.View style={[styles.ring, ringStyle]} />

      {/* Wordmark */}
      <View style={styles.wordmark}>
        {LETTERS.map((letter, i) => (
          <Animated.Text key={i} style={[styles.letter, letterStyles[i]]}>
            {letter}
          </Animated.Text>
        ))}
      </View>

      {/* Accent line */}
      <Animated.View style={[styles.accentLine, lineStyle]} />

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, taglineStyle]}>
        {tagline}
      </Animated.Text>

      {/* Counter */}
      <Animated.Text style={[styles.counter, counterStyle]}>
        {Math.round(counterValue.value)}%
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    zIndex: 9999,
  },
  landscape: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.lg,
  },
  ring: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  wordmark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  letter: {
    fontFamily: "CormorantGaramond_700Bold",
    fontSize: 42,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 6,
  },
  accentLine: {
    width: 60,
    height: 1,
    backgroundColor: colors.gold,
    marginVertical: spacing.md,
    transformOrigin: "center",
  },
  tagline: {
    fontFamily: "CormorantGaramond_400Regular",
    fontSize: 15,
    fontStyle: "italic",
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  counter: {
    position: "absolute",
    bottom: spacing.xxl * 2,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textSoft,
  },
});