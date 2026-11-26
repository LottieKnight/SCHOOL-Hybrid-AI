import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAIStore } from "../../store/aiStore";
import { colors, radius, spacing } from "../../theme/tokens";

const SNAP_POINTS = ["55%", "92%"];

const SUGGESTIONS = [
  "Explain risk appetite vs tolerance",
  "Summarise ISO 31000 steps",
  "Compare King IV and King III",
  "What is operational risk?",
];

export function AISheet() {
  const { isOpen, close, messages, addMessage, setLoading, isLoading, context } = useAIStore();
  const sheetRef = useRef<BottomSheet>(null);
  const [draft, setDraft] = useState("");

  const snapPoints = useMemo(() => SNAP_POINTS, []);

  useEffect(() => {
    if (isOpen) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1) close();
    },
    [close],
  );

  const renderBackdrop = useCallback(
    (props: Parameters<typeof BottomSheetBackdrop>[0]) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.55} />
    ),
    [],
  );

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isLoading) return;
    setDraft("");
    addMessage({ role: "user", content: question });
    setLoading(true);
    try {
      const webBase =
        process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za";
      const res = await fetch(`${webBase}/api/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, context: context ?? undefined }),
      });
      if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
      const data = (await res.json()) as { reply?: string; error?: string };
      addMessage({ role: "assistant", content: data.reply ?? "I could not get a response." });
    } catch {
      addMessage({ role: "assistant", content: "Network error — check your connection." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleChange}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.header}>
        <Text style={styles.title}>✦ Ask SCHOOL</Text>
        {context ? <Text style={styles.contextBadge}>{context.slice(0, 40)}</Text> : null}
      </View>

      <BottomSheetScrollView
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => void send(s)} style={styles.pill}>
                <Text style={styles.pillText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.aiBubble]}
          >
            <Text style={msg.role === "user" ? styles.userText : styles.aiText}>
              {msg.content}
            </Text>
          </View>
        ))}

        {isLoading && (
          <View style={[styles.bubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        )}
      </BottomSheetScrollView>

      <View style={styles.inputRow}>
        <BottomSheetTextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about this chapter..."
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => void send(draft)}
        />
        <Pressable
          onPress={() => void send(draft)}
          disabled={!draft.trim() || isLoading}
          style={[styles.sendBtn, (!draft.trim() || isLoading) && styles.sendDisabled]}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: "#0c1628",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.15)",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 40,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  title: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  contextBadge: {
    color: colors.textSoft,
    fontSize: 11,
    fontStyle: "italic",
  },
  messages: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  suggestions: {
    gap: spacing.sm,
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.gold,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  userText: {
    color: colors.backgroundDeep,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  aiText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: {
    opacity: 0.35,
  },
  sendIcon: {
    color: colors.backgroundDeep,
    fontSize: 20,
    fontWeight: "900",
  },
});
