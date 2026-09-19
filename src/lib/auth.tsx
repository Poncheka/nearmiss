import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { unregisterPush } from '@/lib/push';
import { useScan } from '@/state/scan';
import { resetScanCursor } from '@/lib/photoScan';
import { usePlaces } from '@/lib/places';
import { useContacts } from '@/lib/contacts';
import { useNearMisses } from '@/lib/nearMisses';
import { useSharedPhotos } from '@/lib/sharedPhotos';

export type Profile = {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  /** Optional. Only the month and day are ever shown, to mark a near miss that fell on it. */
  birthday: string | null;
};

export type Settings = {
  audience: 'friends' | 'fof';
  notify_photos: boolean;
  notify_replies: boolean;
  notify_joins: boolean;
  notify_near_misses: boolean;
  notify_weekly_report: boolean;
  notify_on_this_day: boolean;
  onboarded_at: string | null;
};

const defaultSettings: Settings = {
  // Friends only to start. Friend-of-a-friend works and stays available, but it means someone
  // you have never met can be told where you were, and that is a choice to make rather than
  // discover.
  audience: 'friends',
  notify_photos: true,
  notify_replies: true,
  notify_joins: true,
  notify_near_misses: true,
  notify_weekly_report: true,
  notify_on_this_day: false,
  onboarded_at: null,
};

type AuthState = {
  loading: boolean;
  /** Signed in and profile/settings fetched (so we know whether onboarding is done). */
  userLoaded: boolean;
  /** Signed in with a real account, or exploring in demo mode. */
  signedIn: boolean;
  demo: boolean;
  session: Session | null;
  profile: Profile | null;
  settings: Settings;
  onboarded: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Emails a one-time sign-in link. */
  sendEmailCode: (email: string) => Promise<void>;
  linkError: string;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
  /** Permanently removes the account and everything stored with it. */
  deleteAccount: () => Promise<void>;
  saveProfile: (p: { username: string; name: string; bio: string; birthday?: string | null }) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  finishOnboarding: () => Promise<void>;
  uploadAvatar: (image: { uri: string; mimeType?: string | null }) => Promise<void>;
};

/** Everything this person has in storage: their avatar, and anything they shared. */
async function removeMyFiles(uid: string) {
  const { data: avatars } = await supabase.storage.from('avatars').list(uid);
  if (avatars?.length) {
    await supabase.storage.from('avatars').remove(avatars.map((f) => `${uid}/${f.name}`));
  }

  // Shared photos are stored as <near_miss_id>/<owner_id>/<file>, so the rows are the index.
  const { data: shared } = await supabase
    .from('shared_photos')
    .select('storage_path')
    .eq('owner_id', uid);
  const paths = (shared ?? []).map((r) => (r as { storage_path: string }).storage_path);
  if (paths.length) await supabase.storage.from('shared-photos').remove(paths);
}

const AuthContext = createContext<AuthState | null>(null);

export class UserFacingError extends Error {}

// Google OAuth client IDs (public identifiers, not secrets).
const GOOGLE_WEB_CLIENT_ID = '75590594065-1trkfq5u9lujqk0l8ggnddk3cd179ph9.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '75590594065-kba7va53qrukb9ij209qmhci9v6n2pjc.apps.googleusercontent.com';

/** Native Google/Apple sign-in need our own build; Expo Go doesn't include them. */
export const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const googleAvailable = !inExpoGo && Platform.OS !== 'web';

// Loaded lazily so Expo Go (which lacks the native module) doesn't crash on import.
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleModule: GoogleModule | null = null;
function getGoogle(): GoogleModule {
  if (!googleModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleModule = require('@react-native-google-signin/google-signin') as GoogleModule;
    googleModule.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
  }
  return googleModule;
}

const demoProfile: Profile = { id: 'demo', username: 'jeff', name: 'Jeff', bio: 'SF. Always at the show.', avatar_url: null, birthday: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [linkError, setLinkError] = useState('');
  const [userLoaded, setUserLoaded] = useState(false);

  /**
   * Reads the profile and settings for a signed-in user, with retries.
   *
   * The retries are not paranoia. Signing in by magic link establishes the session through a
   * deep link rather than in the call that returns it, so this can fire in the moment before
   * the client has applied it. Row-level security then sees no user, returns no row, and the
   * app renders someone with no name, no username and no photo, while their profile sits
   * perfectly intact in the database. That happened to Leigh.
   *
   * An empty result for a user who is definitely signed in is therefore treated as "too early"
   * rather than "nothing there", and asked again.
   */
  const loadUser = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const [p, s] = await Promise.all([
        supabase.from('profiles').select('id, username, name, bio, avatar_url, birthday').eq('id', userId).maybeSingle(),
        supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      ]);
      if (s.data) setSettings({ ...defaultSettings, ...(s.data as Partial<Settings>) });
      if (p.data) {
        setProfile(p.data);
        setUserLoaded(true);
        return;
      }
      // No row and no error means the read was refused or arrived too early. Wait and ask again.
      if (p.error && p.error.code !== 'PGRST116') break;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
    // Out of attempts. Let the app through rather than trapping someone on a spinner; the next
    // focus or sign-in will fill it in.
    setUserLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadUser(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) loadUser(next.user.id);
      else { setProfile(null); setSettings(defaultSettings); setUserLoaded(false); }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadUser]);

  // Sign-in links from email open the app here.
  //
  // supabase-js defaults to the PKCE flow, which sends you back with `?code=` in the query
  // string and expects that code to be traded for a session. We only read the `#` fragment,
  // which is the older implicit flow, so the link opened the app and then silently did
  // nothing. Handle the code first, and keep the fragment path for any link already in flight.
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url) return;

      const { queryParams } = Linking.parse(url);
      const qErr = typeof queryParams?.error_description === 'string' ? queryParams.error_description : null;
      if (qErr) { setLinkError(qErr.replace(/\+/g, ' ')); return; }

      const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setLinkError(error ? error.message : '');
        return;
      }

      if (!url.includes('#')) return;
      const params = new URLSearchParams(url.split('#')[1]);
      const error = params.get('error_description');
      if (error) { setLinkError(error.replace(/\+/g, ' ')); return; }
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) return;
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      setLinkError(sessionError ? sessionError.message : '');
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') throw new UserFacingError('Sign in with Apple is only available on iPhone. Use email instead.');
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      throw e;
    }
    if (!credential.identityToken) throw new UserFacingError('Apple did not return a sign-in token. Try again.');
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) throw new UserFacingError(`Supabase: ${error.message}`);
    // Apple only shares the name on the very first sign-in.
    const given = credential.fullName?.givenName;
    if (given && data.user) {
      const full = [given, credential.fullName?.familyName].filter(Boolean).join(' ');
      await supabase.auth.updateUser({ data: { full_name: full } });
      await supabase.from('profiles').update({ name: given }).eq('id', data.user.id).is('name', null);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!googleAvailable) throw new UserFacingError('Google sign-in works in the installed Near Miss app, not in Expo Go.');
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = getGoogle();
    let idToken: string | null = null;
    let google: { givenName: string | null; photo: string | null } | null = null;
    try {
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      if (!isSuccessResponse(res)) return; // cancelled
      idToken = res.data.idToken;
      google = { givenName: res.data.user.givenName, photo: res.data.user.photo };
    } catch (e) {
      if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return;
      if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new UserFacingError('Google Play Services is missing or out of date.');
      throw new UserFacingError(`Google: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!idToken) throw new UserFacingError('Google did not return a sign-in token. Try again.');
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw new UserFacingError(`Supabase: ${error.message}`);
    // Fill in name and photo from Google if the profile doesn't have them yet.
    if (data.user && google) {
      if (google.givenName) await supabase.from('profiles').update({ name: google.givenName }).eq('id', data.user.id).is('name', null);
      if (google.photo) await supabase.from('profiles').update({ avatar_url: google.photo }).eq('id', data.user.id).is('avatar_url', null);
      await loadUser(data.user.id);
    }
  }, [loadUser]);

  const sendEmailCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('auth-callback') },
    });
    if (error) throw new UserFacingError(error.message);
  }, []);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (error) throw new UserFacingError(error.message);
  }, []);

  const startDemo = useCallback(() => {
    setDemo(true);
    setProfile(demoProfile);
    setSettings(defaultSettings);
  }, []);

  const signOut = useCallback(async () => {
    if (demo) { setDemo(false); setProfile(null); setSettings(defaultSettings); return; }
    if (googleAvailable && googleModule) await googleModule.GoogleSignin.signOut().catch(() => {});
    useScan.getState().reset();
    usePlaces.getState().reset();
    useContacts.getState().reset();
    useNearMisses.getState().reset();
    useSharedPhotos.getState().reset();
    // Before the session goes, so this phone stops receiving their notifications.
    await unregisterPush();
    await supabase.auth.signOut();
  }, [demo]);

  const deleteAccount = useCallback(async () => {
    if (demo || !session) { await signOut(); return; }
    const uid = session.user.id;

    // Files first, through the Storage API.
    //
    // The database cannot do this part: Supabase refuses plain SQL deletes against
    // storage.objects, and trying it inside delete_my_account rolled the whole thing back, so
    // the account survived every attempt. Storage failures here are not fatal, because leaving
    // an orphaned file behind is a far better outcome than an account that will not delete.
    await removeMyFiles(uid).catch(() => {});

    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new UserFacingError(`Couldn't delete your account: ${error.message}`);
    // The account is gone, so forget where the last scan got to on this phone too.
    await resetScanCursor(uid);
    await signOut().catch(() => {});
    setSession(null);
    setProfile(null);
    setSettings(defaultSettings);
    setUserLoaded(false);
  }, [demo, session, signOut]);

  const saveProfile = useCallback(async ({ username, name, bio, birthday }: { username: string; name: string; bio: string; birthday?: string | null }) => {
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{3,24}$/.test(clean)) {
      throw new UserFacingError('Usernames are 3–24 characters: letters, numbers, dots and underscores.');
    }
    const patch: Record<string, unknown> = { username: clean, name: name.trim() || null, bio: bio.trim() || null };
    // Left out entirely when not passed, so saving a name can't wipe a birthday set elsewhere.
    if (birthday !== undefined) patch.birthday = birthday;
    if (demo || !session) { setProfile((p) => ({ ...(p ?? demoProfile), ...patch })); return; }
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select('id, username, name, bio, avatar_url, birthday').single();
    if (error) {
      if (error.code === '23505') throw new UserFacingError(`@${clean} is taken. Try another.`);
      throw new UserFacingError(error.message);
    }
    setProfile(data);
  }, [demo, session]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (demo || !session) return;
    const { error } = await supabase.from('user_settings').update(patch).eq('user_id', session.user.id);
    if (error) { setSettings(settings); throw new UserFacingError(error.message); }
  }, [demo, session, settings]);

  const uploadAvatar = useCallback(async ({ uri, mimeType }: { uri: string; mimeType?: string | null }) => {
    if (demo || !session) { setProfile((p) => ({ ...(p ?? demoProfile), avatar_url: uri })); return; }
    const type = mimeType && /^image\/(jpeg|png|webp|heic)$/.test(mimeType) ? mimeType : 'image/jpeg';
    const ext = type.split('/')[1].replace('jpeg', 'jpg');
    const body = await (await fetch(uri)).arrayBuffer();
    if (body.byteLength > 5 * 1024 * 1024) throw new UserFacingError('That photo is too big. Try another one.');
    const uid = session.user.id;
    const path = `${uid}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, body, { contentType: type, upsert: false });
    if (upErr) throw new UserFacingError(`Couldn't upload your photo: ${upErr.message}`);
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const { data, error } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', uid).select('id, username, name, bio, avatar_url, birthday').single();
    if (error) throw new UserFacingError(error.message);
    const old = profile?.avatar_url?.split('/avatars/')[1];
    setProfile(data);
    // Tidy up the previous upload (Google/Apple photos live elsewhere and are left alone).
    if (old && old.startsWith(`${uid}/`)) supabase.storage.from('avatars').remove([decodeURIComponent(old)]).catch(() => {});
  }, [demo, session, profile]);

  const finishOnboarding = useCallback(async () => {
    await updateSettings({ onboarded_at: new Date().toISOString() });
  }, [updateSettings]);

  const value = useMemo<AuthState>(() => ({
    loading,
    userLoaded: demo || userLoaded,
    signedIn: demo || !!session,
    demo,
    session,
    profile,
    settings,
    onboarded: !!settings.onboarded_at,
    signInWithApple,
    signInWithGoogle,
    sendEmailCode,
    linkError,
    verifyEmailCode,
    startDemo,
    signOut,
    deleteAccount,
    saveProfile,
    updateSettings,
    finishOnboarding,
    uploadAvatar,
  }), [loading, userLoaded, demo, session, profile, settings, signInWithApple, signInWithGoogle, sendEmailCode, linkError, verifyEmailCode, startDemo, signOut, deleteAccount, saveProfile, updateSettings, finishOnboarding, uploadAvatar]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const errorMessage = (e: unknown) =>
  e instanceof UserFacingError ? e.message : 'Something went wrong. Please try again.';
