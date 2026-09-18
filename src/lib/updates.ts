// Getting new code onto phones without a new build.
//
// expo-updates' default is to download an update in the background and apply it on the *next*
// launch. So you open the app, nothing looks different, and the change only appears the second
// time — which is confusing enough that we kept mistaking a working update for a broken one.
//
// Instead: check on launch and whenever the app comes back to the foreground, and if there is
// something new, fetch it and reload straight away. Reloading is only ever done at a moment the
// person isn't mid-anything — app start, or the instant they return to it.
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

async function applyIfAny(): Promise<boolean> {
  // Off in development (Metro serves the code) and wherever updates aren't configured.
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch {
    // Offline, or the update server is unreachable. The app keeps running what it has.
    return false;
  }
}

export function useAutoUpdate() {
  const busy = useRef(false);

  useEffect(() => {
    const run = () => {
      if (busy.current) return;
      busy.current = true;
      applyIfAny().finally(() => { busy.current = false; });
    };

    run();

    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      // Only on the way back in, not on every state wobble.
      if (previous.match(/inactive|background/) && next === 'active') run();
      previous = next;
    });
    return () => sub.remove();
  }, []);
}
