// Location is a small, optional part of Near Miss: it is read once, in the moment you ask for it.
// This screen exists so that is easy to find, easy to understand, and easy to turn on or off.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { ChevronLeft, ChevronRight, LocateFixed, MapPinOff } from 'lucide-react-native';
import { Body, Button, Card, Display, Divider, IconButton, IconTile, Screen, SectionLabel, TextLink } from '@/components/ui';
import { colors, radius } from '@/theme';

type Status = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const USES = [
  {
    title: 'Marking a hidden place',
    body: 'Tap "I\'m here now" while adding home or work, instead of typing the address.',
  },
  {
    title: 'Naming where you are',
    body: 'Turns coordinates into a place name. This lookup happens on your phone.',
  },
];

function describe(a: Location.LocationGeocodedAddress | undefined) {
  if (!a) return '';
  return [a.name && !/^\d+$/.test(a.name) ? a.name : a.street, a.city].filter(Boolean).join(', ');
}

export default function LocationScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') { setStatus('unavailable'); return; }
    try {
      const p = await Location.getForegroundPermissionsAsync();
      setCanAskAgain(p.canAskAgain);
      setStatus(p.granted ? 'granted' : p.status === 'undetermined' ? 'undetermined' : 'denied');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useFocusEffect(useCallback(() => { setWhere(null); refresh(); }, [refresh]));

  const turnOn = async () => {
    setError('');
    if (status === 'denied' || !canAskAgain) return Linking.openSettings();
    setBusy(true);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      setCanAskAgain(p.canAskAgain);
      setStatus(p.granted ? 'granted' : 'denied');
      if (!p.granted && !p.canAskAgain) setError('iOS will not ask again. Turn it on in Settings.');
    } catch {
      setError("Couldn't ask for location. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true); setError(''); setWhere(null);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const name = describe((await Location.reverseGeocodeAsync(pos.coords))[0]);
      setWhere(name || `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
    } catch {
      setError("Couldn't get a fix. Step outside or try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));
  const on = status === 'granted';

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16 }}>
        <Display size={34}>Location</Display>
        <Body size={17} color={colors.text2}>
          Near Miss finds where you have been from your photos, not from your phone. It never follows you
          around and never asks for background location. Turning this on just saves you typing an address.
        </Body>

        <Card style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile bg={on ? colors.greenTint : colors.sand} size={40} radiusSize={14}>
              {on ? <LocateFixed size={19} color={colors.ink} strokeWidth={2} /> : <MapPinOff size={19} color={colors.muted} strokeWidth={2} />}
            </IconTile>
            <View style={{ flex: 1 }}>
              <Body size={16} weight="bold">
                {status === null ? 'Checking…'
                  : on ? 'On while you use the app'
                  : status === 'unavailable' ? 'Not available here'
                  : status === 'undetermined' ? 'Not asked yet'
                  : 'Off'}
              </Body>
              <Body size={13} color={colors.muted}>
                {on ? 'Read only when you ask for it'
                  : status === 'unavailable' ? 'Location works in the Near Miss app on your phone'
                  : 'You can still set hidden places by searching an address'}
              </Body>
            </View>
          </View>

          {status !== null && status !== 'unavailable' && (
            on ? (
              <>
                <Divider />
                {where ? (
                  <View style={{ backgroundColor: colors.sand, borderRadius: radius.card, padding: 12 }}>
                    <Body size={13} color={colors.muted}>Right now you are near</Body>
                    <Body size={16} weight="semibold">{where}</Body>
                  </View>
                ) : null}
                {busy
                  ? <ActivityIndicator color={colors.violet} />
                  : <Button label={where ? 'Check again' : 'Check it works'} variant="white" onPress={check} />}
                <Body size={13} color={colors.muted}>
                  Nothing here is saved. To turn location off, use Settings → Near Miss → Location.
                </Body>
              </>
            ) : (
              <>
                {busy
                  ? <ActivityIndicator color={colors.violet} />
                  : <Button
                      label={status === 'denied' || !canAskAgain ? 'Open Settings' : 'Turn on location'}
                      onPress={turnOn}
                    />}
              </>
            )
          )}

          {error ? <Body size={14} color={colors.danger}>{error}</Body> : null}
        </Card>

        <SectionLabel>What it is used for</SectionLabel>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {USES.map((u, i) => (
            <View key={u.title}>
              <View style={{ paddingVertical: 12, gap: 2 }}>
                <Body size={16} weight="semibold">{u.title}</Body>
                <Body size={14} color={colors.muted}>{u.body}</Body>
              </View>
              {i < USES.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        <Pressable onPress={() => router.push('/places')}>
          <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Body size={16} weight="semibold">Hidden places</Body>
              <Body size={14} color={colors.muted}>Photos taken at home or work are never saved</Body>
            </View>
            <ChevronRight size={18} color={colors.faint} />
          </Card>
        </Pressable>

        <View style={{ alignItems: 'center', paddingTop: 4 }}>
          <TextLink label="Read the privacy policy" onPress={() => Linking.openURL('https://nearmiss.io/privacy')} />
        </View>
      </ScrollView>
    </Screen>
  );
}
