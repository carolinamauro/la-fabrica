import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, type Auth, type User } from "firebase/auth";

// Firebase web config is public by design; access is enforced on the server.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const REDIRECT_APP = "redirect";

/**
 * The app opened from the home screen can't get a popup's answer back, so it signs in by going
 * to Google and back in the same window instead.
 */
export function isInstalledApp(): boolean {
  return matchMedia("(display-mode: standalone)").matches || Boolean((navigator as { standalone?: boolean }).standalone);
}

function popupAuth(): Auth {
  return getAuth(getApps().find((app) => app.name === "[DEFAULT]") ?? initializeApp(config));
}

// The redirect has to come back to this same site (Safari keeps sites' storage apart), so its
// auth domain is the app's own, and next.config proxies /__/auth/ to Firebase.
function redirectAuth(): Auth {
  const exists = getApps().some((app) => app.name === REDIRECT_APP);
  return getAuth(exists ? getApp(REDIRECT_APP) : initializeApp({ ...config, authDomain: location.host }, REDIRECT_APP));
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/** The app keeps its own session cookie; Firebase is only used to sign in. */
async function takeIdToken(auth: Auth, user: User): Promise<string> {
  const idToken = await user.getIdToken();
  await signOut(auth);
  return idToken;
}

/**
 * Opens Google's account chooser and returns a Firebase ID token for the chosen account.
 * In the installed app it leaves the page instead (never resolves): `finishRedirectSignIn`
 * picks it up when Google sends the athlete back.
 */
export async function signInWithGoogle(): Promise<string> {
  if (isInstalledApp()) {
    return signInWithRedirect(redirectAuth(), googleProvider());
  }
  const auth = popupAuth();
  const { user } = await signInWithPopup(auth, googleProvider());
  return takeIdToken(auth, user);
}

/** After coming back from Google in the installed app: the ID token, or null if not signing in. */
export async function finishRedirectSignIn(): Promise<string | null> {
  const auth = redirectAuth();
  const result = await getRedirectResult(auth);
  return result ? takeIdToken(auth, result.user) : null;
}
