import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Bell, ChevronRight, MessageCircle } from 'lucide-react-native';
import { Body, Chip, ChipTone, Display, IconButton, Screen, UnreadDot } from '@/components/ui';
import { Avatar, AvatarPair, PersonAvatar } from '@/components/avatar';
import { PairMap } from '@/components/map/PairMap';
import { useAuth } from '@/lib/auth';
import { formatWhen, kindLabel, nearLabel, otherName, placeLabel, RealNearMiss, useNearMisses } from '@/lib/nearMisses';
import { MiniMap } from '@/components/art';
import { activity, nearMisses, NearMiss, people } from '@/data/mock';
import { isBeforeMet, useStore } from '@/state/store';
import { colors, fonts, pastel, radius } from '@/theme';

const PAD = 16;
const openNearMiss = (id: string) => router.push({ pathname: '/near-miss/[id]', params: { id } });

type Row = { kind: 'year'; year: number } | { kind: 'post'; nm: NearMiss } | { kind: 'real'; nm: RealNearMiss };

const PASTELS = [pastel.lilac, pastel.peach, pastel.sage, pastel.butter, pastel.sky];
const colorFor = (key: string) => PASTELS[[...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PASTELS.length];

/** You + them, with real profile photos when there are some. */
function RealPair({ nm, size = 34 }: { nm: RealNearMiss; size?: number }) {
  const offset = Math.round(size * 0.62);
  const name = otherName(nm);
  return (
    <View style={{ width: size + offset, height: size }}>
      <View style={{ position: 'absolute', left: 0 }}><PersonAvatar id="jeff" size={size} ring /></View>
      <View style={{ position: 'absolute', left: offset }}>
        {nm.other_avatar_url
          ? <Image source={{ uri: nm.other_avatar_url }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.white }} />
          : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={colorFor(nm.other_id)} size={size} ring />}
      </View>
    </View>
  );
}

const RealPost = memo(function RealPost({ nm, width }: { nm: RealNearMiss; width: number }) {
  const name = otherName(nm);
  const when = formatWhen(nm.closest_at);
  const place = placeLabel(nm);
  const mapHeight = Math.round(width * 0.72);
  const tags: { label: string; tone: ChipTone }[] = [];
  if (nm.is_new) tags.push({ label: 'New', tone: 'violet' });
  tags.push({ label: kindLabel(nm), tone: nm.kind === 'crossed' ? 'violet' : 'outline' });
  if (nm.via_name) tags.push({ label: `Friend of ${nm.via_name.split(' ')[0]}`, tone: 'green' });
  if (nm.is_before_met) tags.push({ label: 'Before you met', tone: 'coral' });
  return (
    <Pressable onPress={() => openNearMiss(nm.id)} accessibilityRole="button" accessibilityLabel={`${place}, you and ${name}, ${when.date}`}>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.cardLg, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
          <RealPair nm={nm} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>
              {place.split(',')[0]}
              <Text style={{ fontFamily: fonts.semibold, color: colors.muted }}> · You + {name}</Text>
            </Text>
            <Body size={13} color={colors.muted} numberOfLines={1}>{when.date} · {when.time}</Body>
          </View>
          {nm.unread_count > 0 && <UnreadDot label={`${nm.unread_count} new`} />}
        </View>
        <View>
          <PairMap me={{ latitude: nm.my_lat, longitude: nm.my_lng }} them={{ latitude: nm.their_lat, longitude: nm.their_lng }} height={mapHeight} width={width} />
          <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{nearLabel(nm)}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 8 }}>
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tags.map((t) => <Chip key={t.label} label={t.label} tone={t.tone} />)}
            </View>
          )}
          <Body size={15} color={colors.text2}>
            {nm.kind === 'crossed'
              ? `You and ${name} were ${nm.distance_m}m apart${nm.place_name ? ` at ${place.split(',')[0]}` : ''}.`
              : `You and ${name} were both ${nm.place_name ? `at ${place.split(',')[0]}` : 'in the same spot'} that night, ${nearLabel(nm).toLowerCase()}.`}
          </Body>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={16} color={colors.muted} strokeWidth={2} />
              <Body size={14} weight="semibold" color={colors.muted}>
                {nm.comment_count > 0 ? `${nm.comment_count} comment${nm.comment_count > 1 ? 's' : ''}` : `Ask ${name} about it`}
              </Body>
            </View>
            <ChevronRight size={16} color={colors.faint} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

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
  const { demo } = useAuth();
  const real = useNearMisses();
  useFocusEffect(useCallback(() => { if (!demo) useNearMisses.getState().load(); }, [demo]));
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
    if (!demo) {
      for (const nm of real.items) {
        const y = new Date(nm.closest_at).getFullYear();
        if (y !== year) { year = y; out.push({ kind: 'year', year }); }
        out.push({ kind: 'real', nm });
      }
      return out;
    }
    for (const nm of [...nearMisses].sort((a, b) => a.date.localeCompare(b.date))) {
      if (nm.year !== year) { year = nm.year; out.push({ kind: 'year', year }); }
      out.push({ kind: 'post', nm });
    }
    return out;
  }, [demo, real.items]);

  const tagsFor = (nm: NearMiss) => {
    const t: { label: string; tone: ChipTone }[] = [];
    if (nm.isNew && !seen[nm.id]) t.push({ label: 'New', tone: 'violet' });
    if (nm.viaFriendId) t.push({ label: `Friend of ${people[nm.viaFriendId].name}`, tone: 'green' });
    if (isBeforeMet(met, nm)) t.push({ label: 'Before you met', tone: 'coral' });
    return t;
  };

  const unreadActivity = !demo || activityRead ? 0 : activity.filter((a) => a.fresh).length;

  const header = !demo ? null : (
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

  const empty = !demo && real.loaded && rows.length === 0;
  const footer = empty ? null : (
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
        initialNumToRender={4}
        windowSize={5}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        refreshControl={demo ? undefined : <RefreshControl refreshing={real.loading && real.loaded} onRefresh={() => real.load({ rematch: true })} tintColor={colors.violet} />}
        ListEmptyComponent={demo ? null : !real.loaded ? (
          <ActivityIndicator color={colors.violet} style={{ paddingTop: 60 }} />
        ) : (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 48, paddingHorizontal: 12 }}>
            <Display size={26} style={{ textAlign: 'center' }}>No near misses yet</Display>
            <Body size={16} color={colors.text2} style={{ textAlign: 'center' }}>
              {real.error ?? "They show up here when friends join and scan their photos. The more friends you add, the more you'll find."}
            </Body>
            <Pressable onPress={() => router.navigate('/invite')} style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: colors.violet, justifyContent: 'center', marginTop: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>Invite friends</Text>
            </Pressable>
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 24, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        renderItem={({ item }) => item.kind === 'real' ? (
          <RealPost nm={item.nm} width={cardWidth} />
        ) : item.kind === 'year' ? (
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
