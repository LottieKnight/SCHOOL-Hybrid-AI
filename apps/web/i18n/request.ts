import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;

  // English is always loaded as the fallback source. For non-English locales we
  // merge the locale file over English so any untranslated keys render in English
  // instead of throwing a MISSING_MESSAGE error.
  const english = (await import("../messages/en.json")).default;
  const messages =
    locale === DEFAULT_LOCALE
      ? english
      : { ...english, ...(await import(`../messages/${locale}.json`)).default };

  return { locale, messages };
});
