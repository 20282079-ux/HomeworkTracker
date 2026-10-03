// auth.js — Convex Auth with Google sign-in.
//
// The Google provider reads its credentials from the Convex deployment env:
//   AUTH_GOOGLE_ID     OAuth client ID (Google Cloud Console)
//   AUTH_GOOGLE_SECRET OAuth client secret
// The authorized redirect URI in the Google console must be:
//   https://<your-deployment>.convex.site/api/auth/callback/google
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
