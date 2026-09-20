// The last step, and the only optional one.
//
// Asked here rather than buried in settings because the moment it saves you work, marking home
// as a hidden place, comes up in the first few minutes, and an iOS permission prompt out of
// nowhere reads as a demand. Skipping costs nothing: everything in the app works without it.
//
// Laid out exactly like the photo step, because these two are the same kind of moment and
// should feel like it: an illustration, a heading, one sentence, three short promises, then the
// ask. It used to be a paragraph over a card of two-line rows, which asked people to read more
// at the point they are least willing to.
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Check, ChevronLeft, EyeOff, MapPin } from 'lucide-react-native';
import { Body, Button, Display, IconButton, IconTile, ProgressDots, Screen } from '@/components/ui';
import { LocationArt } from '@/components/art';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

// Same row as the photo step. flex on the text, or a long label runs off a narrow phone instead
// of wrapping and loses its last word.
function Point({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconTile size={30} radiusSize={10}>{icon}</IconTile>
      <Body size={15} weight="semibold" style={{ flex: 1 }}>{label}</Body>
    </View>
  );
}

export default function TurnOnLocation() {
  const { finishOnboarding } = useAuth();
  const [busy, setBusy] = useState(false);

  // Finishing onboarding is what moves you into the app; the guard in the root layout does the
  // navigating. Every way off this screen has to go through here. Miss one and that account is
  // stuck repeating onboarding forever, which is exactly what happened the last time this
  // screen moved.
  const done = async () => {
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
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label="Back" onPress={() => router.back()}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <ProgressDots total={4} active={4} />
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, gap: 18 }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LocationArt />
          </View>
          <View style={{ gap: 10 }}>
            <Display size={34}>One last thing</Display>
            <Body size={17} color={colors.text2}>
              Near Miss works out where you have been from your photos, not from your phone.
              Location is only here to save you typing.
            </Body>
          </View>
          <View style={{ gap: 10 }}>
            <Point icon={<EyeOff size={16} color={colors.violet} strokeWidth={2.2} />} label="Hide home and work by standing there" />
            <Point icon={<MapPin size={16} color={colors.violet} strokeWidth={2.2} />} label="Read once when you ask, never in the background" />
            <Point icon={<Check size={16} color={colors.violet} strokeWidth={2.2} />} label="Everything works without it" />
          </View>
          <View style={{ gap: 4 }}>
            {busy
              ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
              : <Button label="Turn on location" onPress={allow} />}
            <Button label="Not now" variant="text" onPress={done} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
