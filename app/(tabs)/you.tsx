import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Body, Card, Display, Divider, Segmented, Screen, SectionLabel, TextLink, Toggle } from '@/components/ui';
import { AvatarPicker } from '@/components/AvatarPicker';
import { Settings, useAuth } from '@/lib/auth';
import { Access, choosePhotos, clearScanData, getPhotoAccess, photoScanAvailable, requestPhotoAccess } from '@/lib/photoScan';
import { usePlaces } from '@/lib/places';
import { useScan } from '@/state/scan';
import { colors } from '@/theme';

type Audience = Settings['audience'];
type NotifKey = 'notify_photos' | 'notify_replies' | 'notify_joins' | 'notify_weekly_report' | 'notify_on_this_day';

const audienceOptions: { id: Audience; label: string; sub: string }[] = [
  { id: 'friends', label: 'Friends only', sub: 'People you have added' },
  { id: 'fof', label: 'Friends + friends of friends', sub: 'They see where and when, never your path' },
];


const notifOptions: { id: NotifKey; label: string; sub: string }[] = [
  { id: 'notify_photos', label: 'Photos shared with you', sub: 'Right away' },
  { id: 'notify_replies', label: 'Replies', sub: 'Bundled per near miss' },
  { id: 'notify_joins', label: 'Friends joining', sub: 'With your near misses together' },
  { id: 'notify_weekly_report', label: 'Weekly report', sub: 'New near misses from friends who joined, every Sunday' },
  { id: 'notify_on_this_day', label: 'On this day', sub: 'Anniversaries of old near misses' },
];

function Group({ children }: { children: React.ReactNode }) {
  return <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>{children}</Card>;
}

function Row({ children, last, minHeight = 52 }: { children: React.ReactNode; last?: boolean; minHeight?: number }) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight, gap: 12, paddingVertical: 6 }}>{children}</View>
      {!last && <Divider />}
    </>
  );
}

function Label({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Body size={16} weight="semibold">{title}</Body>
      {sub ? <Body size={13} color={colors.muted}>{sub}</Body> : null}
    </View>
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');
const monthYear = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');
const fmtRadius = (m: number) => (m >= 1000 ? `${m / 1000}km` : `${m}m`);

function PhotoData({ demo }: { demo: boolean }) {
  const scan = useScan();
  const [access, setAccess] = useState<Access | null>(null);

  useFocusEffect(useCallback(() => {
    if (demo) return;
    getPhotoAccess().then(setAccess).catch(() => setAccess('unavailable'));
    useScan.getState().refreshStats();
  }, [demo]));

  const rescan = async () => {
    if (demo) return Alert.alert('Sample data', 'Sign in to scan your own photos.');
    if (scan.running) return scan.stop();
    let a = access;
    if (a !== 'granted' && a !== 'limited') a = await requestPhotoAccess();
    setAccess(a);
    if (a === 'denied' || a === 'undetermined') {
      return Alert.alert('Near Miss can\'t see your photos', 'Open Settings, tap Photos, and choose Full Access.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
    const r = await scan.start();
    if (r) {
      Alert.alert('Scan finished', `${fmt(r.saved)} new photo places saved. ${fmt(r.moments)} moments in total.`);
    } else if (useScan.getState().error) {
      Alert.alert("Couldn't finish the scan", useScan.getState().error ?? '');
    }
  };

  const confirmClear = () => Alert.alert('Delete scanned data?', 'This removes every photo time and place we saved. Your photos stay on your phone. You can scan again any time.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive', onPress: async () => {
        try { await clearScanData(); await useScan.getState().refreshStats(); } catch (e) { Alert.alert("Couldn't delete", e instanceof Error ? e.message : String(e)); }
      },
    },
  ]);

  const s = scan.stats;
  const p = scan.progress;
  const sub = demo
    ? '2,941 with a time and place'
    : scan.running
      ? p?.total ? `Scanning… ${fmt(Math.min(p.scanned, p.total))} of ${fmt(p.total)}` : 'Getting ready…'
      : s
        ? s.points > 0
          ? `${fmt(s.points)} with a time and place · ${fmt(s.moments)} moments${s.oldest ? ` · since ${monthYear(s.oldest)}` : ''}`
          : 'Nothing saved yet'
        : 'Loading…';

  return (
    <Group>
      <Row minHeight={60}>
        <Label title="Photos scanned" sub={sub} />
        {scan.running ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={colors.violet} />
            <TextLink label="Stop" size={15} onPress={scan.stop} />
          </View>
        ) : photoScanAvailable || demo ? <TextLink label={demo || s?.points ? 'Rescan' : 'Scan'} size={15} onPress={rescan} /> : null}
      </Row>
      {!demo && access === 'limited' && (
        <Row minHeight={56}>
          <Label title="Some photos only" sub="You gave access to selected photos" />
          <TextLink label="Choose more" size={15} onPress={choosePhotos} />
        </Row>
      )}
      {!demo && access === 'denied' && (
        <Row minHeight={56}>
          <Label title="Photo access is off" sub="Turn on Full Access to scan" />
          <TextLink label="Settings" size={15} onPress={() => Linking.openSettings()} />
        </Row>
      )}
      {!demo && s && s.lastSaved ? (
        <Row>
          <Label title="Last saved" sub={new Date(s.lastSaved).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} />
          <TextLink label="Delete" size={15} color={colors.danger} onPress={confirmClear} />
        </Row>
      ) : null}
      <Row last>
        <Label title="Recent photos" sub="Photos from the last 30 days are never matched" />
      </Row>
    </Group>
  );
}

function HiddenPlaces({ demo }: { demo: boolean }) {
  const { places, loaded, load } = usePlaces();
  useEffect(() => { if (!demo && !loaded) load().catch(() => {}); }, [demo, loaded, load]);
  const has = (l: string) => places.some((p) => p.label.toLowerCase() === l.toLowerCase());
  const missing = ['Home', 'Work'].filter((l) => !has(l));
  return (
    <Group>
      {places.map((p) => (
        <Pressable key={p.id} onPress={() => router.push('/places')}>
          <Row>
            <Label title={p.label} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Body size={14} color={colors.muted}>{fmtRadius(p.radius_m)} around</Body>
              <ChevronRight size={16} color={colors.faint} />
            </View>
          </Row>
        </Pressable>
      ))}
      {missing.map((l) => (
        <Pressable key={l} onPress={() => router.push({ pathname: '/places', params: { add: l } })}>
          <Row>
            <Label title={l} sub="Not set" />
            <TextLink label="Set" size={15} onPress={() => router.push({ pathname: '/places', params: { add: l } })} />
          </Row>
        </Pressable>
      ))}
      <Row last><TextLink label="Add a place" onPress={() => router.push({ pathname: '/places', params: { add: '' } })} /></Row>
    </Group>
  );
}

export default function You() {
  const { profile, settings, updateSettings, signOut, demo } = useAuth();
  const save = (patch: Partial<Settings>) => updateSettings(patch).catch(() => Alert.alert("Couldn't save", 'Check your connection and try again.'));
  const confirmSignOut = () => Alert.alert('Sign out?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); } },
  ]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Display size={32}>You</Display>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
        <Card style={{ padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <AvatarPicker size={64} showLink={false} />
          <View style={{ flex: 1 }}>
            <Body size={19} weight="bold">{profile?.name || `@${profile?.username ?? ''}`}</Body>
            <Body size={14} color={colors.muted}>@{profile?.username}{profile?.bio ? ` · ${profile.bio}` : ''}</Body>
            <Body size={14} style={{ paddingTop: 4 }}>12 friends · 7 near misses</Body>
          </View>
        </Card>

        <SectionLabel>Who can find near misses with you</SectionLabel>
        <Group>
          {audienceOptions.map((o, i) => {
            const on = settings.audience === o.id;
            return (
              <Pressable key={o.id} onPress={() => save({ audience: o.id })} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <Row last={i === audienceOptions.length - 1} minHeight={60}>
                  <Label title={o.label} sub={o.sub} />
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.violet : colors.toggleOff, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.violet }} />}
                  </View>
                </Row>
              </Pressable>
            );
          })}
        </Group>
        <Body size={13} color={colors.muted} style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          Your profile is never public. Only friends and people you share a near miss with can see it.
        </Body>

        <SectionLabel>Notify me about</SectionLabel>
        <Group>
          {notifOptions.map((n, i) => (
            <Row key={n.id} last={i === notifOptions.length - 1} minHeight={60}>
              <Label title={n.label} sub={n.sub} />
              <Toggle value={settings[n.id]} onChange={() => save({ [n.id]: !settings[n.id] })} />
            </Row>
          ))}
        </Group>
        <Body size={13} color={colors.muted} style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          Replies on the same near miss are bundled into one notification, and we send a few a day at most.
        </Body>

        <SectionLabel>Hidden places</SectionLabel>
        <HiddenPlaces demo={demo} />
        <Body size={13} color={colors.muted} style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          Photos taken inside these are never saved or matched.
        </Body>

        <SectionLabel>Your data</SectionLabel>
        <PhotoData demo={demo} />

        <View style={{ height: 20 }} />
        <Group>
          <Row>
            <TextLink label="Download my data" color={colors.ink} />
            <ChevronRight size={16} color={colors.faint} />
          </Row>
          <Row><TextLink label={demo ? 'Leave sample data' : 'Sign out'} color={colors.ink} onPress={confirmSignOut} /></Row>
          <Row last><TextLink label="Delete my account" color={colors.danger} /></Row>
        </Group>
      </ScrollView>
    </Screen>
  );
}
