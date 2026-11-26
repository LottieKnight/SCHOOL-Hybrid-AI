import { useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../src/components/ui/Button";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Screen } from "../../src/components/ui/Screen";
import { useAuthStore } from "../../src/store/authStore";
import { colors, spacing, radius } from "../../src/theme/tokens";

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <GlassCard>
          <Text style={styles.title}>Create account</Text>
          {(Object.keys(form) as (keyof typeof form)[]).map((field) => (
            <View key={field} style={styles.field}>
              <Text style={styles.label}>{field}</Text>
              <TextInput
                autoCapitalize={field === "email" ? "none" : "words"}
                keyboardType={field === "phone" ? "phone-pad" : "default"}
                secureTextEntry={field === "password"}
                value={form[field]}
                onChangeText={(value) => update(field, value)}
                style={styles.input}
                placeholderTextColor={colors.textSoft}
                placeholder={field}
              />
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            onPress={async () => {
              try {
                setError(null);
                await register(form);
                router.replace("/(tabs)");
              } catch {
                setError("Could not create your account. Please check the form and try again.");
              }
            }}
          >
            {isLoading ? "Creating..." : "Create account"}
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
    textTransform: "capitalize",
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
