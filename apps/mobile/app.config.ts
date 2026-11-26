import type { ExpoConfig } from "expo/config";

const buildNumber = process.env.BUILD_NUMBER ?? "1";

export default ({ config }: { config: ExpoConfig }): ExpoConfig => ({
  ...config,
  name: "SCHOOL",
  slug: "school-mobile",
  scheme: "school",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/splash-icon.png",
    backgroundColor: "#07101f",
    resizeMode: "contain",
    ios: {
      image: "./assets/splash-icon.png",
      backgroundColor: "#07101f",
      resizeMode: "contain",
    },
    android: {
      image: "./assets/splash-icon.png",
      backgroundColor: "#07101f",
      resizeMode: "contain",
    },
  },
  ios: {
    ...(config.ios ?? {}),
    supportsTablet: true,
    bundleIdentifier: "za.co.school.mobile",
    buildNumber,
  },
  android: {
    ...(config.android ?? {}),
    package: "za.co.school.mobile",
    versionCode: parseInt(buildNumber, 10),
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://school-api-production-2ff7.up.railway.app",
    webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://school.ditshego-ventures.co.za",
  },
});
