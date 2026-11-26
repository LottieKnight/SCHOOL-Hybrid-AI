import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../src/components/ui/Screen";
import { colors, radius, spacing } from "../src/theme/tokens";

const webBase =
  (Constants.expoConfig?.extra as { webBaseUrl?: string } | undefined)?.webBaseUrl ??
  process.env.EXPO_PUBLIC_WEB_BASE_URL ??
  "https://school.ditshego-ventures.co.za";

const steps = [
  "Open the tutor in Chrome. Gemini Nano only exists in Chrome, not in an in-app WebView.",
  "Tap Enable on-device AI once. That downloads the model from a button press.",
  "Photograph a question or type it. The first hint stays on the phone.",
];

function tutorHttpsUrl() {
  return `${webBase.replace(/\/$/, "")}/tutor`;
}

/** Android intent that prefers Chrome, where the Prompt API can run. */
function chromeIntentUrl(httpsUrl: string) {
  const withoutScheme = httpsUrl.replace(/^https:\/\//, "");
  const fallback = encodeURIComponent(httpsUrl);
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

export default function MobileTutorScreen() {
  const [note, setNote] = useState<string | null>(null);
  const href = tutorHttpsUrl();

  async function openTutor() {
    setNote(null);
    const target = Platform.OS === "android" ? chromeIntentUrl(href) : href;
    try {
      const supported = await Linking.canOpenURL(target);
      await Linking.openURL(supported ? target : href);
      setNote("Chrome is opening the tutor. The first hint can run on this phone.");
    } catch {
      try {
        await Linking.openURL(href);
        setNote("Opened the tutor in the default browser. Use Chrome for on-device answers.");
      } catch {
        setNote("Could not open the tutor. Check that a browser is installed, then try again.");
      }
    }
  }

  return (
    <Screen scroll>
      <View style={styles.wrap}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.kicker}>Grade 10–12 · CAPS</Text>
        <Text style={styles.title}>Hybrid tutor</Text>
        <Text style={styles.body}>
          Hints prefer this phone, so a weak signal does not spend airtime. Long answers and PDF papers use the cloud.
        </Text>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <Pressable accessibilityRole="button" onPress={() => void openTutor()} style={styles.button}>
          <Text style={styles.buttonText}>Start tutor in Chrome</Text>
        </Pressable>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <Text style={styles.fine}>
          An in-app WebView cannot run Gemini Nano. Chrome is the on-device engine. If Chrome is missing, the same page opens in another browser and cloud Gemini is the fallback.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  backText: { color: colors.gold, fontSize: 16, fontWeight: "700" },
  kicker: { color: colors.gold, fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 32, fontWeight: "700" },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  step: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stepIndex: { color: colors.gold, fontSize: 18, fontWeight: "700", width: 24 },
  stepText: { color: colors.text, fontSize: 16, lineHeight: 22, flex: 1 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
  },
  buttonText: { color: "#0a0a0a", fontSize: 17, fontWeight: "700" },
  note: { color: colors.text, fontSize: 16, lineHeight: 22 },
  fine: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
});
