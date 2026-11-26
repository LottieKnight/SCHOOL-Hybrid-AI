import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, spacing } from "../../src/theme/tokens";
import {
  completeOnboarding,
  type OnboardingModulePlanEntry,
  type OnboardingStudyType,
} from "../../src/lib/api/onboarding";

type Step = 1 | 2 | 3;

function StepPill({ active, label, index }: { active: boolean; label: string; index: number }) {
  return (
    <View style={[styles.stepPill, active && styles.stepPillActive]}>
      <Text style={[styles.stepIndex, active && styles.stepIndexActive]}>{index}</Text>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

function StudyTypeCard({
  title,
  description,
  selected,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  icon: "school-outline" | "library-outline";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.typeCard, selected && styles.typeCardSelected, pressed && styles.typeCardPressed]}
    >
      <View style={styles.typeIcon}>
        <Ionicons name={icon} size={20} color={selected ? colors.goldStrong : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.typeTitle}>{title}</Text>
        <Text style={styles.typeDescription}>{description}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.goldStrong} /> : null}
    </Pressable>
  );
}

function parseDelimitedList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function parseModulePlan(value: string, yearOfStudy: number): OnboardingModulePlanEntry[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line) => {
      const [codePart, namePart] = line.includes("|") ? line.split("|", 2) : line.includes(" - ") ? line.split(" - ", 2) : [line, line];
      const code = codePart.trim().toUpperCase().slice(0, 32);
      const name = (namePart ?? codePart).trim().slice(0, 120);
      return {
        code,
        name,
        yearOfStudy,
        assumed: false,
        source: "mobile",
      };
    })
    .filter((entry) => entry.code.length > 0 && entry.name.length > 0);
}

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>(1);
  const [studyType, setStudyType] = useState<OnboardingStudyType>("school");
  const [grade, setGrade] = useState("12");
  const [phase, setPhase] = useState("");
  const [subjects, setSubjects] = useState("Mathematics, English, Life Orientation");
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [faculty, setFaculty] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("1");
  const [modules, setModules] = useState("EKRP211 | Introduction to Risk Management\nEKIP212 | Investment Principles");
  const [studyStyle, setStudyStyle] = useState<"visual" | "text" | "mixed" | "">("mixed");
  const [bestStudyTime, setBestStudyTime] = useState<"morning" | "afternoon" | "evening" | "night" | "">("afternoon");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studyType === "school") {
      setCourse("");
      setFaculty("");
      setModules("");
    } else {
      setGrade("");
    }
  }, [studyType]);

  const progressPercent = useMemo(() => (step / 3) * 100, [step]);

  const canContinueStep1 = true;
  const canContinueStep2 =
    studyType === "school"
      ? Number.isFinite(Number(grade)) && Number(grade) >= 0 && Number(grade) <= 12
      : institution.trim().length > 1 && course.trim().length > 1 && Number.isFinite(Number(yearOfStudy)) && Number(yearOfStudy) > 0;
  const parsedSubjects = parseDelimitedList(subjects);
  const parsedModules = parseModulePlan(modules, Math.max(1, Number(yearOfStudy) || 1));
  const canSubmit =
    studyType === "school" ? parsedSubjects.length > 0 && canContinueStep2 : parsedModules.length > 0 && canContinueStep2;

  const handleComplete = async () => {
    setError(null);
    setSaving(true);

    try {
      await completeOnboarding(
        studyType === "school"
          ? {
              studyType,
              grade: Number(grade),
              phase: phase.trim() || null,
              subjects: parsedSubjects,
              selectedSubjectLabels: parsedSubjects,
              subjectKeys: parsedSubjects.map((subject) => subject.toLowerCase().replace(/\s+/g, "-")),
              modulePlan: [],
              examDates: [],
              personalisation: {
                studyStyle,
                bestStudyTime,
              },
            }
          : {
              studyType,
              institution: institution.trim(),
              course: course.trim(),
              faculty: faculty.trim() || null,
              yearOfStudy: Number(yearOfStudy),
              subjects: parsedModules.map((entry) => entry.code),
              selectedSubjectLabels: parsedModules.map((entry) => `${entry.code} · ${entry.name}`),
              modulePlan: parsedModules,
              examDates: [],
              academicPeriodType: "semester",
              personalisation: {
                studyStyle,
                bestStudyTime,
              },
            }
      );
      router.replace("/(tabs)");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to complete onboarding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.kicker}>WELCOME</Text>
        <Text style={styles.title}>Tell SCHOOL how you study.</Text>
        <Text style={styles.copy}>We’ll tune the first dashboard and learning path for your institution and course.</Text>
      </View>

      <GlassCard>
        <View style={styles.progressHeader}>
          <Text style={styles.cardTitle}>Setup progress</Text>
          <Text style={styles.progressCopy}>
            Step {step} of 3
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={styles.stepRow}>
          <StepPill active={step === 1} index={1} label="Study type" />
          <StepPill active={step === 2} index={2} label={studyType === "school" ? "Grade" : "Institution"} />
          <StepPill active={step === 3} index={3} label={studyType === "school" ? "Subjects" : "Modules"} />
        </View>
      </GlassCard>

      {step === 1 ? (
        <GlassCard>
          <Text style={styles.cardTitle}>Choose your track</Text>
          <View style={styles.typeList}>
            <StudyTypeCard
              title="School learner"
              description="Pick your grade and subjects. SCHOOL will build your school learning path."
              icon="school-outline"
              selected={studyType === "school"}
              onPress={() => setStudyType("school")}
            />
            <StudyTypeCard
              title="University student"
              description="Enter your institution and modules. SCHOOL will prepare your module journey."
              icon="library-outline"
              selected={studyType === "university"}
              onPress={() => setStudyType("university")}
            />
          </View>
        </GlassCard>
      ) : null}

      {step === 2 ? (
        <GlassCard>
          <Text style={styles.cardTitle}>{studyType === "school" ? "Your grade" : "Your institution"}</Text>
          {studyType === "school" ? (
            <>
              <Text style={styles.fieldLabel}>Grade</Text>
              <TextInput
                keyboardType="number-pad"
                value={grade}
                onChangeText={setGrade}
                placeholder="e.g. 12"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
              />
              <Text style={styles.fieldHint}>If your grade changes later, you can update it in settings.</Text>
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Phase (optional)</Text>
              <TextInput
                value={phase}
                onChangeText={setPhase}
                placeholder="e.g. FET"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Institution</Text>
              <TextInput
                value={institution}
                onChangeText={setInstitution}
                placeholder="e.g. University of Johannesburg"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Course</Text>
              <TextInput
                value={course}
                onChangeText={setCourse}
                placeholder="e.g. Bachelor of Commerce in Accounting"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Faculty (optional)</Text>
              <TextInput
                value={faculty}
                onChangeText={setFaculty}
                placeholder="e.g. Commerce"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Year of study</Text>
              <TextInput
                keyboardType="number-pad"
                value={yearOfStudy}
                onChangeText={setYearOfStudy}
                placeholder="e.g. 1"
                placeholderTextColor={colors.textSoft}
                style={styles.input}
              />
            </>
          )}
        </GlassCard>
      ) : null}

      {step === 3 ? (
        <GlassCard>
          <Text style={styles.cardTitle}>{studyType === "school" ? "Subjects" : "Modules"}</Text>
          <Text style={styles.fieldHint}>
            {studyType === "school"
              ? "Enter one subject per comma or line. Example: Mathematics, English, Life Sciences"
              : "Enter one module per line using CODE | Name. Example: EKRP211 | Introduction to Risk Management"}
          </Text>
          <TextInput
            multiline
            value={studyType === "school" ? subjects : modules}
            onChangeText={studyType === "school" ? setSubjects : setModules}
            placeholder={studyType === "school" ? "Mathematics, English, ..." : "EKRP211 | Introduction to Risk Management"}
            placeholderTextColor={colors.textSoft}
            textAlignVertical="top"
            style={[styles.input, styles.textArea]}
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Study style</Text>
          <View style={styles.choiceRow}>
            {(["mixed", "visual", "text"] as const).map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="button"
                onPress={() => setStudyStyle(choice)}
                style={({ pressed }) => [
                  styles.choiceChip,
                  studyStyle === choice && styles.choiceChipActive,
                  pressed && styles.choiceChipPressed,
                ]}
              >
                <Text style={[styles.choiceText, studyStyle === choice && styles.choiceTextActive]}>
                  {choice.charAt(0).toUpperCase() + choice.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Best study time</Text>
          <View style={styles.choiceRow}>
            {(["afternoon", "morning", "evening", "night"] as const).map((choice) => (
              <Pressable
                key={choice}
                accessibilityRole="button"
                onPress={() => setBestStudyTime(choice)}
                style={({ pressed }) => [
                  styles.choiceChip,
                  bestStudyTime === choice && styles.choiceChipActive,
                  pressed && styles.choiceChipPressed,
                ]}
              >
                <Text style={[styles.choiceText, bestStudyTime === choice && styles.choiceTextActive]}>
                  {choice.charAt(0).toUpperCase() + choice.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {error ? (
        <GlassCard>
          <Text style={styles.errorText}>{error}</Text>
        </GlassCard>
      ) : null}

      <View style={styles.actions}>
        {step > 1 ? (
          <Button
            variant="ghost"
            onPress={() =>
              setStep((current): Step => (current > 1 ? ((current - 1) as Step) : 1))
            }
            style={styles.actionButton}
          >
            Back
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            onPress={() => {
              if ((step === 1 && canContinueStep1) || (step === 2 && canContinueStep2)) {
                setError(null);
                setStep((current): Step => (current < 3 ? ((current + 1) as Step) : 3));
                return;
              }
              setError(studyType === "school" ? "Enter a valid grade." : "Fill in your institution and course.");
            }}
            style={styles.actionButton}
          >
            Continue
          </Button>
        ) : (
          <Button onPress={() => void handleComplete()} disabled={saving || !canSubmit} style={styles.actionButton}>
            {saving ? "Completing..." : "Finish setup"}
          </Button>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  copy: {
    color: colors.textMuted,
    lineHeight: 22,
    fontSize: 15,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  progressCopy: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  stepPill: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: 10,
    gap: 4,
    alignItems: "center",
  },
  stepPillActive: {
    backgroundColor: "rgba(255,215,0,0.1)",
    borderColor: "rgba(255,215,0,0.3)",
  },
  stepIndex: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  stepIndexActive: {
    color: colors.goldStrong,
  },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  stepLabelActive: {
    color: colors.text,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 17,
  },
  typeList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  typeCardSelected: {
    backgroundColor: "rgba(255,215,0,0.1)",
    borderColor: "rgba(255,215,0,0.3)",
  },
  typeCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  typeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  typeDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  fieldLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  fieldHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  textArea: {
    minHeight: 120,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  choiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  choiceChipActive: {
    backgroundColor: "rgba(255,215,0,0.14)",
    borderColor: "rgba(255,215,0,0.4)",
  },
  choiceChipPressed: {
    opacity: 0.9,
  },
  choiceText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  choiceTextActive: {
    color: colors.goldStrong,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
