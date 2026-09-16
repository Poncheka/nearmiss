import { memo, useMemo } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, ChevronRight, MessageCircle } from 'lucide-react-native';
import { Body, Chip, ChipTone, Display, IconButton, Screen, UnreadDot } from '@/components/ui';
import { AvatarPair, PersonAvatar } from '@/components/avatar';
import { MiniMap } from '@/components/art';
import { activity, nearMisses, NearMiss, people } from '@/data/mock';
import { isBeforeMet, useStore } from '@/state/store';
import { colors, fonts, radius } from '@/theme';

const PAD = 16;
const openNearMiss = (id: string) => router.push({ pathname: '/near-miss/[id]', params: { id } });

type Row = { kind: 'year'; year: number } | { kind: 'post'; nm: NearMiss };

const Post = memo(function Post({ nm, width, tags, unread, commentCount }: {
  nm: NearMiss; width: number; tags: { label: string; tone: ChipTone }[]; unread: number; commentCount: number;
}) {
  const friend = people[nm.friendId];
  const placeShort = nm.place.split(',')[0];
  const mapHeight = Math.round(width * 0.72);
  return (
    <Pressable onPress={() => openNearMiss(nm.id)} accessibilityRole="button" accessibilityLabel={`${placeShort}, you and ${friend.name}, ${nm.dateLong}`}>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.cardLg, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' }}>
        {/* Header, like a post */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
          <AvatarPair otherId={nm.friendId} size={34} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>
              {placeShort}
              <Text style={{ fontFamily: fonts.semibold, color: colors.muted }}> · You + {friend.name}</Text>
            </Text>
            <Body size={13} color={colors.muted} numberOfLines={1}>{nm.dateLong} · {nm.time}</Body>
          </View>
          {unread > 0 && <UnreadDot label={`${unread} new`} />}
        </View>

        {/* The "photo" is the map of where you both were */}
        <View>
          <MiniMap width={width} height={mapHeight} distance={nm.distance} spread={Math.min(0.5, nm.distance / 180)} detail label={placeShort} />
          <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{nm.distance}m apart</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 8 }}>
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tags.map((t) => <Chip key={t.label} label={t.label} tone={t.tone} />)}
            </View>
          )}
          <Body size={15} color={colors.text2}>
            {nm.revealLine ?? `You were both at ${nm.placeFull}, ${nm.timeRange}.`}
          </Body>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={16} color={colors.muted} strokeWidth={2} />
              <Body size={14} weight="semibold" color={colors.muted}>
                {commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : `Ask ${friend.name}: ${nm.prompt}`}
              </Body>
            </View>
            <ChevronRight size={16} color={colors.faint} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export default function Feed() {
  const { width } = useWindowDimensions();
  const met = useStore((s) => s.met);
  const unread = useStore((s) => s.unread);
  const seen = useStore((s) => s.seen);
  const comments = useStore((s) => s.comments);
  const activityRead = useStore((s) => s.activityRead);
  const cardWidth = Math.min(width, 640) - PAD * 2 - 2;

  // Oldest first, with a year label whenever the year changes.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let year = 0;
    for (const nm of [...nearMisses].sort((a, b) => a.date.localeCompare(b.date))) {
      if (nm.year !== year) { year = nm.year; out.push({ kind: 'year', year }); }
      out.push({ kind: 'post', nm });
    }
    return out;
  }, []);

  const tagsFor = (nm: NearMiss) => {
    const t: { label: string; tone: ChipTone }[] = [];
    if (nm.isNew && !seen[nm.id]) t.push({ label: 'New', tone: 'violet' });
    if (nm.viaFriendId) t.push({ label: `Friend of ${people[nm.viaFriendId].name}`, tone: 'green' });
    if (isBeforeMet(met, nm)) t.push({ label: 'Before you met', tone: 'coral' });
    return t;
  };

  const unreadActivity = activityRead ? 0 : activity.filter((a) => a.fresh).length;

  const header = (
    <Pressable onPress={() => router.push('/reveal')} style={{ padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.violet, gap: 12, marginBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AvatarPair otherId="maya" size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Body size={14} color="rgba(255,255,255,0.85)">Maya just joined</Body>
          <Display size={22} style={{ color: colors.white }}>You two almost met 3 times</Display>
        </View>
      </View>
      <View style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.white, justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.violet }}>See them</Text>
      </View>
    </Pressable>
  );

  const footer = (
    <View style={{ alignItems: 'center', gap: 6, paddingTop: 12, paddingHorizontal: 12 }}>
      <Body size={14} color={colors.muted} style={{ textAlign: 'center' }}>
        That's every near miss so far. More show up as friends join. Photos from the last 30 days are never matched.
      </Body>
      <Pressable onPress={() => router.navigate('/invite')} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Body size={15} weight="bold" color={colors.violet}>Invite friends</Body>
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Display size={28}>📍 near miss</Display>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View>
            <IconButton label="Activity" onPress={() => router.push('/activity')}>
              <Bell size={20} color={colors.ink} strokeWidth={1.8} />
            </IconButton>
            {unreadActivity > 0 && (
              <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.violet, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }}>{unreadActivity}</Text>
              </View>
            )}
          </View>
          <Pressable accessibilityLabel="Your profile" onPress={() => router.navigate('/you')}>
            <PersonAvatar id="jeff" size={40} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'year' ? `y${r.year}` : r.nm.id)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 24, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        renderItem={({ item }) => item.kind === 'year' ? (
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink, paddingTop: 10, paddingHorizontal: 4 }}>{item.year}</Text>
        ) : (
          <Post
            nm={item.nm}
            width={cardWidth}
            tags={tagsFor(item.nm)}
            unread={unread[item.nm.id] ?? 0}
            commentCount={(comments[item.nm.id] ?? []).length}
          />
        )}
      />
    </Screen>
  );
}
