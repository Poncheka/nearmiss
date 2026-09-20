import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Body, Button, Display, Screen, TextLink, Wordmark } from '@/components/ui';
import { WelcomeArt } from '@/components/art';
import { errorMessage, getGoogleButton, googleAvailable, inExpoGo, useAuth } from '@/lib/auth';
import { colors, radius } from '@/theme';

/** Google's own value for the wide button style (standard is 0, icon only is 2). */
const GOOGLE_BUTTON_WIDE = 1;

const PRIVACY_URL = 'https://nearmiss.io/privacy';
const TERMS_URL = 'https://nearmiss.io/terms';

export default function Welcome() {
  const { signInWithApple, signInWithGoogle, startDemo } = useAuth();
  // null = still checking. On iPhone we always offer Apple; if the native button isn't available
  // (it sometimes isn't inside Expo Go) we show our own button and surface any error.
  const [nativeApple, setNativeApple] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // Apple and Google sign-in aren't included in Expo Go; they work in development and App Store builds.
  const isIOS = Platform.OS === 'ios' && !inExpoGo;
  // Loaded through the same lazy require as the rest of the Google module, so Expo Go (which
  // has no native side for it) still starts.
  const GoogleButton = googleAvailable ? getGoogleButton() : null;

  useEffect(() => {
    if (!isIOS) return;
    AppleAuthentication.isAvailableAsync()
      .then(setNativeApple)
      .catch((e) => { console.warn('Apple sign-in availability check failed', e); setNativeApple(false); });
  }, [isIOS]);

  const run = (name: string, fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.warn(`${name} sign-in failed`, e);
      const detail = e instanceof Error ? e.message : String(e);
      Alert.alert(`Couldn't sign in with ${name}`, errorMessage(e) === 'Something went wrong. Please try again.' ? detail : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const apple = run('Apple', signInWithApple);
  const google = run('Google', signInWithGoogle);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 }}>
        <Wordmark size={22} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <WelcomeArt />
        </View>
        <View style={{ gap: 12 }}>
          <Display size={42} style={{ lineHeight: 43 }}>when did you almost meet?</Display>
          <Body size={17} color={colors.text2}>See the times you and your friends were steps apart, sometimes years before you met.</Body>
        </View>
        <View style={{ gap: 10, paddingTop: 28 }}>
          {isIOS && nativeApple === true && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.cardLg + 3}
              style={{ height: 54, width: '100%' }}
              onPress={apple}
            />
          )}
          {isIOS && nativeApple === false && <Button label="Continue with Apple" variant="ink" onPress={apple} />}
          {/* Google's own button, not a lookalike. Their branding guidelines want the real mark
              on a Google sign-in control, and using the component they ship means the logo is
              theirs rather than an approximation of it.

              It comes with square corners and no way to change them, which next to a pill and a
              rounded Apple button read as the odd one out. The native view cannot be told a
              corner radius, so the wrapper is the pill: it clips the button's white fill to the
              same shape as the others and draws the border the component does not have. */}
          {googleAvailable && GoogleButton
            ? <View style={{ height: 54, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.handle, backgroundColor: colors.white, overflow: 'hidden' }}>
                <GoogleButton
                  // Wide, spelled out. The component reads its size constants from the native
                  // module, and when that lookup comes back empty every one of them is undefined,
                  // which its own switch matches against the icon case first. 1 is Google's value
                  // for the wide style, so this says wide either way.
                  size={GoogleButton.Size?.Wide ?? GOOGLE_BUTTON_WIDE}
                  color={GoogleButton.Color.Light}
                  onPress={google}
                  style={{ width: '100%', height: 54 }}
                />
              </View>
            : googleAvailable
              ? <Button label="Continue with Google" variant="white" onPress={google} />
              : null}
          <Button label="Continue with email" variant={isIOS || googleAvailable ? 'white' : 'ink'} onPress={() => router.push('/email')} />
          {__DEV__ && <Button label="Look around with sample data" variant="text" onPress={startDemo} />}
          {inExpoGo && (
            <Body size={12} color={colors.muted} style={{ textAlign: 'center' }}>Apple and Google sign-in appear in the installed Near Miss app, not in Expo Go.</Body>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <TextLink label="Privacy" size={13} onPress={() => Linking.openURL(PRIVACY_URL)} />
            <Body size={13} color={colors.muted}>·</Body>
            <TextLink label="Terms" size={13} onPress={() => Linking.openURL(TERMS_URL)} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
