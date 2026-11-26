import { useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/ui/Button";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Screen } from "../../src/components/ui/Screen";
import { useAuthStore } from "../../src/store/authStore";
import { colors, spacing, radius } from "../../src/theme/tokens";

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <GlassCard>
          <Text style={styles.title}>Sign in</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholderTextColor={colors.textSoft} placeholder="you@example.com" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholderTextColor={colors.textSoft} placeholder="Password" />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            onPress={async () => {
              try {
                setError(null);
                await login({ email, password });
                router.replace("/(tabs)");
              } catch {
                setError("Could not sign in. Check your details and try again.");
              }
            }}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </GlassCard>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: colors.text,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  error: {
    color: colors.red,
    fontSize: 13,
  },
});
