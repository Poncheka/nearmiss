import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Body, Card, Chip, ChipTone, Display, IconButton, Pill, Screen, SectionLabel, UnreadDot } from '@/components/ui';
import { AvatarPair, PersonAvatar } from '@/components/avatar';
import { PhotoArt } from '@/components/art';
import { activity, lockedMisses, nearMisses, NearMiss, people, theirPhotoColors } from '@/data/mock';
import { isBeforeMet, useStore } from '@/state/store';
import { colors, fonts, radius } from '@/theme';

type Tab = 'all' | 'before' | 'locked';

const openNearMiss = (id: string) => router.push({ pathname: '/near-miss/[id]', params: { id } });

function NearMissCard({ nm, unread, tag }: { nm: NearMiss; unread: number; tag?: { label: string; tone: ChipTone } }) {
  const friend = people[nm.friendId];
  return (
    <Pressable onPress={() => openNearMiss(nm.id)}>
      <Card style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <AvatarPair otherId={nm.friendId} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <Body size={16} weight="bold">You + {friend.name}</Body>
              {unread > 0 && <UnreadDot label={`${unread} new`} />}
            </View>
            <Body size={13} color={colors.muted}>{nm.dateShort}</Body>
          </View>
          <Body size={15} color={colors.text2}>{nm.placeFull}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
            <Chip label={`${nm.distance}m apart`} />
            {tag && <Chip label={tag.label} tone={tag.tone} />}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function Feed() {
  const [tab, setTab] = useState<Tab>('all');
  const met = useStore((s) => s.met);
  const unread = useStore((s) => s.unread);
  const seen = useStore((s) => s.seen);
  const shared = useStore((s) => s.shared);
  const theyShared = useStore((s) => s.theyShared);
  const activityRead = useStore((s) => s.activityRead);

  const tagFor = (nm: NearMiss): { label: string; tone: ChipTone } | undefined => {
    if (nm.isNew && !seen[nm.id]) return { label: 'New', tone: 'violet' };
    if (nm.viaFriendId) return { label: `Friend of ${people[nm.viaFriendId].name}`, tone: 'green' };
    if (isBeforeMet(met, nm)) return { label: 'Before you met', tone: 'coral' };
    return undefined;
  };

  const lists = useMemo(() => {
    const before = nearMisses.filter((n) => isBeforeMet(met, n)).sort((a, b) => a.year - b.year);
    // Newest first, but anything unseen or with unread activity floats to the top.
    const score = (n: NearMiss) => (unread[n.id] ? 2 : 0) + (n.isNew && !seen[n.id] ? 1 : 0);
    const all = [...nearMisses].sort((a, b) => score(b) - score(a) || b.year - a.year);
    return { before, all };
  }, [met, unread, seen]);

  // "Needs you": a friend shared a photo and you haven't shared back.
  const needsYou = nearMisses.filter((n) => theyShared[n.id] && !shared[n.id]);
  const unreadActivity = activityRead ? 0 : activity.filter((a) => a.fresh).length;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: lists.all.length },
    { id: 'before', label: 'Before you met', count: lists.before.length },
    { id: 'locked', label: 'Locked', count: lockedMisses.length },
  ];
  const footnotes: Record<Tab, string> = {
    all: 'From your photos, one per night. Photos from the last 30 days are never matched.',
    before: 'Before the first time we saw you two together.',
    locked: 'These unlock when the other person joins.',
  };
  const rows = tab === 'locked' ? [] : lists[tab];

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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 14 }}>
        <Pressable onPress={() => router.push('/reveal')} style={{ padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.violet, gap: 12 }}>
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

        {needsYou.length > 0 && (
          <View style={{ gap: 8 }}>
            <SectionLabel style={{ paddingTop: 2, paddingBottom: 0 }}>Needs you</SectionLabel>
            {needsYou.slice(0, 3).map((nm) => (
              <Pressable key={nm.id} onPress={() => openNearMiss(nm.id)}>
                <Card style={{ padding: 10, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#D9D0F7' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden' }}>
                    <PhotoArt color={theirPhotoColors[0]} size={48} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body size={15} weight="bold">{people[nm.friendId].name} shared a photo</Body>
                    <Body size={13} color={colors.muted} numberOfLines={1}>
                      {nm.place}{unread[nm.id] ? ` · ${unread[nm.id]} new replies` : ''}
                    </Body>
                  </View>
                  <Pill label="Share back" onPress={() => openNearMiss(nm.id)} textSize={14} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityState={{ selected: on }}
                style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: on ? colors.ink : colors.white, borderWidth: 1, borderColor: on ? colors.ink : colors.inputBorder }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.white : colors.ink }}>{t.label}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? 'rgba(255,255,255,0.6)' : colors.faint }}>{t.count}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {rows.map((nm) => <NearMissCard key={nm.id} nm={nm} unread={unread[nm.id] ?? 0} tag={tagFor(nm)} />)}

        {tab === 'locked' && lockedMisses.map((l) => (
          <Pressable key={l.id} onPress={() => router.navigate('/friends')}>
            <Card style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <AvatarPair unknown />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body size={16} weight="bold">Someone in your contacts</Body>
                  <Body size={13} color={colors.muted}>{l.when}</Body>
                </View>
                <Body size={15} color={colors.text2}>{l.place}</Body>
                <View style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>
                  <Chip label={`${l.distance}m apart`} />
                  <Chip label="Invite to unlock" tone="solidViolet" onPress={() => router.navigate('/friends')} />
                </View>
              </View>
            </Card>
          </Pressable>
        ))}

        <Body size={13} color={colors.muted} style={{ textAlign: 'center', paddingHorizontal: 12 }}>{footnotes[tab]}</Body>
      </ScrollView>
    </Screen>
  );
}
