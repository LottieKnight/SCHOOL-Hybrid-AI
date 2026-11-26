"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import PhoneVerificationBanner from "@/components/PhoneVerificationBanner";
import { useSession } from "@/components/SessionProvider";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { COMPLIANCE_NOTICE, PLATFORM_INVARIANT } from "@/lib/tutorCopy";
import styles from "./page.module.css";

type Notice = { type: "success" | "error" | "info"; message: string };

type TutorConfig = {
  minSessionPrice: number;
  commissionRate: number;
};

type SubjectInput = {
  subject: string;
  achievedPercent: string;
  currentlyStudying: boolean;
  professionallyQualified: boolean;
};

type AvailabilityInput = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

const qualificationOptions = [
  { value: "grade_12", label: "Grade 12 graduate" },
  { value: "university_student", label: "University student" },
  { value: "qualified_teacher", label: "Qualified teacher" },
  { value: "retired_educator", label: "Retired educator" },
  { value: "subject_specialist", label: "Subject specialist" },
];

const dayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export default function TutorOnboardingPage() {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [config, setConfig] = useState<TutorConfig | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofFile, setProofFile] = useState<{ url: string; name: string } | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    highestQualification: "",
    qualificationType: "grade_12",
    deliveryMode: "online",
    locationCountry: "",
    locationProvince: "",
    locationCity: "",
    locationAddress: "",
    radiusKm: "10",
    hourlyRate: "",
    bio: "",
  });
  const [subjects, setSubjects] = useState<SubjectInput[]>([
    {
      subject: "",
      achievedPercent: "",
      currentlyStudying: false,
      professionallyQualified: false,
    },
  ]);
  const [availability, setAvailability] = useState<AvailabilityInput[]>([
    { dayOfWeek: "1", startTime: "16:00", endTime: "18:00" },
  ]);
  const requiresPhoneVerification = Boolean(session && !session.user.isPhoneVerified);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${apiBase}/tutors/config`, { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to load tutor configuration.");
        }
        const data = await response.json();
        setConfig({ minSessionPrice: data.minSessionPrice, commissionRate: data.commissionRate });
      } catch (error) {
        setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to load configuration.") });
      }
    })();
  }, [apiBase]);

  const minPrice = config?.minSessionPrice ?? 120;

  const updateSubject = (index: number, patch: Partial<SubjectInput>) => {
    setSubjects((prev) => prev.map((subject, idx) => (idx === index ? { ...subject, ...patch } : subject)));
  };

  const updateAvailability = (index: number, patch: Partial<AvailabilityInput>) => {
    setAvailability((prev) =>
      prev.map((slot, idx) => (idx === index ? { ...slot, ...patch } : slot))
    );
  };

  const handleUpload = async (file: File | null) => {
    if (!file || !session) return;
    if (requiresPhoneVerification) {
      setNotice({ type: "error", message: "Verify your phone before uploading tutor credentials." });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiBase}/tutors/qualification-upload`, {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrf-token": session.csrfToken,
        },
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed.");
      }
      const data = await response.json();
      setProofFile({ url: data.fileUrl, name: data.fileName });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Upload failed.") });
    } finally {
      setUploading(false);
    }
  };

  const validateSubjects = () =>
    subjects.every((subject) => {
      const percent = Number(subject.achievedPercent);
      return (
        (subject.achievedPercent && !Number.isNaN(percent) && percent >= 60) ||
        subject.currentlyStudying ||
        subject.professionallyQualified
      );
    });

  const handleSubmit = async () => {
    setNotice(null);
    if (!session) {
      setNotice({ type: "error", message: "Sign in to complete tutor onboarding." });
      return;
    }
    if (requiresPhoneVerification) {
      setNotice({ type: "error", message: "Verify your phone before submitting tutor onboarding." });
      return;
    }
    if (!proofFile?.url) {
      setNotice({ type: "error", message: "Proof of qualification upload is required." });
      return;
    }
    if (!form.fullName.trim() || !form.highestQualification.trim()) {
      setNotice({ type: "error", message: "Please complete the required fields." });
      return;
    }
    if (!validateSubjects()) {
      setNotice({
        type: "error",
        message: "Each subject must have ≥ 60%, be currently studying, or be professionally qualified.",
      });
      return;
    }
    const hourlyRate = Number(form.hourlyRate);
    if (Number.isNaN(hourlyRate) || hourlyRate < minPrice) {
      setNotice({ type: "error", message: `Minimum hourly rate is R${minPrice}.` });
      return;
    }

    try {
      const response = await fetch(`${apiBase}/tutors/onboard`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          fullName: form.fullName,
          highestQualification: form.highestQualification,
          qualificationType: form.qualificationType,
          proofOfQualificationUrl: proofFile.url,
          proofOfQualificationName: proofFile.name,
          deliveryMode: form.deliveryMode,
          locationCountry: form.locationCountry,
          locationProvince: form.locationProvince,
          locationCity: form.locationCity,
          locationAddress: form.locationAddress,
          radiusKm: Number(form.radiusKm),
          hourlyRate,
          bio: form.bio || undefined,
          subjects: subjects.map((subject) => ({
            subject: subject.subject,
            achievedPercent: subject.achievedPercent ? Number(subject.achievedPercent) : undefined,
            currentlyStudying: subject.currentlyStudying,
            professionallyQualified: subject.professionallyQualified,
          })),
          availability: availability.map((slot) => ({
            dayOfWeek: Number(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
          })),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to submit onboarding.");
      }
      setNotice({ type: "success", message: "Tutor profile saved. You can now manage sessions." });
    } catch (error) {
      setNotice({ type: "error", message: getApiErrorMessage(error, "Unable to submit onboarding.") });
    }
  };

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card card-with-back">
      <RouteHeader
        eyebrow="Tutor Onboarding"
        title="Build a tutor profile that earns trust fast."
        description={`Create your tutor profile and unlock session requests. Minimum hourly rate is R${minPrice}.`}
      >
        <Link className="button" href={requiresPhoneVerification ? "/verify-phone?next=%2Ftutors%2Fdashboard" : "/tutors/dashboard"}>
          Go to dashboard
        </Link>
      </RouteHeader>

      {notice && <div className={`${styles.notice} ${styles[notice.type]}`}>{notice.message}</div>}
      {requiresPhoneVerification ? <PhoneVerificationBanner nextPath="/tutors/onboarding" /> : null}

      {!session && (
        <StateCard title="Sign in required" description="Sign in from the sidebar to complete tutor onboarding." />
      )}

      <div className={styles.section}>
        <h3>Profile</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            Full name
            <input
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="e.g. Thandi Nkosi"
            />
          </label>
          <label className={styles.field}>
            Highest qualification
            <input
              value={form.highestQualification}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, highestQualification: event.target.value }))
              }
              placeholder="e.g. B.Ed, Grade 12"
            />
          </label>
          <label className={styles.field}>
            Qualification type
            <select
              value={form.qualificationType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, qualificationType: event.target.value }))
              }
            >
              {qualificationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Delivery mode
            <select
              value={form.deliveryMode}
              onChange={(event) => setForm((prev) => ({ ...prev, deliveryMode: event.target.value }))}
            >
              <option value="online">Online</option>
              <option value="in_person">In-person</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Proof of qualification</h3>
        <div className={styles.uploadRow}>
          <input
            type="file"
            onChange={(event) => handleUpload(event.target.files?.[0] ?? null)}
            disabled={!session || uploading || requiresPhoneVerification}
          />
          <span>{proofFile ? proofFile.name : "No file uploaded yet"}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Subjects offered</h3>
        {subjects.map((subject, index) => (
          <div className={styles.subjectRow} key={`${subject.subject}-${index}`}>
            <label className={styles.field}>
              Subject
              <input
                value={subject.subject}
                onChange={(event) => updateSubject(index, { subject: event.target.value })}
                placeholder="e.g. Mathematics"
              />
            </label>
            <label className={styles.field}>
              Achieved %
              <input
                type="number"
                min="0"
                max="100"
                value={subject.achievedPercent}
                onChange={(event) => updateSubject(index, { achievedPercent: event.target.value })}
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={subject.currentlyStudying}
                onChange={(event) => updateSubject(index, { currentlyStudying: event.target.checked })}
              />
              Currently studying
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={subject.professionallyQualified}
                onChange={(event) =>
                  updateSubject(index, { professionallyQualified: event.target.checked })
                }
              />
              Professionally qualified
            </label>
          </div>
        ))}
        <button
          className="button"
          type="button"
          onClick={() =>
            setSubjects((prev) => [
              ...prev,
              {
                subject: "",
                achievedPercent: "",
                currentlyStudying: false,
                professionallyQualified: false,
              },
            ])
          }
        >
          Add subject
        </button>
      </div>

      <div className={styles.section}>
        <h3>Availability schedule</h3>
        {availability.map((slot, index) => (
          <div className={styles.availabilityRow} key={`${slot.dayOfWeek}-${index}`}>
            <label className={styles.field}>
              Day
              <select
                value={slot.dayOfWeek}
                onChange={(event) => updateAvailability(index, { dayOfWeek: event.target.value })}
              >
                {dayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Start
              <input
                type="time"
                value={slot.startTime}
                onChange={(event) => updateAvailability(index, { startTime: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              End
              <input
                type="time"
                value={slot.endTime}
                onChange={(event) => updateAvailability(index, { endTime: event.target.value })}
              />
            </label>
          </div>
        ))}
        <button
          className="button"
          type="button"
          onClick={() =>
            setAvailability((prev) => [
              ...prev,
              { dayOfWeek: "1", startTime: "16:00", endTime: "18:00" },
            ])
          }
        >
          Add slot
        </button>
      </div>

      <div className={styles.section}>
        <h3>Location & pricing</h3>
        <div className={styles.grid}>
          <label className={styles.field}>
            Country
            <input
              value={form.locationCountry}
              onChange={(event) => setForm((prev) => ({ ...prev, locationCountry: event.target.value }))}
            />
          </label>
          <label className={styles.field}>
            Province
            <input
              value={form.locationProvince}
              onChange={(event) => setForm((prev) => ({ ...prev, locationProvince: event.target.value }))}
            />
          </label>
          <label className={styles.field}>
            City
            <input
              value={form.locationCity}
              onChange={(event) => setForm((prev) => ({ ...prev, locationCity: event.target.value }))}
            />
          </label>
          <label className={styles.field}>
            Radius (km)
            <input
              type="number"
              min="0"
              value={form.radiusKm}
              onChange={(event) => setForm((prev) => ({ ...prev, radiusKm: event.target.value }))}
            />
          </label>
          <label className={styles.field}>
            Hourly rate (R)
            <input
              type="number"
              min={minPrice}
              value={form.hourlyRate}
              onChange={(event) => setForm((prev) => ({ ...prev, hourlyRate: event.target.value }))}
            />
          </label>
          <label className={styles.field}>
            Address / suburb
            <input
              value={form.locationAddress}
              onChange={(event) => setForm((prev) => ({ ...prev, locationAddress: event.target.value }))}
            />
          </label>
        </div>
        <label className={styles.field}>
          Short bio (optional)
          <textarea
            rows={3}
            value={form.bio}
            onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button className="button" type="button" onClick={handleSubmit} disabled={uploading || requiresPhoneVerification}>
          Save tutor profile
        </button>
      </div>

      <div className={styles.legal}>
        <p className={styles.legalLine}>{PLATFORM_INVARIANT}</p>
        <ul>
          {COMPLIANCE_NOTICE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}
