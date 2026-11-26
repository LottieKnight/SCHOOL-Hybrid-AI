import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { Button } from "../../src/components/ui/Button";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Screen } from "../../src/components/ui/Screen";
import { colors, spacing } from "../../src/theme/tokens";

export default function WelcomeScreen() {
  const brandOpacity = useSharedValue(0);
  const brandTranslate = useSharedValue(24);
  const brandScale = useSharedValue(1.06);
  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(30);
  const copyOpacity = useSharedValue(0);
  const copyTranslate = useSharedValue(24);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardTitleOpacity = useSharedValue(0);
  const cardCopyOpacity = useSharedValue(0);
  const btn1Opacity = useSharedValue(0);
  const btn1Translate = useSharedValue(30);
  const btn2Opacity = useSharedValue(0);
  const btn2Translate = useSharedValue(30);

  useEffect(() => {
    brandOpacity.value = withTiming(1, { duration: 350 });
    brandTranslate.value = withSpring(0, { mass: 0.3, damping: 14, stiffness: 180 });
    brandScale.value = withSpring(1, { mass: 0.3, damping: 12, stiffness: 200 });

    titleOpacity.value = withDelay(80, withTiming(1, { duration: 350 }));
    titleTranslate.value = withDelay(80, withSpring(0, { mass: 0.3, damping: 12, stiffness: 180 }));

    copyOpacity.value = withDelay(160, withTiming(1, { duration: 300 }));
    copyTranslate.value = withDelay(160, withTiming(0, { duration: 300 }));

    cardOpacity.value = withDelay(240, withTiming(1, { duration: 350 }));
    cardScale.value = withDelay(240, withSpring(1, { mass: 0.3, damping: 14, stiffness: 200 }));

    cardTitleOpacity.value = withDelay(320, withTiming(1, { duration: 250 }));
    cardCopyOpacity.value = withDelay(380, withTiming(1, { duration: 250 }));

    btn1Opacity.value = withDelay(440, withTiming(1, { duration: 250 }));
    btn1Translate.value = withDelay(440, withSpring(0, { mass: 0.3, damping: 13, stiffness: 180 }));

    btn2Opacity.value = withDelay(500, withTiming(1, { duration: 250 }));
    btn2Translate.value = withDelay(500, withSpring(0, { mass: 0.3, damping: 13, stiffness: 180 }));
  }, [
    brandOpacity,
    brandTranslate,
    brandScale,
    titleOpacity,
    titleTranslate,
    copyOpacity,
    copyTranslate,
    cardOpacity,
    cardScale,
    cardTitleOpacity,
    cardCopyOpacity,
    btn1Opacity,
    btn1Translate,
    btn2Opacity,
    btn2Translate,
  ]);

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslate.value }, { scale: brandScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslate.value }],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    transform: [{ translateY: copyTranslate.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));
  const cardTitleStyle = useAnimatedStyle(() => ({ opacity: cardTitleOpacity.value }));
  const cardCopyStyle = useAnimatedStyle(() => ({ opacity: cardCopyOpacity.value }));
  const btn1Style = useAnimatedStyle(() => ({
    opacity: btn1Opacity.value,
    transform: [{ translateY: btn1Translate.value }],
  }));
  const btn2Style = useAnimatedStyle(() => ({
    opacity: btn2Opacity.value,
    transform: [{ translateY: btn2Translate.value }],
  }));

  return (
    <Screen scroll>
      <Animated.View style={[styles.hero, brandStyle]}>
        <Text style={styles.brand}>SCHOOL</Text>
      </Animated.View>
      <Animated.View style={titleStyle}>
        <Text style={styles.title}>Study that feels native to your phone.</Text>
      </Animated.View>
      <Animated.View style={copyStyle}>
        <Text style={styles.copy}>
          Learn, practice, and keep moving without the desktop sidebar getting in the way.
        </Text>
      </Animated.View>

      <Animated.View style={cardStyle}>
        <GlassCard>
          <Animated.View style={cardTitleStyle}>
            <Text style={styles.cardTitle}>Built for one hand</Text>
          </Animated.View>
          <Animated.View style={cardCopyStyle}>
            <Text style={styles.cardCopy}>
              Clear cards, bottom navigation, and quick chapter access on iPhone 12 class devices and Android 12+.
            </Text>
          </Animated.View>
        </GlassCard>
      </Animated.View>

      <Animated.View style={[styles.actions, btn1Style]}>
        <Button onPress={() => router.push("/(auth)/login")}>Sign in</Button>
      </Animated.View>
      <Animated.View style={btn2Style}>
        <Button variant="ghost" onPress={() => router.push("/(auth)/register")}>
          Create account
        </Button>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  brand: {
    color: colors.gold,
    letterSpacing: 4,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
  },
  copy: {
    color: colors.textMuted,
    lineHeight: 22,
    fontSize: 15,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 17,
  },
  cardCopy: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
