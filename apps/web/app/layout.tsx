import "./globals.css";
import "./shell-entry.css";
import "./nav-shell.css";
import "./amapiano-old-money-overrides.css";
import "./ditshego-design-system.css";
import type { CSSProperties, ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";

import { ApiConnectivityBanner } from "@/components/ApiConnectivityBanner";
import { LiteModeNotice } from "@/components/LiteModeNotice";
import { InstitutionThemeSync } from "@/components/InstitutionThemeSync";
import { LegacyLearnNotice } from "@/components/LegacyLearnNotice";
import { PhaseThemeSync } from "@/components/PhaseThemeSync";
import { ProfilePreferencesOnboardingPrompt } from "@/components/ProfilePreferencesOnboardingPrompt";
import { UsernameClaimPrompt } from "@/components/UsernameClaimPrompt";
import { ResponseJsonSafetyPatch } from "@/components/ResponseJsonSafetyPatch";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppSplash } from "@/components/AppSplash";
import { SessionProvider } from "@/components/SessionProvider";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { ShellLayout } from "@/components/ShellLayout";
import { ThemeLoader } from "@/components/ThemeLoader";
import { initSentry } from "@/lib/sentry";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

initSentry();

// Ditshego Ventures house type, fully self-hosted via next/font/local from the
// committed variable woff2 files (app/fonts/). No build-time or runtime network —
// CSP-safe, offline-first, and works in build environments without internet
// (next/font/google would fetch from Google at build, which fails on such hosts).
// Playfair Display = editorial display serif; Archivo = UI/body workhorse;
// JetBrains Mono = data. weight ranges drive the variable axes.
const playfair = localFont({
  src: [
    { path: "./fonts/playfair-normal.woff2", weight: "400 900", style: "normal" },
    { path: "./fonts/playfair-italic.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-playfair",
  display: "swap",
});
const archivo = localFont({
  src: "./fonts/archivo-normal.woff2",
  weight: "300 900",
  variable: "--font-archivo",
  display: "swap",
});
const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-normal.woff2",
  weight: "400 700",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const brandFontClassName = `${playfair.variable} ${archivo.variable} ${jetbrainsMono.variable}`;

// Point the app's legacy font-var names at the Ditshego house families loaded via
// next/font above. These are set inline on <html>, so they win the cascade and feed
// globals.css's --font-display / --font-body (and the learn-theme serifs) directly.
const rootFontVariables: CSSProperties = {
  ["--font-geist" as string]: "var(--font-archivo), system-ui, sans-serif",
  ["--font-cormorant-garamond" as string]: "var(--font-playfair), Georgia, serif",
};

const metadataBase =
  process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim().length > 0
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : process.env.VERCEL_URL && process.env.VERCEL_URL.trim().length > 0
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  applicationName: "SCHOOL",
  title: {
    default: "SCHOOL",
    template: "%s | SCHOOL",
  },
  description:
    "SCHOOL is an education platform for CAPS-aligned learning, past papers, and digital-access-first tools.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "SCHOOL",
    title: "SCHOOL",
    description:
      "SCHOOL is an education platform for CAPS-aligned learning, past papers, and digital-access-first tools.",
    url: "/",
    images: [
      {
        url: "/images/icons/og-image.png",
        width: 1200,
        height: 630,
        alt: "SCHOOL learning platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SCHOOL",
    description:
      "SCHOOL is an education platform for CAPS-aligned learning, past papers, and digital-access-first tools.",
    images: ["/images/icons/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SCHOOL",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/images/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    shortcut: [{ url: "/images/icons/icon-512.png", type: "image/png" }],
    apple: [{ url: "/images/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={brandFontClassName} style={rootFontVariables}>
      <head>
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionProvider>
            <AppSplash />
            <ThemeLoader />
            <ServiceWorkerRegister />
            <ResponseJsonSafetyPatch />
            <PhaseThemeSync />
            <InstitutionThemeSync />
            <EmailVerificationBanner />
            <ShellLayout>
              <ApiConnectivityBanner />
              <LiteModeNotice />
              <LegacyLearnNotice />
              {children}
            </ShellLayout>
            <UsernameClaimPrompt />
            <ProfilePreferencesOnboardingPrompt />
            <CookieConsentBanner />
          </SessionProvider>
        </NextIntlClientProvider>
        {/* Cookieless visitor/page-view beacon; data appears under the
            Vercel project's Analytics tab once enabled there. */}
        <Analytics />
        {/* Core Web Vitals beacon for the Vercel Speed Insights tab. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
