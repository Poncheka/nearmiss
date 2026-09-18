// A friend, for real accounts: who they are, when you met, and every near miss between you.
import { useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { Body, Card, Chip, Display, Divider, IconButton, Screen, SectionLabel } from '@/components/ui';
import { useContacts } from '@/lib/contacts';
import { formatWhen, kindLabel, nearLabel, placeLabel, useNearMisses } from '@/lib/nearMisses';
import { colors, pastel, radius } from '@/theme';

export function RealFriendScreen({ id }: { id: string }) {
  const friend = useContacts((s) => s.friends.find((f) => f.id === id));
  const status = useContacts((s) => s.statuses[id]);
  const items = useNearMisses((s) => s.items);
  const needsMet = useNearMisses((s) => s.needsMetOn.find((n) => n.friend_id === id));

  useFocusEffect(useCallback(() => {
    useContacts.getState().refreshFriends();
    useNearMisses.getState().load();
  }, []));

  const misses = useMemo(
    () => items.filter((n) => n.other_id === id).sort((a, b) => a.closest_at.localeCompare(b.closest_at)),
    [items, id],
  );
  const before = misses.filter((n) => n.is_before_met);
  const since = misses.filter((n) => !n.is_before_met);

  const name = friend?.name?.split(' ')[0] || (friend?.username ? `@${friend.username}` : 'Friend');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  // met_on isn't returned per friend here; if we're still asking about them, it's unset.
  const metKnown = !needsMet && misses.length > 0;

  const Section = ({ title, list }: { title: string; list: typeof misses }) => (
    <View>
      <SectionLabel>{title}</SectionLabel>
      <Card style={{ paddingHorizontal: 16, paddingVertical: 2 }}>
        {list.map((nm, i) => {
          const when = formatWhen(nm.closest_at);
          return (
            <View key={nm.id}>
              <Pressable
                onPress={() => router.push({ pathname: '/near-miss/[id]', params: { id: nm.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Body size={16} weight="semibold" numberOfLines={1}>{placeLabel(nm).split(',')[0]}</Body>
                  <Body size={13} color={colors.muted}>{when.date}</Body>
                  <View style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>
                    <Chip label={kindLabel(nm)} tone={nm.kind === 'crossed' ? 'violet' : 'outline'} />
                    <Chip label={nearLabel(nm)} tone="sand" />
                  </View>
                </View>
                <ChevronRight size={18} color={colors.faint} />
              </Pressable>
              {i < list.length - 1 && <Divider />}
            </View>
          );
        })}
      </Card>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 16 }}>
        <Card style={{ padding: 20, alignItems: 'center', gap: 8 }}>
          {friend?.avatar_url
            ? <Image source={{ uri: friend.avatar_url }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={pastel.peach} size={88} />}
          <Display size={26}>{friend?.name || name}</Display>
          {friend?.username ? <Body size={15} color={colors.muted}>@{friend.username}</Body> : null}
          {status && status !== 'friends' ? (
            <Chip label={status === 'requested' ? 'Request sent' : 'Wants to be friends'} tone="outline" />
          ) : null}
          <Body size={15} color={colors.text2} style={{ paddingTop: 6 }}>
            {misses.length === 0
              ? 'No near misses yet'
              : `${misses.length} near ${misses.length === 1 ? 'miss' : 'misses'}${before.length ? ` · ${before.length} before you met` : ''}`}
          </Body>
        </Card>

        {/* Set it or change it later — the feed asks once, this is where you correct it. */}
        {misses.length > 0 && (
          <Pressable onPress={() => router.push({ pathname: '/met/[id]', params: { id } })}>
            <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.card, backgroundColor: colors.violetTint, alignItems: 'center', justifyContent: 'center' }}>
                <CalendarDays size={19} color={colors.violet} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Body size={16} weight="semibold">When you met</Body>
                <Body size={14} color={colors.muted}>
                  {metKnown ? 'Tap to change' : `Not set — everything is in one list`}
                </Body>
              </View>
              <ChevronRight size={18} color={colors.faint} />
            </Card>
          </Pressable>
        )}

        {before.length > 0 && <Section title="Before you met" list={before} />}
        {since.length > 0 && <Section title={metKnown ? 'Since you met' : 'Near misses'} list={since} />}

        {misses.length === 0 && (
          <Card style={{ padding: 18, gap: 6 }}>
            <Body size={16} weight="bold">Nothing yet</Body>
            <Body size={14} color={colors.muted}>
              Near misses appear once you have both scanned your photos. Anything from the last 30 days is never matched.
            </Body>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
