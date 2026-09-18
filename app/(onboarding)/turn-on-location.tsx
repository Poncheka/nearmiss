// The last step, and the only optional one.
//
// Asked here rather than buried in settings because the moment it saves you work — marking home
// as a hidden place — comes up in the first few minutes, and an iOS permission prompt out of
// nowhere reads as a demand. Skipping costs nothing: everything in the app works without it.
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { EyeOff, MapPin, Navigation } from 'lucide-react-native';
import { Body, Button, Card, Display, IconTile, ProgressDots, Screen, TextLink } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

const POINTS = [
  {
    icon: <EyeOff size={19} color={colors.ink} strokeWidth={2} />,
    title: 'Hide home and work in one tap',
    body: 'Mark them by standing there, instead of typing an address.',
  },
  {
    icon: <MapPin size={19} color={colors.ink} strokeWidth={2} />,
    title: 'Read once, when you ask',
    body: 'Never in the background, never while the app is closed.',
  },
];

export default function TurnOnLocation() {
  const { finishOnboarding } = useAuth();
  const [busy, setBusy] = useState(false);

  const done = async () => {
    // Onboarding finishing is what moves you into the app; the guard in the root layout does
    // the navigating. Falling through on failure would strand you on this screen.
    try { await finishOnboarding(); } catch { /* the app opens anyway */ }
    router.replace('/');
  };

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS !== 'web') await Location.requestForegroundPermissionsAsync();
    } catch {
      // Declined, or unavailable. Either way, on to the app.
    } finally {
      setBusy(false);
      done();
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 44 }}>
          <ProgressDots total={4} active={4} />
        </View>

        <View style={{ gap: 12 }}>
          <IconTile bg={colors.greenTint} size={52} radiusSize={18}>
            <Navigation size={24} color={colors.ink} strokeWidth={2} />
          </IconTile>
          <Display size={32}>One last thing</Display>
          <Body size={17} color={colors.text2}>
            Near Miss works out where you have been from your photos, not from your phone. Location is
            only here to save you typing.
          </Body>
        </View>

        <Card style={{ padding: 16, gap: 18 }}>
          {POINTS.map((p) => (
            <View key={p.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <IconTile bg={colors.sand} size={40} radiusSize={14}>{p.icon}</IconTile>
              <View style={{ flex: 1 }}>
                <Body size={16} weight="semibold">{p.title}</Body>
                <Body size={14} color={colors.muted}>{p.body}</Body>
              </View>
            </View>
          ))}
        </Card>

        <View style={{ flex: 1 }} />

        {busy
          ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
          : <Button label="Turn on location" onPress={allow} />}
        <View style={{ alignItems: 'center' }}>
          <TextLink label="Not now" onPress={done} />
        </View>
      </ScrollView>
    </Screen>
  );
}
