import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { colors } from "../../src/theme/tokens";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function icon(name: IoniconName, activeName: IoniconName) {
  function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Ionicons name={focused ? activeName : name} size={size - 2} color={color as string} />;
  }
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  const tabBarTranslateY = useSharedValue(88);

  useEffect(() => {
    tabBarTranslateY.value = withDelay(
      200,
      withSpring(0, { mass: 0.3, damping: 20, stiffness: 180 }),
    );
  }, [tabBarTranslateY]);

  const tabBarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: "rgba(238,240,255,0.45)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarStyle: [
          {
            position: "absolute",
            borderTopWidth: 0,
            backgroundColor: "rgba(7,16,31,0.78)",
            elevation: 0,
            height: Platform.OS === "ios" ? 88 : 72,
          },
          tabBarAnimatedStyle,
        ],
        tabBarBackground: () => <BlurView intensity={50} tint="dark" style={{ flex: 1 }} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home-outline", "home") }} />
      <Tabs.Screen name="learn" options={{ title: "Learn", tabBarIcon: icon("book-outline", "book") }} />
      <Tabs.Screen name="practice" options={{ title: "Practice", tabBarIcon: icon("flash-outline", "flash") }} />
      <Tabs.Screen name="community" options={{ title: "Community", tabBarIcon: icon("people-outline", "people") }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon("person-outline", "person") }} />
    </Tabs>
  );
}
