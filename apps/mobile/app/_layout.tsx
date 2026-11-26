import { Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono";
import { queryClient } from "../src/lib/queryClient";
import { useAuthBootstrap } from "../src/hooks/useAuthBootstrap";
import { AIOrb } from "../src/components/assistant/AIOrb";
import { AISheet } from "../src/components/assistant/AISheet";
import { CelebrationOverlay } from "../src/components/gamification/CelebrationOverlay";
import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "../src/theme/tokens";
import { useAuthStore } from "../src/store/authStore";
import { initSentry, Sentry } from "../src/lib/sentry";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { trackScreen } from "../src/lib/analytics";
import { registerForPushNotifications } from "../src/lib/notifications";

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {
  /* native splash may already be hidden */
});

function AppBootstrap() {
  useAuthBootstrap();
  const token = useAuthStore((state) => state.token);
  useEffect(() => {
    if (token) void registerForPushNotifications();
  }, [token]);
  return null;
}

function ScreenTracker() {
  const pathname = usePathname();
  useEffect(() => { trackScreen(pathname); }, [pathname]);
  return null;
}

function RootLayout() {
  const token = useAuthStore((state) => state.token);
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_700Bold,
    IBMPlexMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        /* ignore */
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={styles.root}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AppBootstrap />
          <ScreenTracker />
          <ErrorBoundary>
            <View style={styles.shell}>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
              {token ? (
                <>
                  <AIOrb />
                  <AISheet />
                </>
              ) : null}
              <CelebrationOverlay />
            </View>
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, backgroundColor: colors.background },
});

export default Sentry.wrap(RootLayout);
