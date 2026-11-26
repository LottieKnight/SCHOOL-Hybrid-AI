"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useSession } from "./SessionProvider";
import styles from "./SignupForm.module.css";

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type SchoolOption = {
  id: string;
  name: string;
  country: string;
  province: string | null;
  city: string | null;
};

type CountryCodeOption = {
  name: string;
  dial: string;
  code: string;
  flag: string;
};

const COUNTRY_CODES: CountryCodeOption[] = [
  { name: "South Africa", dial: "+27", code: "ZA", flag: "🇿🇦" },
  { name: "United States", dial: "+1", code: "US", flag: "🇺🇸" },
  { name: "Canada", dial: "+1", code: "CA", flag: "🇨🇦" },
  { name: "United Kingdom", dial: "+44", code: "GB", flag: "🇬🇧" },
  { name: "India", dial: "+91", code: "IN", flag: "🇮🇳" },
  { name: "Nigeria", dial: "+234", code: "NG", flag: "🇳🇬" },
  { name: "Kenya", dial: "+254", code: "KE", flag: "🇰🇪" },
  { name: "Zambia", dial: "+260", code: "ZM", flag: "🇿🇲" },
  { name: "Zimbabwe", dial: "+263", code: "ZW", flag: "🇿🇼" },
  { name: "Botswana", dial: "+267", code: "BW", flag: "🇧🇼" },
  { name: "Namibia", dial: "+264", code: "NA", flag: "🇳🇦" },
  { name: "Egypt", dial: "+20", code: "EG", flag: "🇪🇬" },
  { name: "Germany", dial: "+49", code: "DE", flag: "🇩🇪" },
  { name: "France", dial: "+33", code: "FR", flag: "🇫🇷" },
  { name: "Australia", dial: "+61", code: "AU", flag: "🇦🇺" },
  { name: "Japan", dial: "+81", code: "JP", flag: "🇯🇵" },
  { name: "Singapore", dial: "+65", code: "SG", flag: "🇸🇬" },
  { name: "United Arab Emirates", dial: "+971", code: "AE", flag: "🇦🇪" },
  { name: "Saudi Arabia", dial: "+966", code: "SA", flag: "🇸🇦" },
  { name: "New Zealand", dial: "+64", code: "NZ", flag: "🇳🇿" },
  { name: "Brazil", dial: "+55", code: "BR", flag: "🇧🇷" },
  { name: "Mexico", dial: "+52", code: "MX", flag: "🇲🇽" },
  { name: "Spain", dial: "+34", code: "ES", flag: "🇪🇸" },
  { name: "Italy", dial: "+39", code: "IT", flag: "🇮🇹" },
];

type SignupFormProps = {
  onSuccess?: () => void;
  redirectTo?: string | null;
  referralCode?: string | null;
};

function scorePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (pw.length < 8) return 0;
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

export function SignupForm({ onSuccess, redirectTo, referralCode }: SignupFormProps) {
  const router = useRouter();
  const { refresh } = useSession();
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [showPassword, setShowPassword] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);
  const [countryCode, setCountryCode] = useState("+27");
  const [countryCodeQuery, setCountryCodeQuery] = useState("+27 South Africa");
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  const [countryCodeFocused, setCountryCodeFocused] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentalConsentAcknowledged, setParentalConsentAcknowledged] = useState(false);
  const apiBase = API_BASE;

  const selectedCountryOption = useMemo(
    () => COUNTRY_CODES.find((option) => option.dial === countryCode),
    [countryCode]
  );

  const filteredCountryCodes = useMemo(() => {
    const query = countryCodeQuery.replace(/[^a-zA-Z0-9+]/g, " ").trim().toLowerCase();
    if (!query) return COUNTRY_CODES;
    return COUNTRY_CODES.filter((option) => {
      return (
        option.name.toLowerCase().includes(query) ||
        option.dial.includes(query) ||
        option.code.toLowerCase().includes(query)
      );
    });
  }, [countryCodeQuery]);

  const age = useMemo(() => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    return (
      today.getFullYear() - dob.getFullYear() -
      (today.getMonth() < dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
        ? 1 : 0)
    );
  }, [dateOfBirth]);

  const isMinor = age !== null && age < 18;
  const isTooYoung = age !== null && age < 13;

  useEffect(() => {
    const selected = COUNTRY_CODES.find((option) => option.dial === countryCode);
    if (selected && !countryCodeQuery) {
      setCountryCodeQuery(`${selected.dial} ${selected.name}`);
    }
    if (selected && selected.name !== country) {
      setCountry(selected.name);
    }
  }, [countryCode, countryCodeQuery, country]);

  useEffect(() => {
    if (!schoolQuery.trim()) {
      setSchoolOptions([]);
      setSelectedSchool(null);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setSchoolLoading(true);
      try {
        const queryParams = new URLSearchParams({
          q: schoolQuery.trim(),
          limit: "15",
        });
        if (country.trim()) queryParams.set("country", country.trim());
        if (province.trim()) queryParams.set("province", province.trim());
        if (city.trim()) queryParams.set("city", city.trim());

        const response = await fetch(`${apiBase}/schools?${queryParams.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Unable to load schools.");
        }
        const data = (await response.json()) as { schools: SchoolOption[] };
        setSchoolOptions(data.schools || []);
      } catch {
        setSchoolOptions([]);
      } finally {
        setSchoolLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [apiBase, city, country, province, schoolQuery]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isTooYoung) {
      setStatus({ type: "error", message: "Users under 13 may not register in accordance with POPIA §35." });
      return;
    }
    if (isMinor && !parentalConsentAcknowledged) {
      setStatus({ type: "error", message: "Parental consent is required for users under 18." });
      return;
    }
    if (isMinor && !parentEmail.trim()) {
      setStatus({ type: "error", message: "A parent or guardian email address is required for users under 18." });
      return;
    }

    setStatus({ type: "loading" });
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, unknown> = {
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      phone: `${countryCode} ${phoneLocal}`.trim(),
      email: String(formData.get("email") || "").trim(),
      password: String(formData.get("password") || ""),
      country: country.trim(),
      province: province.trim(),
      city: city.trim(),
      schoolId: selectedSchool?.id,
    };
    if (dateOfBirth) payload.dateOfBirth = dateOfBirth;
    if (isMinor) {
      payload.parentalConsentAcknowledged = parentalConsentAcknowledged;
      payload.parentEmail = parentEmail.trim();
    }
    if (referralCode?.trim()) {
      payload.referralCode = referralCode.trim().toUpperCase();
    }

    try {
      const response = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await refresh().catch(() => null);
        setStatus({ type: "success", message: "Welcome! Your account is ready." });
        form.reset();
        setSchoolQuery("");
        setSelectedSchool(null);
        setSchoolOptions([]);
        setCountryCode("+27");
        setCountryCodeQuery("+27 South Africa");
        setPhoneLocal("");
        setCountry("South Africa");
        setProvince("");
        setCity("");
        setDateOfBirth("");
        setParentEmail("");
        setParentalConsentAcknowledged(false);
        onSuccess?.();
        const onboardingTarget = redirectTo
          ? `/onboarding?returnUrl=${encodeURIComponent(redirectTo)}`
          : "/onboarding";
        router.push(onboardingTarget);
        router.refresh();
        return;
      }

      if (response.status === 409) {
        setStatus({ type: "error", message: "This email is already registered." });
        return;
      }

      const errorBody = await response.json().catch(() => null);
      setStatus({
        type: "error",
        message: errorBody?.error || "Something went wrong. Please try again.",
      });
    } catch (error) {
      setStatus({ type: "error", message: getApiErrorMessage(error, "Please try again.") });
    }
  };

  const findSchoolsNearMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setSchoolLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const queryParams = new URLSearchParams({
            lat: latitude.toString(),
            lng: longitude.toString(),
            radius: "20",
            limit: "10",
          });
          const response = await fetch(`${apiBase}/schools?${queryParams.toString()}`);
          if (!response.ok) throw new Error();
          const data = await response.json();
          setSchoolOptions(data.schools || []);
          if (data.schools?.length > 0) {
            setSchoolQuery(""); // Clear text query to show list
          }
        } catch {
          alert("Unable to find schools near you.");
        } finally {
          setSchoolLoading(false);
        }
      },
      () => {
        setSchoolLoading(false);
        alert("Permission denied or location unavailable.");
      }
    );
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="firstName">
          Name
        </label>
        <input
          className={styles.input}
          id="firstName"
          name="firstName"
          type="text"
          placeholder="e.g. Thandi"
          required
          autoComplete="given-name"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="lastName">
          Surname
        </label>
        <input
          className={styles.input}
          id="lastName"
          name="lastName"
          type="text"
          placeholder="e.g. Nkosi"
          required
          autoComplete="family-name"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="dateOfBirth">
          Date of birth
        </label>
        <input
          className={styles.input}
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          autoComplete="bday"
        />
        {isTooYoung && (
          <span className={styles.helper} style={{ color: "var(--red)" }}>
            Users under 13 may not register in accordance with POPIA §35.
          </span>
        )}
      </div>
      {isMinor && !isTooYoung && (
        <div className={styles.parentalSection}>
          <div className={styles.formRow}>
            <label className={styles.label} htmlFor="parentEmail">
              Parent / guardian email address
            </label>
            <input
              className={styles.input}
              id="parentEmail"
              name="parentEmail"
              type="email"
              placeholder="e.g. parent@email.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              required
              inputMode="email"
              autoComplete="off"
            />
            <span className={styles.helper}>
              A consent email will be sent to this address.
            </span>
          </div>
          <div className={styles.consentRow}>
            <input
              id="parentalConsent"
              type="checkbox"
              checked={parentalConsentAcknowledged}
              onChange={(e) => setParentalConsentAcknowledged(e.target.checked)}
              required
            />
            <label htmlFor="parentalConsent">
              I confirm that my parent or guardian is aware of and consents to my registration on SCHOOL.
            </label>
          </div>
        </div>
      )}
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="phone">
          Cellphone number
        </label>
        <div className={styles.phoneRow}>
          <div className={styles.codePicker}>
            <input
              className={`${styles.input} ${styles.codeInput}`}
              aria-label="Country code"
              value={countryCodeFocused ? countryCodeQuery : countryCode}
              onChange={(event) => {
                setCountryCodeQuery(event.target.value);
                setCountryCodeOpen(true);
              }}
              onFocus={() => {
                setCountryCodeFocused(true);
                setCountryCodeOpen(true);
                setCountryCodeQuery((prev) => (prev ? prev : countryCode));
              }}
              onBlur={() => {
                setTimeout(() => {
                  setCountryCodeOpen(false);
                  setCountryCodeFocused(false);
                  setCountryCodeQuery(countryCode);
                }, 120);
              }}
              placeholder="+27"
              inputMode="tel"
            />
            <span className={styles.codeChevron} aria-hidden="true" />
            <span className={styles.codeFlag} aria-hidden="true">
              {selectedCountryOption?.flag ?? "🌍"}
            </span>
            {countryCodeOpen && (
              <div className={styles.codeDropdown}>
                {filteredCountryCodes.map((option) => (
                  <button
                    key={`${option.code}-${option.dial}`}
                    type="button"
                    className={styles.dropdownItem}
                    onMouseDown={() => {
                      setCountryCode(option.dial);
                      setCountryCodeQuery(`${option.dial} ${option.name}`);
                      setCountry(option.name);
                      setCountryCodeOpen(false);
                      setCountryCodeFocused(false);
                    }}
                  >
                    <span className={styles.codeFlag}>{option.flag}</span>
                    <span className={styles.codeName}>{option.name}</span>
                    <span className={styles.codeDial}>{option.dial}</span>
                  </button>
                ))}
                {filteredCountryCodes.length === 0 && (
                  <span className={styles.helper}>No matches found.</span>
                )}
              </div>
            )}
          </div>
          <input
            className={`${styles.input} ${styles.phoneInput}`}
            id="phone"
            name="phone"
            type="tel"
            placeholder="e.g. 82 123 4567"
            value={phoneLocal}
            onChange={(event) => setPhoneLocal(event.target.value)}
            required
            inputMode="tel"
            autoComplete="tel-national"
          />
        </div>
      </div>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="province">
          Province / State
        </label>
        <input
          className={styles.input}
          id="province"
          name="province"
          type="text"
          placeholder="e.g. Gauteng"
          value={province}
          onChange={(event) => setProvince(event.target.value)}
          required
          autoComplete="address-level1"
        />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="city">
          City
        </label>
        <input
          className={styles.input}
          id="city"
          name="city"
          type="text"
          placeholder="e.g. Johannesburg"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          required
          autoComplete="address-level2"
        />
      </div>
      <div className={styles.formRow}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className={styles.label} htmlFor="schoolSearch">
            School (search and select)
          </label>
          <button
            type="button"
            onClick={findSchoolsNearMe}
            style={{
              fontSize: "11px",
              color: "var(--gold)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            📍 Find near me
          </button>
        </div>
        <input
          className={styles.input}
          id="schoolSearch"
          name="schoolSearch"
          type="text"
          placeholder="Start typing your school name"
          value={schoolQuery}
          onChange={(event) => {
            setSchoolQuery(event.target.value);
            setSelectedSchool(null);
          }}
          autoComplete="off"
        />
        {schoolLoading && <span className={styles.helper}>Searching schools...</span>}
        {!schoolLoading && schoolQuery && schoolOptions.length > 0 && (
          <div className={styles.dropdown}>
            {schoolOptions.map((school) => (
              <button
                key={school.id}
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setSelectedSchool(school);
                  setSchoolQuery(school.name);
                  setSchoolOptions([]);
                }}
              >
                <strong>{school.name}</strong>
                <span>
                  {school.city ? `${school.city}, ` : ""}
                  {school.province ? `${school.province}, ` : ""}
                  {school.country}
                </span>
              </button>
            ))}
          </div>
        )}
        {schoolQuery && !schoolLoading && schoolOptions.length === 0 && (
          <span className={styles.helper}>No schools found yet. Try a shorter name.</span>
        )}
      </div>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="password">
          Create a password
        </label>
        <div style={{ position: "relative" }}>
          <input
            className={styles.input}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Minimum 8 characters"
            minLength={8}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ paddingRight: "42px", width: "100%", boxSizing: "border-box" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "2px", display: "flex", alignItems: "center" }}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            )}
          </button>
        </div>
        {password.length > 0 && (() => {
          const score = scorePassword(password);
          return (
            <div style={{ marginTop: "6px" }}>
              <div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
                {[1, 2, 3, 4].map((bar) => (
                  <div
                    key={bar}
                    style={{
                      flex: 1, height: "4px", borderRadius: "2px",
                      background: score >= bar ? STRENGTH_COLORS[score] : "var(--border, #333)",
                      transition: "background 0.2s",
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: "11px", color: STRENGTH_COLORS[score] }}>
                {STRENGTH_LABELS[score]}
              </span>
            </div>
          );
        })()}
      </div>
      <div className={styles.formRow}>
        <label className={styles.label} htmlFor="email">
          Email address
        </label>
        <input
          className={styles.input}
          id="email"
          name="email"
          type="email"
          placeholder="e.g. you@email.com"
          required
          inputMode="email"
          autoComplete="email"
        />
      </div>
      <button className="button" type="submit" disabled={status.type === "loading"}>
        {status.type === "loading" ? "Creating account..." : "Create account"}
      </button>
      {status.type === "success" && <p className={styles.success}>{status.message}</p>}
      {status.type === "error" && <p className={styles.error}>{status.message}</p>}
    </form>
  );
}
