// Analytics abstraction — matches @react-native-firebase/analytics API.
// Swap the body of trackEvent/trackScreen for Firebase calls when
// google-services.json + GoogleService-Info.plist are added as EAS secrets.

type EventParams = Record<string, string | number | boolean>;

export function trackScreen(screenName: string) {
  if (__DEV__) {
    console.log(`[Analytics] screen_view: ${screenName}`);
  }
}

export function trackEvent(name: string, params?: EventParams) {
  if (__DEV__) {
    console.log(`[Analytics] event: ${name}`, params ?? {});
  }
}

// Canonical event names used across the app.
export const Events = {
  STUDY_SESSION_START: "study_session_start",
  QUIZ_COMPLETED: "quiz_completed",
  PAST_PAPER_OPENED: "past_paper_opened",
  MODULE_ENROLLED: "module_enrolled",
  FLASHCARD_FLIPPED: "flashcard_flipped",
  COMMUNITY_POST_CREATED: "community_post_created",
  MUSIC_TRACK_SHARED: "music_track_shared",
} as const;
