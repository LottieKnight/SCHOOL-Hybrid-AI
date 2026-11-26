import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAIStore } from "../../store/aiStore";
import { colors, radius } from "../../theme/tokens";

const TAB_HEIGHT = Platform.OS === "ios" ? 88 : 72;

export function AIOrb() {
  const open = useAIStore((state) => state.open);
  const isLoading = useAIStore((state) => state.isLoading);

  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.25);

  useEffect(() => {
    if (isLoading) {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(0.7, { duration: 700 }), withTiming(0.2, { duration: 700 })),
        -1,
        false,
      );
    } else {
      glowOpacity.value = withTiming(0.25);
    }
  }, [isLoading, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.91, { mass: 0.3, damping: 10, stiffness: 220 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { mass: 0.3, damping: 10, stiffness: 220 });
  };

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    open();
  };

  return (
    <Animated.View style={[styles.wrapper, orbStyle]}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open AI assistant"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.orb}
      >
        <Text style={styles.label}>✦</Text>
      </Pressable>
    </Animated.View>
  );
}

const ORB = 56;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 20,
    bottom: TAB_HEIGHT + 12,
    width: ORB,
    height: ORB,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: ORB + 18,
    height: ORB + 18,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: radius.full,
    backgroundColor: "#0b1629",
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  label: {
    fontSize: 20,
    color: colors.gold,
  },
});
