"use client";

type SchoolLogoProps = {
  className?: string;
  size?: number;
  shimmer?: boolean;
  variant?: "icon" | "full";
};

export function SchoolLogo({ className, size = 72, variant = "icon" }: SchoolLogoProps) {
  // Using high-prestige logos from the Windows desktop
  const src = variant === "full" ? "/images/school-logo-full.jpeg" : "/images/school-logo.jpeg";
  const height = variant === "full" ? Math.round(size * 1.28) : size;

  return (
    <div
      className={["school-logo", className].filter(Boolean).join(" ")}
      style={{
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        flexShrink: 0,
        display: "inline-flex",
        width: size,
        height: height
      }}
    >
      <img
        src={src}
        alt="SCHOOL logo"
        width={size}
        height={height}
        style={{ display: "block", flexShrink: 0, width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
