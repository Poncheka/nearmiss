// Getting told when something happens.
//
// Two rules here, both learned the hard way in this app. Ask once, and only when the person has
// a reason to say yes: iOS gives you exactly one chance at the notification prompt, and a cold
// one during sign-up is how apps get denied forever. So the ask waits until there is a near miss
// on screen worth hearing about, and if it is declined or dismissed it is never raised again.
//
// The second rule: never ask for something already granted. Registration runs silently whenever
// permission is already there, which covers reinstalls where iOS remembers the answer.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

type Notifications = typeof import('expo-notifications');

const OFFERED_KEY = 'nearmiss.push.offered';

function lib(): Notifications | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as Notifications;
  } catch {
    return null;
  }
}

const projectId = () =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;

/** Hands the token to the server, where the push trigger reads it. Never throws. */
async function register(): Promise<boolean> {
  const N = lib();
  if (!N) return false;
  try {
    const id = projectId();
    const { data: token } = await N.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    if (!token) return false;
    const { error } = await supabase.rpc('register_push_token', {
      t: token,
      plat: Platform.OS === 'android' ? 'android' : 'ios',
    });
    return !error;
  } catch {
    // No network, or a simulator with no push support. Nothing to do about it.
    return false;
  }
}

export type PushState = {
  /** Notifications are on at the operating system level. */
  granted: boolean;
  /** iOS will still show its prompt. False once it has been answered, either way. */
  canAskAgain: boolean;
  /** We have already put the offer in front of them, whatever they said to it. */
  offered: boolean;
};

/** What the phone and our own record actually say. The one place that reads both. */
export async function pushState(): Promise<PushState | null> {
  const N = lib();
  if (!N) return null;
  try {
    const [offered, perm] = await Promise.all([
      AsyncStorage.getItem(OFFERED_KEY),
      N.getPermissionsAsync(),
    ]);
    // Permission already exists, so the offer is spent whether or not this phone remembers
    // being asked. Writing it down means a lost local store cannot resurrect the card.
    if (perm.granted && !offered) await AsyncStorage.setItem(OFFERED_KEY, '1').catch(() => {});
    return { granted: !!perm.granted, canAskAgain: !!perm.canAskAgain, offered: !!offered || !!perm.granted };
  } catch {
    return null;
  }
}

/** True when there is a prompt left to show and we have not already used it. */
export async function canOfferPush(): Promise<boolean> {
  const s = await pushState();
  return !!s && !s.offered && !s.granted && s.canAskAgain;
}

/** Marks the offer as spent whatever the answer, so it is never raised twice. */
export async function offerDeclined() {
  await AsyncStorage.setItem(OFFERED_KEY, '1').catch(() => {});
}

/** The one prompt. Returns whether notifications are now on. */
export async function askForPush(): Promise<boolean> {
  const N = lib();
  if (!N) return false;
  await AsyncStorage.setItem(OFFERED_KEY, '1').catch(() => {});
  try {
    const perm = await N.requestPermissionsAsync();
    if (!perm.granted) return false;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', {
        name: 'Near misses',
        importance: N.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }
    return await register();
  } catch {
    return false;
  }
}

/** Removes this device so a signed-out phone stops receiving someone else's notifications. */
export async function unregisterPush() {
  const N = lib();
  if (!N) return;
  try {
    const id = projectId();
    const { data: token } = await N.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    if (token) await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // Signing out still has to work.
  }
}

/**
 * Keeps the token current while signed in.
 *
 * Silent: it only registers when permission is already granted, so it can run on every launch
 * without ever putting a prompt in front of anyone. Tokens can be reissued by the OS, which is
 * why this runs each time rather than once.
 */
export function usePushRegistration(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    const N = lib();
    if (!N) return;
    let live = true;
    N.getPermissionsAsync()
      .then((p) => { if (live && p.granted) register(); })
      .catch(() => {});
    return () => { live = false; };
  }, [signedIn]);
}

/**
 * Opening the thing a notification was about.
 *
 * Until now a push tap just brought the app to the foreground, wherever it happened to be, so
 * "Leigh reacted to your photo" led to whatever screen you were last on. Every push carries the
 * near miss and the id of the item it concerns, so this can land on both: the right page,
 * scrolled to the right thing.
 *
 * Two cases, not one. A tap while the app is running arrives through the listener. A tap that
 * launched the app from cold is already waiting when this mounts, which is what the first call
 * collects, and is the case that silently does nothing if you forget it.
 */
export function useNotificationTaps(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    const N = lib();
    if (!N) return;
    let live = true;

    const open = (data: Record<string, unknown> | undefined) => {
      // Most notifications are about a near miss. A nudge isn't: it asks you to scan, so the
      // server names the screen it should open. Only our own paths are honoured, because this
      // string arrives from outside the app.
      const route = typeof data?.route === 'string' ? data.route : null;
      if (route === '/settings') {
        router.push('/settings');
        return;
      }
      const nearMissId = typeof data?.nearMissId === 'string' ? data.nearMissId : null;
      if (!nearMissId) return;
      const targetId = typeof data?.targetId === 'string' ? data.targetId : undefined;
      router.push({
        pathname: '/near-miss/[id]',
        params: targetId ? { id: nearMissId, focus: targetId } : { id: nearMissId },
      });
    };

    N.getLastNotificationResponseAsync()
      .then((r) => { if (live && r) open(r.notification.request.content.data as Record<string, unknown>); })
      .catch(() => {});

    const sub = N.addNotificationResponseReceivedListener((r) => {
      open(r.notification.request.content.data as Record<string, unknown>);
    });
    return () => { live = false; sub.remove(); };
  }, [signedIn]);
}
