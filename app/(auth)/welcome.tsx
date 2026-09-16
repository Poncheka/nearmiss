import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Body, Button, Display, Screen, TextLink } from '@/components/ui';
import { WelcomeArt } from '@/components/art';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors, radius } from '@/theme';

export default function Welcome() {
  const { signInWithApple, startDemo } = useAuth();
  // null = still checking. On iPhone we always offer Apple; if the native button isn't available
  // (it sometimes isn't inside Expo Go) we show our own button and surface any error.
  const [nativeApple, setNativeApple] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  // Apple sign-in isn't included in Expo Go; it works in development and App Store builds.
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isIOS = Platform.OS === 'ios' && !inExpoGo;

  useEffect(() => {
    if (!isIOS) return;
    AppleAuthentication.isAvailableAsync()
      .then(setNativeApple)
      .catch((e) => { console.warn('Apple sign-in availability check failed', e); setNativeApple(false); });
  }, [isIOS]);

  const apple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithApple();
    } catch (e) {
      console.warn('Apple sign-in failed', e);
      const detail = e instanceof Error ? e.message : String(e);
      Alert.alert("Couldn't sign in with Apple", errorMessage(e) === 'Something went wrong. Please try again.' ? detail : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 }}>
        <Display size={22}>📍 near miss</Display>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <WelcomeArt />
        </View>
        <View style={{ gap: 12 }}>
          <Display size={42} style={{ lineHeight: 43 }}>who did you almost meet?</Display>
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
          <Button label="Continue with email" variant={isIOS ? 'white' : 'ink'} onPress={() => router.push('/email')} />
          {__DEV__ && <Button label="Look around with sample data" variant="text" onPress={startDemo} />}
          {inExpoGo && Platform.OS === 'ios' && (
            <Body size={12} color={colors.muted} style={{ textAlign: 'center' }}>Apple sign-in appears in the installed Near Miss app, not in Expo Go.</Body>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Body size={13} color={colors.muted}>18+ only ·</Body>
            <TextLink label="Privacy" size={13} />
            <Body size={13} color={colors.muted}>·</Body>
            <TextLink label="Terms" size={13} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
