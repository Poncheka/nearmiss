import { Alert, Pressable, ScrollView, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Body, Card, Display, Divider, Segmented, Screen, SectionLabel, TextLink, Toggle } from '@/components/ui';
import { PersonAvatar } from '@/components/avatar';
import { Settings, useAuth } from '@/lib/auth';
import { colors } from '@/theme';

type Audience = Settings['audience'];
type Delay = '3' | '7' | '14' | '30';
type NotifKey = 'notify_photos' | 'notify_replies' | 'notify_joins' | 'notify_weekly_report' | 'notify_on_this_day';

const audienceOptions: { id: Audience; label: string; sub: string }[] = [
  { id: 'friends', label: 'Friends only', sub: 'People you have added' },
  { id: 'fof', label: 'Friends + friends of friends', sub: 'They see where and when, never your path' },
  { id: 'everyone', label: 'Everyone on Near Miss', sub: 'Strangers can match with you. Names stay hidden until you both say hi.' },
];

const delayOptions: { id: Delay; label: string }[] = [
  { id: '3', label: '3 days' },
  { id: '7', label: '1 week' },
  { id: '14', label: '2 weeks' },
  { id: '30', label: '1 month' },
];

const notifOptions: { id: NotifKey; label: string; sub: string }[] = [
  { id: 'notify_photos', label: 'Photos shared with you', sub: 'Right away' },
  { id: 'notify_replies', label: 'Replies', sub: 'Bundled per near miss' },
  { id: 'notify_joins', label: 'Friends joining', sub: 'With your near misses together' },
  { id: 'notify_weekly_report', label: 'Weekly report', sub: 'New near misses, every Sunday' },
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

export default function You() {
  const { profile, settings, updateSettings, signOut, demo } = useAuth();
  const isPublic = settings.audience === 'everyone';
  const save = (patch: Partial<Settings>) => updateSettings(patch).catch(() => Alert.alert("Couldn't save", 'Check your connection and try again.'));
  const confirmSignOut = () => Alert.alert('Sign out?', '', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); } },
  ]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Display size={32}>You</Display>
        <TextLink label="Edit" size={17} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 }}>
        <Card style={{ padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <PersonAvatar id="jeff" size={64} />
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
        {isPublic && (
          <View style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.violetTint }}>
            <Body size={13} color={colors.violetInk}>Public never means live. Strangers only see a place and time, at least a week later, and never your path, home or work.</Body>
          </View>
        )}

        <SectionLabel>Recent near misses show up after</SectionLabel>
        <Segmented options={delayOptions} value={String(settings.delay_days) as Delay} onChange={(d) => save({ delay_days: Number(d) as Settings['delay_days'] })} disabled={isPublic ? ['3'] : []} />
        <Body size={13} color={colors.muted} style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          Only applies to new near misses from your location. Ones from your photo history show up right away, since they're already in the past.
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
        <Group>
          {['Home', 'Work'].map((p) => (
            <Row key={p}>
              <Label title={p} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Body size={14} color={colors.muted}>300m around</Body>
                <ChevronRight size={16} color={colors.faint} />
              </View>
            </Row>
          ))}
          <Row last><TextLink label="Add a place" /></Row>
        </Group>

        <SectionLabel>Your data</SectionLabel>
        <Group>
          <Row>
            <Label title="Photos scanned" sub="2,941 with a time and place" />
            <TextLink label="Rescan" size={15} />
          </Row>
          <Row last>
            <Label title="Background location" sub={settings.background_location ? 'On. Finding new near misses.' : 'Off. Photo history only.'} />
            <Toggle value={settings.background_location} onChange={() => save({ background_location: !settings.background_location })} />
          </Row>
        </Group>

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
