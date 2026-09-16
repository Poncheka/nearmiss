import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export type Settings = {
  audience: 'friends' | 'fof' | 'everyone';
  delay_days: 3 | 7 | 14 | 30;
  background_location: boolean;
  notify_photos: boolean;
  notify_replies: boolean;
  notify_joins: boolean;
  notify_weekly_report: boolean;
  notify_on_this_day: boolean;
  onboarded_at: string | null;
};

const defaultSettings: Settings = {
  audience: 'fof',
  delay_days: 3,
  background_location: false,
  notify_photos: true,
  notify_replies: true,
  notify_joins: true,
  notify_weekly_report: true,
  notify_on_this_day: false,
  onboarded_at: null,
};

type AuthState = {
  loading: boolean;
  /** Signed in with a real account, or exploring in demo mode. */
  signedIn: boolean;
  demo: boolean;
  session: Session | null;
  profile: Profile | null;
  settings: Settings;
  onboarded: boolean;
  signInWithApple: () => Promise<void>;
  /** Emails a sign-in link (and a 6-digit code once custom email templates are set up). */
  sendEmailCode: (email: string) => Promise<void>;
  linkError: string;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
  saveProfile: (p: { username: string; name: string; bio: string }) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  finishOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export class UserFacingError extends Error {}

const demoProfile: Profile = { id: 'demo', username: 'jeff', name: 'Jeff', bio: 'SF. Always at the show.', avatar_url: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [linkError, setLinkError] = useState('');

  const loadUser = useCallback(async (userId: string) => {
    const [p, s] = await Promise.all([
      supabase.from('profiles').select('id, username, name, bio, avatar_url').eq('id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (p.data) setProfile(p.data);
    if (s.data) setSettings({ ...defaultSettings, ...(s.data as Partial<Settings>) });
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
      else { setProfile(null); setSettings(defaultSettings); }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadUser]);

  // Sign-in links from email open the app with the session tokens in the URL fragment.
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url || !url.includes('#')) return;
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
    if (error) throw new UserFacingError(error.message);
    // Apple only shares the name on the very first sign-in.
    const given = credential.fullName?.givenName;
    if (given && data.user) {
      const full = [given, credential.fullName?.familyName].filter(Boolean).join(' ');
      await supabase.auth.updateUser({ data: { full_name: full } });
      await supabase.from('profiles').update({ name: given }).eq('id', data.user.id).is('name', null);
    }
  }, []);

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
    await supabase.auth.signOut();
  }, [demo]);

  const saveProfile = useCallback(async ({ username, name, bio }: { username: string; name: string; bio: string }) => {
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_.]{3,24}$/.test(clean)) {
      throw new UserFacingError('Usernames are 3–24 characters: letters, numbers, dots and underscores.');
    }
    const patch = { username: clean, name: name.trim() || null, bio: bio.trim() || null };
    if (demo || !session) { setProfile((p) => ({ ...(p ?? demoProfile), ...patch })); return; }
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', session.user.id).select('id, username, name, bio, avatar_url').single();
    if (error) {
      if (error.code === '23505') throw new UserFacingError(`@${clean} is taken. Try another.`);
      throw new UserFacingError(error.message);
    }
    setProfile(data);
  }, [demo, session]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    // Public matching always waits at least a week.
    const next = { ...settings, ...patch };
    if (next.audience === 'everyone' && next.delay_days < 7) next.delay_days = 7;
    setSettings(next);
    if (demo || !session) return;
    const { error } = await supabase.from('user_settings').update({ ...patch, delay_days: next.delay_days }).eq('user_id', session.user.id);
    if (error) { setSettings(settings); throw new UserFacingError(error.message); }
  }, [demo, session, settings]);

  const finishOnboarding = useCallback(async () => {
    await updateSettings({ onboarded_at: new Date().toISOString() });
  }, [updateSettings]);

  const value = useMemo<AuthState>(() => ({
    loading,
    signedIn: demo || !!session,
    demo,
    session,
    profile,
    settings,
    onboarded: !!settings.onboarded_at,
    signInWithApple,
    sendEmailCode,
    linkError,
    verifyEmailCode,
    startDemo,
    signOut,
    saveProfile,
    updateSettings,
    finishOnboarding,
  }), [loading, demo, session, profile, settings, signInWithApple, sendEmailCode, linkError, verifyEmailCode, startDemo, signOut, saveProfile, updateSettings, finishOnboarding]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const errorMessage = (e: unknown) =>
  e instanceof UserFacingError ? e.message : 'Something went wrong. Please try again.';
