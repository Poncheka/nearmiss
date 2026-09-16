import { View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Display, Screen, TextLink } from '@/components/ui';
import { WelcomeArt } from '@/components/art';
import { colors } from '@/theme';

export default function Welcome() {
  const next = () => router.push('/profile');
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
          <Button label="Continue with Apple" variant="ink" onPress={next} />
          <Button label="Continue with Google" variant="white" onPress={next} />
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
