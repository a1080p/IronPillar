import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';

// Required so a completed auth session properly closes its browser tab/sheet
// (matters most on web, harmless elsewhere) — must run at module load, not
// inside a component.
WebBrowser.maybeCompleteAuthSession();

const WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID;
const WHOOP_AUTHORIZATION_ENDPOINT = 'https://api.prod.whoop.com/oauth/oauth2/auth';

// A fixed, deterministic redirect URI (rather than the platform-dependent
// default) so there's exactly one URI to register in the WHOOP Developer
// Dashboard: ironpillar://whoop-callback. Only resolves correctly in a build
// that has this app's own "ironpillar" scheme (any dev-client/preview/
// production build) — same requirement Google/Apple Sign-In already have,
// not a new one. Plain Expo Go can't complete this redirect.
export const WHOOP_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'ironpillar',
  path: 'whoop-callback',
});

export const isWhoopConfigured = !!WHOOP_CLIENT_ID;

const WHOOP_SCOPES = [
  'read:recovery',
  'read:cycles',
  'read:sleep',
  'read:workout',
  'read:profile',
  'read:body_measurement',
  'offline', // required for a refresh token, so syncing can happen after the app is closed and reopened
];

const exchangeWhoopCodeFn = httpsCallable<
  { code: string; redirectUri: string },
  { connected: true }
>(functions, 'exchangeWhoopCode');
const syncWhoopDataFn = httpsCallable<void, { synced: true }>(functions, 'syncWhoopData');
const disconnectWhoopFn = httpsCallable<void, { disconnected: true }>(functions, 'disconnectWhoop');

// Runs the full WHOOP OAuth authorization-code flow: opens WHOOP's consent
// screen, waits for the redirect, then hands the resulting code to the
// exchangeWhoopCode Cloud Function. The token exchange itself (and WHOOP's
// client secret) never touches this app — only the server-side function has
// it, same boundary as every other OAuth provider wired into this app.
export async function connectWhoop(): Promise<void> {
  if (!WHOOP_CLIENT_ID) {
    throw new Error('WHOOP is not configured on this build yet.');
  }

  const request = new AuthSession.AuthRequest({
    clientId: WHOOP_CLIENT_ID,
    redirectUri: WHOOP_REDIRECT_URI,
    scopes: WHOOP_SCOPES,
    responseType: AuthSession.ResponseType.Code,
    // WHOOP's docs don't mention PKCE support, and the server-side token
    // exchange below doesn't send a code_verifier — leaving this on (the
    // library's default) would generate a code_challenge WHOOP likely
    // doesn't expect and the exchange couldn't complete anyway.
    usePKCE: false,
  });

  const result = await request.promptAsync({
    authorizationEndpoint: WHOOP_AUTHORIZATION_ENDPOINT,
  });

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return; // user backed out of the WHOOP consent screen — not an error
  }
  if (result.type !== 'success' || !result.params.code) {
    throw new Error('WHOOP authorization failed. Please try again.');
  }

  await exchangeWhoopCodeFn({ code: result.params.code, redirectUri: WHOOP_REDIRECT_URI });
}

export async function syncWhoop(): Promise<void> {
  await syncWhoopDataFn();
}

export async function disconnectWhoop(): Promise<void> {
  await disconnectWhoopFn();
}
