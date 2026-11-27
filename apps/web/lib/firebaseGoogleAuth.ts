import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type AuthCredential,
  type User,
} from "firebase/auth";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { googleAuthMessage, runGoogleSignIn, type GoogleSignInResult } from "@/lib/googleAuthFlow";
import { shareInFlight } from "@/lib/postGoogleSignIn";
import { readPublicFirebaseConfig } from "@/lib/hybridTutor/config";
import { getFirebaseApp } from "@/lib/hybridTutor/client";
import { parseMinimalProfile, type MinimalProfile } from "@/lib/minimalProfile";

export type GoogleAccount = {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

export type GoogleContinueResult = GoogleSignInResult & GoogleAccount;

function codeOf(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "auth/unknown";
}

function flowError(error: unknown) {
  const code = codeOf(error);
  let credential = null;
  try {
    credential = GoogleAuthProvider.credentialFromError(error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]);
  } catch {
    credential = null;
  }
  return Object.assign(new Error(code), { code, credential });
}

function toAccount(user: User | null | undefined): GoogleAccount | null {
  if (!user || user.isAnonymous) return null;
  return {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

function emptyAccount(): GoogleAccount {
  return { displayName: null, email: null, photoURL: null };
}

async function settle(work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    throw flowError(error);
  }
}

async function prepareFirebaseAuth(): Promise<Auth> {
  const auth = getAuth(getFirebaseApp());
  await setPersistence(auth, browserLocalPersistence);
  await auth.authStateReady();
  return auth;
}

export async function continueWithGoogle(): Promise<GoogleContinueResult> {
  if (!readPublicFirebaseConfig().ok) {
    return {
      ok: false,
      code: "auth/not-configured",
      message: googleAuthMessage("auth/not-configured"),
      mode: "sign-in-popup",
      ...emptyAccount(),
    };
  }

  try {
    const auth = await prepareFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await runGoogleSignIn({
      isAnonymous: Boolean(auth.currentUser?.isAnonymous),
      linkWithPopup: () => settle(() => linkWithPopup(auth.currentUser!, provider)),
      signInWithPopup: () => settle(() => signInWithPopup(auth, provider)),
      signInWithRedirect: () => settle(() => signInWithRedirect(auth, provider)),
      signInWithCredential: (credential) => settle(() => signInWithCredential(auth, credential as AuthCredential)),
    });
    return { ...result, ...(toAccount(auth.currentUser) ?? emptyAccount()) };
  } catch (error) {
    const code = codeOf(error);
    return { ok: false, code, message: googleAuthMessage(code), mode: "sign-in-popup", ...emptyAccount() };
  }
}

type RedirectCompletion = { ok: true; account: GoogleAccount | null } | { ok: false; code: string; message: string };

let redirectCompletion: Promise<RedirectCompletion> | null = null;

async function readRedirectCompletion(): Promise<RedirectCompletion> {
  try {
    const auth = await prepareFirebaseAuth();
    const result = await getRedirectResult(auth);
    return { ok: true, account: toAccount(result?.user) };
  } catch (error) {
    const code = codeOf(error);
    return { ok: false, code, message: googleAuthMessage(code) };
  }
}

export function completeGoogleRedirect(): Promise<RedirectCompletion> {
  if (!readPublicFirebaseConfig().ok || typeof window === "undefined") {
    return Promise.resolve({ ok: true, account: null });
  }
  redirectCompletion = shareInFlight(redirectCompletion, readRedirectCompletion);
  return redirectCompletion;
}

export function watchSignedInAccount(onAccount: (account: GoogleAccount, meta: { initial: boolean }) => void) {
  if (!readPublicFirebaseConfig().ok || typeof window === "undefined") return () => {};
  const auth = getAuth(getFirebaseApp());
  let initial = true;
  return onAuthStateChanged(auth, (user) => {
    const account = toAccount(user);
    const meta = { initial };
    initial = false;
    if (account) onAccount(account, meta);
  });
}

export async function signOutFirebase() {
  redirectCompletion = null;
  if (!readPublicFirebaseConfig().ok || typeof window === "undefined") return;
  try {
    const auth = getAuth(getFirebaseApp());
    await auth.authStateReady();
    if (!auth.currentUser) return;
    await signOut(auth);
  } catch {
    // The backend session still clears. A Firebase failure must not trap logout.
  }
}

export async function readFirestoreMinimalProfile(): Promise<MinimalProfile | null> {
  if (!readPublicFirebaseConfig().ok) return null;
  try {
    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return null;
    const snapshot = await getDoc(doc(getFirestore(getFirebaseApp()), "users", user.uid, "profile", "minimal"));
    if (!snapshot.exists()) return null;
    return parseMinimalProfile(snapshot.data());
  } catch {
    return null;
  }
}

export async function writeFirestoreMinimalProfile(profile: MinimalProfile) {
  if (!readPublicFirebaseConfig().ok) return false;
  try {
    const auth = getAuth(getFirebaseApp());
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return false;
    await setDoc(
      doc(getFirestore(getFirebaseApp()), "users", user.uid, "profile", "minimal"),
      { ...profile, uid: user.uid, updatedAt: profile.updatedAt, syncedAt: serverTimestamp() },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}
