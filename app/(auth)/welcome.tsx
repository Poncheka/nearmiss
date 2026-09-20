import { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Body, Button, Display, Screen, TextLink, Wordmark } from '@/components/ui';
import { WelcomeArt } from '@/components/art';
import { errorMessage, googleAvailable, inExpoGo, useAuth } from '@/lib/auth';
import { colors, radius } from '@/theme';

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
          {/* Google's mark on our button, rather than Google's whole button.

              Theirs ships with square corners, its own typeface and no way to change either, so
              next to a pill and a rounded Apple button it was always going to be the odd one
              out. Their guidelines allow a button of your own as long as it carries the real
              logo, unaltered, which is what this is: the same shape, height and type as the two
              either side of it, with their asset in front of the words. */}
          {googleAvailable && (
            <Button
              label="Continue with Google"
              variant="white"
              onPress={google}
              icon={<Image source={require('../../assets/google-g.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />}
            />
          )}
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
