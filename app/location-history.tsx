// Bringing your own location history in.
//
// Photos only know where you were when you took one, which is a small and oddly biased sample:
// the concert, not the walk home. Google Timeline knows the rest, and for anyone who has had it
// on for years it is the single biggest thing that can happen to this app's results.
//
// There is no account to link. Google retired the Timeline API and moved the data onto the
// phone, so the export is a file the person makes themselves, which means the instructions are
// the feature. They are written for what the Google Maps app actually looks like, and they say
// plainly when a step is slow or when the export takes a while to arrive.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Clock, FileJson, MapPinned, Trash2 } from 'lucide-react-native';
import { Body, Button, Card, Display, Divider, IconButton, IconTile, Screen, SectionLabel, TextLink } from '@/components/ui';
import { clearTimelineData, ImportProgress, importTimelineFile, timelineStats } from '@/lib/timelineImport';
import { useNearMisses } from '@/lib/nearMisses';
import { colors, radius } from '@/theme';

const STEPS = [
  {
    title: 'Open Google Maps on your phone',
    body: 'The app, not the website. The export only exists on the device that recorded it.',
  },
  {
    title: 'Tap your profile picture, then Settings',
    body: 'Top right of the screen.',
  },
  {
    title: 'Open "Personal content", then "Export Timeline data"',
    body: 'On some versions it sits under "Location & privacy" instead. Either way the words "Timeline" and "Export" are what to look for.',
  },
  {
    title: 'Save it to Files',
    body: 'Choose "Save to Files" and put it somewhere easy to find, like On My iPhone or iCloud Drive. The file is called Timeline.json.',
  },
  {
    title: 'Come back here and pick that file',
    body: 'It is read on your phone. Only the places and times come to Near Miss, never the file itself.',
  },
];

const nice = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;

export default function LocationHistory() {
  const [stats, setStats] = useState<{ points: number; oldest: string | null; newest: string | null } | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [done, setDone] = useState<{ visits: number; points: number } | null>(null);

  const refresh = useCallback(() => {
    timelineStats().then(setStats).catch(() => setStats(null));
  }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const pick = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Picker = require('expo-document-picker') as typeof import('expo-document-picker');
      const picked = await Picker.getDocumentAsync({
        // Google names it .json, but iOS sometimes reports it as plain text or octet-stream, and
        // a too-strict filter greys out the one file the person came here to choose.
        type: ['application/json', 'public.json', 'text/plain', 'public.data'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;

      setDone(null);
      const result = await importTimelineFile(picked.assets[0].uri, { onProgress: setProgress });
      setProgress(null);
      setDone({ visits: result.visits, points: result.points });
      refresh();
      // New history means new near misses, so go and look for them.
      useNearMisses.getState().load({ rematch: true });
    } catch (e) {
      setProgress(null);
      Alert.alert("Couldn't import that", e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => Alert.alert(
    'Remove imported history?',
    'Near misses found only from your history will go with it. Your photos are not affected.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await clearTimelineData();
            setDone(null);
            refresh();
            useNearMisses.getState().load({ rematch: true });
          } catch (e) {
            Alert.alert("Couldn't remove it", e instanceof Error ? e.message : String(e));
          }
        },
      },
    ],
  );

  const busy = progress !== null;
  const has = (stats?.points ?? 0) > 0;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16 }}>
        <IconTile bg={colors.violetTint} size={52} radiusSize={18}>
          <MapPinned size={24} color={colors.ink} strokeWidth={2} />
        </IconTile>
        <Display size={32}>Your location history</Display>
        <Body size={17} color={colors.text2}>
          Your photos only know where you were when you took one. If you have had Google Timeline
          switched on, it knows the rest, and it usually finds far more near misses than photos do
          on their own.
        </Body>

        {has ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile bg={colors.greenTint} size={40} radiusSize={14}>
                <Clock size={19} color={colors.ink} strokeWidth={2} />
              </IconTile>
              <View style={{ flex: 1 }}>
                <Body size={16} weight="bold">
                  {stats!.points.toLocaleString()} places on file
                </Body>
                <Body size={13} color={colors.muted}>
                  {nice(stats!.oldest) && nice(stats!.newest)
                    ? `${nice(stats!.oldest)} to ${nice(stats!.newest)}`
                    : 'Imported from Google Timeline'}
                </Body>
              </View>
            </View>
            <Divider />
            <Body size={14} color={colors.muted}>
              Importing again is safe. Anything already here is recognised and skipped, so you can
              add a newer export whenever you like.
            </Body>
          </Card>
        ) : null}

        {busy ? (
          <Card style={{ padding: 20, gap: 12, alignItems: 'center' }}>
            <ActivityIndicator color={colors.violet} />
            <Body size={16} weight="semibold">
              {progress!.phase === 'reading' ? 'Reading the file'
                : progress!.phase === 'parsing' ? 'Looking for your visits'
                : progress!.phase === 'saving' ? `Saving ${progress!.saved.toLocaleString()} of ${progress!.points.toLocaleString()}`
                : 'Done'}
            </Body>
            <Body size={13} color={colors.muted} style={{ textAlign: 'center' }}>
              A few years of history can take a minute. Keep the app open.
            </Body>
          </Card>
        ) : done ? (
          <Card style={{ padding: 16, gap: 8 }}>
            <Body size={17} weight="bold">
              {done.visits.toLocaleString()} places added
            </Body>
            <Body size={15} color={colors.text2}>
              Near Miss is looking for new matches now. They turn up in your feed as it finds them.
            </Body>
          </Card>
        ) : null}

        {!busy && (
          <Button label={has ? 'Import another export' : 'Choose your Timeline file'} onPress={pick} />
        )}

        <SectionLabel>How to get the file</SectionLabel>
        <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {STEPS.map((s, i) => (
            <View key={s.title}>
              <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 14 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                  <Body size={13} weight="bold" color={colors.white}>{i + 1}</Body>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body size={16} weight="semibold">{s.title}</Body>
                  <Body size={14} color={colors.muted}>{s.body}</Body>
                </View>
              </View>
              {i < STEPS.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FileJson size={18} color={colors.muted} strokeWidth={2} />
            <Body size={15} weight="semibold">If you cannot find the export</Body>
          </View>
          <Body size={14} color={colors.muted}>
            Google moved Timeline onto the phone, so an older Google Takeout download may not have
            it. Takeout files still work if that is what you have. What will not work is a link to
            your Google account: Google closed that off, so nobody can offer it any more.
          </Body>
          <TextLink
            label="Google's page on exporting Timeline"
            onPress={() => Linking.openURL('https://support.google.com/maps/answer/14169818')}
          />
        </Card>

        <Card style={{ padding: 16, gap: 8 }}>
          <Body size={15} weight="semibold">What is taken from the file</Body>
          <Body size={14} color={colors.muted}>
            Only the places you stopped, with the times you were there. The routes between them are
            skipped on purpose: two strangers passing on a freeway is true and worth nothing, and it
            would bury the near misses that matter. Anything from the last 30 days is left out, the
            same as with photos.
          </Body>
        </Card>

        {has ? (
          <Pressable onPress={remove} style={{ paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder }}>
              <Trash2 size={16} color={colors.danger} strokeWidth={2} />
              <Body size={15} weight="semibold" color={colors.danger}>Remove imported history</Body>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
