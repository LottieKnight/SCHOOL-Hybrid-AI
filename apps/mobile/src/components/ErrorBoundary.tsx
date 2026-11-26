import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Sentry } from "../lib/sentry";
import { colors } from "../theme/tokens";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Your progress is saved.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => this.setState({ hasError: false })}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  body: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  button: {
    backgroundColor: colors.gold,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  buttonText: { color: colors.background, fontWeight: "700", fontSize: 15 },
});
