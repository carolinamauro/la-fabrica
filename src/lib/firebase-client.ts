import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Firebase web config is public by design; access is enforced on the server.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

/** Opens Google's account chooser and returns a Firebase ID token for the chosen account. */
export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getApps()[0] ?? initializeApp(config));
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const { user } = await signInWithPopup(auth, provider);
  const idToken = await user.getIdToken();
  // The app keeps its own session cookie; Firebase is only used to sign in.
  await signOut(auth);
  return idToken;
}
