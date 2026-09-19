// A friend, for real accounts: who they are, when you met, and every near miss between you.
import { useCallback, useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { Body, Card, Chip, Display, Divider, IconButton, Screen, SectionLabel } from '@/components/ui';
import { useContacts } from '@/lib/contacts';
import { useNearMisses } from '@/lib/nearMisses';
import { NearMissCard } from '@/components/NearMissCard';
import { useAuth } from '@/lib/auth';
import { blockUser, unfriend } from '@/lib/relationships';
import { colors, pastel, radius } from '@/theme';

export function RealFriendScreen({ id }: { id: string }) {
  const friend = useContacts((s) => s.friends.find((f) => f.id === id));
  const status = useContacts((s) => s.statuses[id]);
  const items = useNearMisses((s) => s.items);
  const needsMet = useNearMisses((s) => s.needsMetOn.find((n) => n.friend_id === id));
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width, 640) - 40 - 2;

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

  // You can land here from a near miss with someone who isn't in your friends list, which is
  // exactly what a friend-of-a-friend match is. The near miss already carries their name and
  // picture, so use that rather than showing an empty profile.
  const person = friend ?? (misses.length
    ? {
        name: misses[0].other_name,
        username: misses[0].other_username,
        avatar_url: misses[0].other_avatar_url,
      }
    : undefined);

  const name = person?.name?.split(' ')[0] || (person?.username ? `@${person.username}` : 'Friend');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  // met_on isn't returned per friend here; if we're still asking about them, it's unset.
  const metKnown = !needsMet && misses.length > 0;

  // The same card as the feed, so moving between the two doesn't feel like two different apps.
  // Leaving has to actually remove what they can see, so both of these delete the near misses
  // between you rather than just changing a label. Said plainly in the confirmation, because
  // it is not reversible and people reasonably assume "unfriend" is.
  const leave = (kind: 'unfriend' | 'block') => {
    const isBlock = kind === 'block';
    Alert.alert(
      isBlock ? `Block ${name}?` : `Remove ${name}?`,
      isBlock
        ? `Your ${misses.length} near ${misses.length === 1 ? 'miss' : 'misses'} together are deleted, along with anything either of you shared on them. ${name} won't be able to find you, add you, or match with you again. They are not told.`
        : `Your ${misses.length} near ${misses.length === 1 ? 'miss' : 'misses'} together are deleted, along with anything either of you shared on them. Either of you can add the other again later, but this doesn't come back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isBlock ? 'Block' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isBlock) await blockUser(id); else await unfriend(id);
              useNearMisses.setState((st) => ({ items: st.items.filter((n) => n.other_id !== id) }));
              useContacts.getState().refreshFriends();
              router.replace('/you');
            } catch (e) {
              Alert.alert(isBlock ? "Couldn't block them" : "Couldn't remove them", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  const openMenu = () => Alert.alert(name, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: `Remove ${name}`, style: 'destructive', onPress: () => leave('unfriend') },
    { text: `Block ${name}`, style: 'destructive', onPress: () => leave('block') },
  ]);

  const Section = ({ title, list }: { title: string; list: typeof misses }) => (
    <View style={{ gap: 10 }}>
      <SectionLabel>{title}</SectionLabel>
      {list.map((nm) => (
        <NearMissCard key={nm.id} nm={nm} width={cardWidth} myBirthday={profile?.birthday} />
      ))}
    </View>
  );

  return (
    <Screen edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        {status === 'friends' || misses.length > 0 ? (
          <IconButton label={`Options for ${name}`} onPress={openMenu}>
            <MoreHorizontal size={20} color={colors.ink} />
          </IconButton>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 16 }}>
        <Card style={{ padding: 20, alignItems: 'center', gap: 8 }}>
          {person?.avatar_url
            ? <Image source={{ uri: person.avatar_url }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={pastel.peach} size={88} />}
          <Display size={26}>{person?.name || name}</Display>
          {person?.username ? <Body size={15} color={colors.muted}>@{person.username}</Body> : null}
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
                  {metKnown ? 'Tap to change' : `Not set, so everything is in one list`}
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
