import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Body, Button, Display, Screen, TextLink } from '@/components/ui';
import { WelcomeArt } from '@/components/art';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors, radius } from '@/theme';

export default function Welcome() {
  const { signInWithApple, startDemo } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const apple = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signInWithApple();
    } catch (e) {
      Alert.alert("Couldn't sign in with Apple", errorMessage(e));
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
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.cardLg + 3}
              style={{ height: 54, width: '100%' }}
              onPress={apple}
            />
          )}
          <Button label="Continue with email" variant={appleAvailable ? 'white' : 'ink'} onPress={() => router.push('/email')} />
          {__DEV__ && <Button label="Look around with sample data" variant="text" onPress={startDemo} />}
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
