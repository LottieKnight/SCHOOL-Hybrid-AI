import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getAuthToken } from "./auth/tokenStore";

const PUSH_TOKEN_KEY = "saedu-push-token";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://school-api-production-2ff7.up.railway.app";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  // Push tokens only work on physical devices.
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  // Skip if the token hasn't changed since last registration.
  const cached = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (cached === token) return;

  const authToken = await getAuthToken();
  if (!authToken) return;

  const deviceId = Constants.sessionId ?? Device.modelId ?? null;

  try {
    const response = await fetch(`${API_BASE}/api/notifications/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS as "ios" | "android",
        deviceId,
      }),
    });

    if (response.ok) {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    }
  } catch {
    // Non-fatal: registration will be retried on next app launch.
  }
}

export async function clearPushToken(): Promise<void> {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
