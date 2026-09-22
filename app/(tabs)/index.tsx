import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { Body, Chip, ChipTone, Display, IconButton, Screen, UnreadDot, Wordmark } from '@/components/ui';
import { ActivityButton } from '@/components/ActivityButton';
import { Avatar, AvatarPair, PersonAvatar } from '@/components/avatar';
import { PairMap } from '@/components/map/PairMap';
import { useAuth } from '@/lib/auth';
import { barelyMissedLine, formatWhen, isBarelyMissed, kindLabel, nearLabel, NeedsMetOn, otherName, placeLabel, RealNearMiss, useNearMisses } from '@/lib/nearMisses';
import { occasionFor } from '@/lib/occasions';
import { NearMissCard, RealPair } from '@/components/NearMissCard';
import { PushOffer } from '@/components/PushOffer';
import { canOfferPush } from '@/lib/push';
import { useActivity } from '@/lib/activity';
import { MiniMap } from '@/components/art';
import { activity, nearMisses, NearMiss, people } from '@/data/mock';
import { isBeforeMet, useStore } from '@/state/store';
import { colors, fonts, pastel, radius } from '@/theme';

const PAD = 16;
const openNearMiss = (id: string) => router.push({ pathname: '/near-miss/[id]', params: { id } });

type Row =
  | { kind: 'year'; year: number }
  | { kind: 'post'; nm: NearMiss }
  | { kind: 'real'; nm: RealNearMiss }
  | { kind: 'ask'; friend: NeedsMetOn }
  | { kind: 'since'; count: number }
  | { kind: 'push' }
  | { kind: 'found'; label: string };

const PASTELS = [pastel.lilac, pastel.peach, pastel.sage, pastel.butter, pastel.sky];
const colorFor = (key: string) => PASTELS[[...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PASTELS.length];

/** You + them, with real profile photos when there are some. */

/**
 * Two people who travel together produce a long run of near misses that are really just
 * their shared life. We can't tell those apart from the outside, but they can, so ask.
 */
function AskWhenMet({ friend }: { friend: NeedsMetOn }) {
  const [busy, setBusy] = useState(false);
  const name = friend.name?.split(' ')[0] || (friend.username ? `@${friend.username}` : 'them');
  const guessLabel = friend.guess
    ? new Date(`${friend.guess}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const open = () => router.push({ pathname: '/met/[id]', params: { id: friend.friend_id } });
  const yes = async () => {
    if (!friend.guess || busy) return;
    setBusy(true);
    try { await useNearMisses.getState().setMetOn(friend.friend_id, friend.guess); }
    catch { open(); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.violetTint, gap: 12, marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {friend.avatar_url
          ? <Image source={{ uri: friend.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
          : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={colorFor(friend.friend_id)} size={44} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Display size={20}>
            {guessLabel ? `Did you two meet around ${guessLabel}?` : `When did you and ${name} meet?`}
          </Display>
        </View>
      </View>

      <Body size={14} color={colors.text2}>
        {guessLabel
          ? `Before this you turned up near each other every few months. After it, every few weeks, which usually means you already knew each other. Everything from after you met moves into its own section.`
          : `Knowing this separates the near misses worth seeing from the days you already spent together.`}
      </Body>

      {busy ? <ActivityIndicator color={colors.violet} /> : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {friend.guess && (
            <Pressable onPress={yes} style={{ minHeight: 40, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.violet, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.white }}>Yes, that's right</Text>
            </Pressable>
          )}
          <Pressable onPress={open} style={{ minHeight: 40, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.inputBorder, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{friend.guess ? 'Pick a date' : 'Set the date'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

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

/**
 * Two ways to read the same near misses.
 *
 * Timeline is the point of the app: oldest first, so it reads as a history of
 * two lives brushing past each other. But when a friend joins, twenty years of near misses
 * arrive at once and land scattered through that history, which is no way to find out what just
 * turned up. Recently found answers that instead, newest discovery first, and is the default.
 */
type Sort = 'timeline' | 'found';

function SortTabs({ value, onChange }: { value: Sort; onChange: (v: Sort) => void }) {
  const tabs: { id: Sort; label: string }[] = [
    { id: 'found', label: 'Recently found' },
    { id: 'timeline', label: 'Timeline' },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: PAD, paddingBottom: 10 }}>
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              minHeight: 38, paddingHorizontal: 16, borderRadius: radius.pill,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? colors.ink : colors.white,
              borderWidth: 1, borderColor: on ? colors.ink : colors.inputBorder,
            }}
          >
            <Body size={14} weight="semibold" color={on ? colors.white : colors.text2}>{t.label}</Body>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Today", "Yesterday", then the date. Headings for the recently found list. */
function foundLabel(iso: string) {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((today - day) / 86400000);
  if (days <= 0) return 'Found today';
  if (days === 1) return 'Found yesterday';
  if (days < 7) return `Found ${days} days ago`;
  return `Found ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}`;
}

export default function Feed() {
  const { width } = useWindowDimensions();
  const { demo, profile } = useAuth();
  const real = useNearMisses();
  useFocusEffect(useCallback(() => {
    if (demo) return;
    useNearMisses.getState().load();
    useActivity.getState().refreshUnread();
  }, [demo]));

  // The spinner belongs to the pull, not to the store.
  //
  // It used to read the store's `loading` flag, which is also set by the load that runs every
  // time this tab regains focus. Coming back from a near miss, the list would find itself
  // "refreshing" with nobody pulling it, and sit there held open until you pulled it again to
  // dismiss it. Local state, cleared when the load settles, can't do that.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    useNearMisses.getState().load({ rematch: true }).finally(() => setRefreshing(false));
  }, []);
  const met = useStore((s) => s.met);
  const unread = useStore((s) => s.unread);
  const seen = useStore((s) => s.seen);
  const comments = useStore((s) => s.comments);
  const activityRead = useStore((s) => s.activityRead);
  const cardWidth = Math.min(width, 640) - PAD * 2 - 2;
  const [sort, setSort] = useState<Sort>('found');

  // Whether there is a notifications offer left to make, decided here rather than inside the
  // card. A FlatList throws away rows that scroll off and rebuilds them, so a card that decided
  // this for itself forgot it had been answered every time it left the screen, which is what
  // made it look like the app kept asking. Checked once when the feed gains focus, and turned
  // off the moment either button is pressed.
  const [offerPush, setOfferPush] = useState(false);
  useFocusEffect(useCallback(() => {
    let live = true;
    canOfferPush().then((can) => { if (live) setOfferPush(can); }).catch(() => {});
    return () => { live = false; };
  }, []));

  // Oldest first, with a year label whenever the year changes.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let year = 0;
    if (!demo && sort === 'found') {
      // Same near misses, same rules about what belongs in the feed. Only the order changes:
      // newest discovery first, grouped by the day it turned up. Within a day, oldest night
      // first, so a friend who just joined reads as a story and the "when did you meet?" card
      // can sit where it belongs in it.
      const unknown = new Set(real.needsMetOn.map((n) => n.friend_id));
      const dayOf = (n: RealNearMiss) => (n.found_at ? foundLabel(n.found_at) : 'Found earlier');
      const newest = new Map<string, string>();
      for (const n of real.items) {
        const d = dayOf(n);
        if ((newest.get(d) ?? '') < (n.found_at ?? '')) newest.set(d, n.found_at ?? '');
      }
      const byFound = (a: RealNearMiss, b: RealNearMiss) =>
        (newest.get(dayOf(b)) ?? '').localeCompare(newest.get(dayOf(a)) ?? '')
        || a.closest_at.localeCompare(b.closest_at);
      const feed = real.items.filter((n) => n.is_before_met || unknown.has(n.other_id)).sort(byFound);
      const since = real.items.filter((n) => !n.is_before_met && !unknown.has(n.other_id)).sort(byFound);

      // Nobody to guess a date for: ask up front, same as the timeline.
      for (const friend of real.needsMetOn.filter((f) => !f.guess)) out.push({ kind: 'ask', friend });
      // Everyone else gets asked right above the first near miss from around when we think you
      // met, which is where the pattern changes and the question makes sense.
      const pending = real.needsMetOn.filter((f) => f.guess);
      const asked = new Set<string>();

      const withHeadings = (list: RealNearMiss[], ask: boolean) => {
        let heading = '';
        for (const nm of list) {
          const label = dayOf(nm);
          if (label !== heading) { heading = label; out.push({ kind: 'found', label }); }
          const f = ask && pending.find(
            (p) => !asked.has(p.friend_id) && p.friend_id === nm.other_id && p.guess != null && nm.night >= p.guess,
          );
          if (f) { asked.add(f.friend_id); out.push({ kind: 'ask', friend: f }); }
          out.push({ kind: 'real', nm });
        }
      };
      withHeadings(feed, true);
      const first = out.findIndex((r) => r.kind === 'real');
      if (offerPush && first !== -1) out.splice(first + 1, 0, { kind: 'push' });
      for (const f of pending) if (!asked.has(f.friend_id)) out.push({ kind: 'ask', friend: f });
      // Memories follow straight on, open, so the feed keeps going instead of ending at a toggle.
      if (since.length) {
        out.push({ kind: 'since', count: since.length });
        withHeadings(since, false);
      }
      return out;
    }
    if (!demo) {
      // A near miss from after you met is usually a day you already remember — the trip you
      // took together, not a time you almost crossed paths. Keep those out of the main feed.
      // Friends whose meeting date we don't know yet stay in the feed, and we ask about them.
      const unknown = new Set(real.needsMetOn.map((n) => n.friend_id));
      const before = real.items.filter((n) => n.is_before_met || unknown.has(n.other_id));
      const since = real.items.filter((n) => !n.is_before_met && !unknown.has(n.other_id));

      // Someone we can't guess a date for gets asked up front; there's nowhere better to put it.
      for (const friend of real.needsMetOn.filter((f) => !f.guess)) out.push({ kind: 'ask', friend });

      // The rest get asked at the exact point their near misses start clustering — the moment
      // the feed stops being coincidences and starts being a shared life.
      const pending = real.needsMetOn.filter((f) => f.guess);
      const asked = new Set<string>();

      const withYears = (list: RealNearMiss[]) => {
        year = 0;
        for (const nm of list) {
          const ask = pending.find(
            (f) => !asked.has(f.friend_id) && f.friend_id === nm.other_id && f.guess != null && nm.night >= f.guess,
          );
          if (ask) { asked.add(ask.friend_id); out.push({ kind: 'ask', friend: ask }); }
          const y = new Date(nm.closest_at).getFullYear();
          if (y !== year) { year = y; out.push({ kind: 'year', year }); }
          out.push({ kind: 'real', nm });
        }
      };
      withYears(before);
      // Under the first near miss, where the question answers itself.
      const first = out.findIndex((r) => r.kind === 'real');
      if (offerPush && first !== -1) out.splice(first + 1, 0, { kind: 'push' });
      // A guess later than every near miss we have: ask at the end rather than never.
      for (const f of pending) if (!asked.has(f.friend_id)) out.push({ kind: 'ask', friend: f });
      if (since.length) {
        out.push({ kind: 'since', count: since.length });
        withYears(since);
      }
      return out;
    }
    for (const nm of [...nearMisses].sort((a, b) => a.date.localeCompare(b.date))) {
      if (nm.year !== year) { year = nm.year; out.push({ kind: 'year', year }); }
      out.push({ kind: 'post', nm });
    }
    return out;
  }, [demo, real.items, real.needsMetOn, sort, offerPush]);

  const tagsFor = (nm: NearMiss) => {
    const t: { label: string; tone: ChipTone }[] = [];
    if (nm.isNew && !seen[nm.id]) t.push({ label: 'New', tone: 'violet' });
    if (nm.viaFriendId) t.push({ label: `Friend of ${people[nm.viaFriendId].name}`, tone: 'green' });
    if (isBeforeMet(met, nm)) t.push({ label: 'Before you met', tone: 'violet' });
    return t;
  };


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
        That's every near miss so far. More show up as friends join. Photos from the last two days are never matched.
      </Body>
      <Pressable onPress={() => router.navigate('/invite')} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Body size={15} weight="bold" color={colors.violet}>Invite friends</Body>
      </Pressable>
    </View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark size={28} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityButton />
          <Pressable accessibilityLabel="Your profile" onPress={() => router.navigate('/you')}>
            <PersonAvatar id="jeff" size={40} />
          </Pressable>
        </View>
      </View>

      {!demo && real.items.length > 1 ? <SortTabs value={sort} onChange={setSort} /> : null}

      <FlatList
        data={rows}
        keyExtractor={(r, i) =>
          r.kind === 'year' ? `y${r.year}`
          : r.kind === 'ask' ? `ask${r.friend.friend_id}`
          : r.kind === 'since' ? 'since'
          : r.kind === 'push' ? 'push'
          : r.kind === 'found' ? `f${r.label}${i}`
          : r.nm.id}
        initialNumToRender={4}
        windowSize={5}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        refreshControl={demo ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />}
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
          <NearMissCard nm={item.nm} width={cardWidth} myBirthday={profile?.birthday} />
        ) : item.kind === 'year' ? (
          <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink, paddingTop: 10, paddingHorizontal: 4 }}>{item.year}</Text>
        ) : item.kind === 'found' ? (
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink, paddingTop: 10, paddingHorizontal: 4 }}>{item.label}</Text>
        ) : item.kind === 'push' ? (
          <PushOffer onAnswered={() => setOfferPush(false)} />
        ) : item.kind === 'ask' ? (
          <AskWhenMet friend={item.friend} />
        ) : item.kind === 'since' ? (
          // A divider, not a toggle: the memories are right underneath it.
          <View style={{ gap: 2, marginTop: 14, paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.cardLg, backgroundColor: colors.sand }}>
            <Body size={15} weight="bold">Since you met</Body>
            <Body size={13} color={colors.muted}>
              {item.count} {item.count === 1 ? 'memory' : 'memories'}, days you were both there and probably remember
            </Body>
          </View>
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
