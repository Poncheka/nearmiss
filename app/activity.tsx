import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { CalendarDays, Check, ChevronLeft, Heart, ImageIcon, LucideIcon, MapPin, MessageCircle, UserPlus } from 'lucide-react-native';
import { Body, Card, Display, Divider, IconButton, Pill, Screen, SectionLabel, TextLink } from '@/components/ui';
import { Avatar, PersonAvatar } from '@/components/avatar';
import { activity, activityBadge, ActivityItem } from '@/data/mock';
import { useStore } from '@/state/store';
import { useAuth } from '@/lib/auth';
import { actorName, activityText, activityWhen, RealActivity, useActivity } from '@/lib/activity';
import { useContacts } from '@/lib/contacts';
import { colors, pastel } from '@/theme';

// The badge says what kind of thing happened. It used to be a coloured circle with a white dot
// in it, which is exactly what an unread pip looks like, and it rendered on every row whether
// read or not. So a notification you had already opened still looked unopened, and the only
// honest reading was that marking as read was broken. It wasn't. The badge was lying.
const badgeFor: Record<string, { color: string; Icon: LucideIcon }> = {
  friend_request: { color: colors.violet, Icon: UserPlus },
  friend_accepted: { color: colors.greenText, Icon: Check },
  comment: { color: colors.coral, Icon: MessageCircle },
  reply: { color: colors.coral, Icon: MessageCircle },
  reaction: { color: colors.coral, Icon: Heart },
  near_miss: { color: colors.coral, Icon: MapPin },
  fof_near_miss: { color: colors.coral, Icon: MapPin },
  met_changed: { color: colors.violet, Icon: CalendarDays },
  photo_shared: { color: colors.greenText, Icon: ImageIcon },
};
const defaultBadge = { color: colors.violet, Icon: MapPin };

function RealRow({ item, last }: { item: RealActivity; last: boolean }) {
  const [busy, setBusy] = useState(false);
  const status = useContacts((s) => (item.actor_id ? s.statuses[item.actor_id] : undefined));
  const name = actorName(item);
  const unread = !item.read_at;
  const badge = badgeFor[item.type] ?? defaultBadge;

  const go = () => {
    // Reading it is what marks it read. Leaving the dot on something you just opened reads as
    // a broken list.
    useActivity.getState().markOneRead(item.id);
    if (item.near_miss_id) router.push(`/near-miss/${item.near_miss_id}` as Href);
    else if (item.actor_id) router.push(`/friend/${item.actor_id}` as Href);
  };

  const accept = async () => {
    if (!item.actor_id || busy) return;
    setBusy(true);
    try {
      await useContacts.getState().addFriend(item.actor_id);
    } catch (e) {
      Alert.alert("Couldn't accept", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Only offer Accept while the request is still waiting on you.
  const canAccept = item.type === 'friend_request' && status !== 'friends';

  return (
    <>
      <Pressable onPress={go} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14 }}>
        <View>
          {item.actor_avatar_url
            ? <Image source={{ uri: item.actor_avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={pastel.peach} size={44} />}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: badge.color, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <badge.Icon size={10} color={colors.white} strokeWidth={2.6} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Body size={15}>
            <Body size={15} weight="bold">{name}</Body> {activityText(item)}
          </Body>
          {item.body ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: colors.bg }}>
              <Body size={14} color={colors.text2}>{item.body}</Body>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            <Body size={13} color={colors.muted}>{activityWhen(item.created_at)}</Body>
            {busy ? <ActivityIndicator color={colors.violet} /> : canAccept
              ? <Pill label="Accept" height={32} textSize={13} onPress={accept} />
              : item.type === 'friend_request' ? <Body size={13} color={colors.muted}>· Friends</Body> : null}
          </View>
        </View>
        {unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.violet, marginTop: 6 }} />}
      </Pressable>
      {!last && <Divider />}
    </>
  );
}

function DemoRow({ item, unread, last }: { item: ActivityItem; unread: boolean; last: boolean }) {
  const go = () => router.push(item.href as Href);
  return (
    <>
      <Pressable onPress={go} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14 }}>
        <View>
          {item.personId === 'app'
            ? <Avatar initial="📍" color={colors.violetTint} size={44} />
            : <PersonAvatar id={item.personId} size={44} />}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: activityBadge[item.kind], borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Body size={15}><Body size={15} weight="bold">{item.who}</Body> {item.text}</Body>
          {item.quote ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: colors.bg }}>
              <Body size={14} color={colors.text2}>{item.quote}</Body>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            <Body size={13} color={colors.muted}>{item.when}</Body>
            {item.action ? <Pill label={item.action} height={32} textSize={13} onPress={go} /> : null}
          </View>
        </View>
        {unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.violet, marginTop: 6 }} />}
      </Pressable>
      {!last && <Divider />}
    </>
  );
}

export default function Activity() {
  const { demo } = useAuth();
  const read = useStore((s) => s.activityRead);
  const markRead = useStore((s) => s.markActivityRead);
  const { items, loaded, unread, load, markAllRead } = useActivity();

  useFocusEffect(useCallback(() => {
    if (demo) return;
    useActivity.getState().load();
    useContacts.getState().refreshFriends();
  }, [demo]));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (demo) {
    const fresh = activity.filter((a) => a.fresh);
    const earlier = activity.filter((a) => !a.fresh);
    return (
      <Screen>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <Body size={16} weight="bold">Activity</Body>
          <TextLink label={read ? 'All read' : 'Mark read'} size={15} onPress={markRead} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          {[{ title: 'New', items: fresh }, { title: 'Earlier this week', items: earlier }].map((g) => (
            <View key={g.title}>
              <SectionLabel>{g.title}</SectionLabel>
              <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
                {g.items.map((a, i) => <DemoRow key={a.id} item={a} unread={!read && !!a.fresh} last={i === g.items.length - 1} />)}
              </Card>
            </View>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  const fresh = items.filter((a) => !a.read_at);
  const earlier = items.filter((a) => a.read_at);
  const groups = [{ title: 'New', items: fresh }, { title: 'Earlier', items: earlier }].filter((g) => g.items.length);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        <Body size={16} weight="bold">Activity</Body>
        {unread > 0
          ? <TextLink label="Mark read" size={15} onPress={markAllRead} />
          : <View style={{ width: 44 }} />}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={undefined}
      >
        {!loaded ? <ActivityIndicator color={colors.violet} style={{ paddingTop: 60 }} /> : groups.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 10, paddingTop: 56, paddingHorizontal: 12 }}>
            <Display size={24} style={{ textAlign: 'center' }}>Nothing yet</Display>
            <Body size={16} color={colors.text2} style={{ textAlign: 'center' }}>
              Friend requests, replies on your near misses, and photos people share with you all show up here.
            </Body>
            <View style={{ paddingTop: 4 }}>
              <TextLink label="Invite a friend" onPress={() => router.navigate('/invite')} />
            </View>
          </View>
        ) : groups.map((g) => (
          <View key={g.title}>
            <SectionLabel>{g.title}</SectionLabel>
            <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
              {g.items.map((a, i) => <RealRow key={a.id} item={a} last={i === g.items.length - 1} />)}
            </Card>
          </View>
        ))}
        {loaded && items.length > 0 && (
          <Body size={13} color={colors.faint} style={{ textAlign: 'center', paddingTop: 18 }}>
            Load more by pulling down on the feed.
          </Body>
        )}
      </ScrollView>
    </Screen>
  );
}
