"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import {
  PROFILE_GRADES,
  PROFILE_ROLES,
  SUBJECT_CHIPS,
  emptyMinimalProfile,
  formatGradeLabel,
  roleLabel,
  skippedMinimalProfile,
  type MinimalProfile,
  type ProfileGrade,
  type ProfileRole,
} from "@/lib/minimalProfile";
import { pushMinimalProfileToAccount } from "@/lib/minimalProfileSync";
import { useMinimalProfile } from "./useMinimalProfile";
import styles from "./minimalProfile.module.css";

function gradeLabel(grade: ProfileGrade) {
  if (grade === "university") return "University";
  if (grade === "R") return "Grade R";
  return `Grade ${grade}`;
}

export function MinimalProfileForm({
  onDone,
  showSkip = true,
}: {
  onDone?: (profile: MinimalProfile) => void;
  showSkip?: boolean;
}) {
  const { session } = useSession();
  const { profile, ready, save } = useMinimalProfile();
  const [draft, setDraft] = useState<MinimalProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setDraft(profile ?? emptyMinimalProfile());
  }, [profile, ready]);

  const persist = async (next: MinimalProfile) => {
    const saved = save({ ...next, updatedAt: new Date().toISOString() });
    setNotice("Saved on this device.");
    onDone?.(saved);
    const { writeFirestoreMinimalProfile } = await import("@/lib/firebaseGoogleAuth");
    await Promise.all([
      pushMinimalProfileToAccount(saved, session),
      writeFirestoreMinimalProfile(saved),
    ]);
  };

  const update = (patch: (current: MinimalProfile) => MinimalProfile) => {
    setDraft((current) => patch(current ?? emptyMinimalProfile()));
  };

  const toggleSubject = (subject: string) => {
    update((current) => {
      const has = current.subjects.includes(subject);
      return {
        ...current,
        subjects: has ? current.subjects.filter((item) => item !== subject) : [...current.subjects, subject].slice(0, 8),
      };
    });
  };

  if (!draft) {
    return <p className={styles.hint}>Loading your profile…</p>;
  }

  return (
    <form
      className={styles.form}
      data-testid="minimal-profile"
      onSubmit={(event) => {
        event.preventDefault();
        void persist({ ...draft, skipped: false });
      }}
    >
      <p className={styles.hint}>
        A name, a role, and a grade are enough. Everything here is optional, and it stays on this device until you sign in.
      </p>
      <label className={styles.field}>
        Display name
        <input
          name="displayName"
          value={draft.displayName}
          placeholder="Nickname, optional"
          autoComplete="nickname"
          maxLength={40}
          onChange={(event) => update((current) => ({ ...current, displayName: event.target.value }))}
        />
      </label>
      <div className={styles.field}>
        <span>Role</span>
        <div className={styles.row} role="group" aria-label="Role">
          {PROFILE_ROLES.map((role) => (
            <button
              key={role}
              className={styles.choice}
              type="button"
              aria-pressed={draft.role === role}
              onClick={() =>
                update((current) => ({
                  ...current,
                  role: role as ProfileRole,
                  grade: role === "university" ? "university" : current.grade === "university" ? "" : current.grade,
                }))
              }
            >
              {roleLabel(role)}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.field}>
        Grade
        <select
          name="grade"
          value={draft.grade}
          onChange={(event) => {
            const grade = event.target.value as ProfileGrade | "";
            update((current) => ({
              ...current,
              grade,
              role: grade === "university" && current.role === "learner" ? "university" : current.role,
            }));
          }}
        >
          <option value="">Skip for now</option>
          {PROFILE_GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {gradeLabel(grade)}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.field}>
        <span>Subjects, if you want them</span>
        <div className={styles.row}>
          {SUBJECT_CHIPS.map((subject) => (
            <button
              key={subject}
              className={styles.chip}
              type="button"
              aria-pressed={draft.subjects.includes(subject)}
              onClick={() => toggleSubject(subject)}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>
      {draft.grade ? <p className={styles.hint}>Learn, past papers, and the tutor will open around {formatGradeLabel(draft.grade)}.</p> : null}
      {notice ? <p className={styles.hint}>{notice}</p> : null}
      <div className={styles.actions}>
        <button className="button" type="submit" disabled={!ready}>
          Save profile
        </button>
        {showSkip ? (
          <button
            className="button"
            type="button"
            onClick={() => {
              const skipped = skippedMinimalProfile();
              void persist(skipped);
            }}
          >
            Skip
          </button>
        ) : null}
      </div>
    </form>
  );
}
