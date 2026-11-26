import { useThemeStore } from "../store/themeStore";
import { getThemeTokens, type ColorTokens } from "../theme/tokens";

export function useTheme(): ColorTokens {
  const theme = useThemeStore((state) => state.theme);
  const institution = useThemeStore((state) => state.institution);
  return getThemeTokens(theme, institution);
}
