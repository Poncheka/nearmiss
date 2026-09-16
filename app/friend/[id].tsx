import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronLeft, Ellipsis } from 'lucide-react-native';
import { Body, Card, Chip, Display, IconButton, IconTile, Pill, Screen, Segmented, TextLink, UnreadDot } from '@/components/ui';
import { PersonAvatar } from '@/components/avatar';
import { PhotoArt } from '@/components/art';
import { myPhotoColors, nearMisses, people, theirPhotoColors } from '@/data/mock';
import { isBeforeMet, metYear, useStore } from '@/state/store';
import { colors, fonts } from '@/theme';

type View_ = 'misses' | 'photos';

export default function FriendPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const friend = people[id] ?? people.maya;
  const [view, setView] = useState<View_>('misses');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const met = useStore((s) => s.met);
  const unread = useStore((s) => s.unread);
  const shared = useStore((s) => s.shared);
  const theyShared = useStore((s) => s.theyShared);
  const setMet = useStore((s) => s.setMet);

  const metInfo = met[friend.id];
  const year = metYear(met, friend.id);
  const misses = nearMisses.filter((n) => n.friendId === friend.id).sort((a, b) => a.year - b.year);
  const beforeCount = misses.filter((n) => isBeforeMet(met, n)).length;

  // Timeline rows with a "You met" marker placed by year.
  type Row = { kind: 'marker' } | { kind: 'miss'; nm: (typeof misses)[number] };
  const rows: Row[] = [];
  let placed = year === null;
  for (const nm of misses) {
    if (!placed && year !== null && nm.year >= year) { rows.push({ kind: 'marker' }); placed = true; }
    rows.push({ kind: 'miss', nm });
  }
  if (!placed) rows.push({ kind: 'marker' });

  const photos = misses.flatMap((nm) => [
    ...(shared[nm.id] ? [{ key: `${nm.id}-me`, who: 'You', color: myPhotoColors[0], nmId: nm.id }] : []),
    ...(theyShared[nm.id] ? theirPhotoColors.map((c, i) => ({ key: `${nm.id}-them-${i}`, who: friend.name, color: c, nmId: nm.id })) : []),
  ]);

  const source = metInfo?.by === 'me' ? `Set by you. ${friend.name} can see this.`
    : metInfo?.by === 'them' ? `${friend.name} set this on Monday. Our first guess was the same.`
    : 'Our guess: the first time you two spent 30+ minutes together.';

  const save = () => {
    const v = draft.trim();
    if (v) setMet(friend.id, v);
    setEditing(false);
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', justifyContent: 'space-between' }}>
          <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <IconButton label="More"><Ellipsis size={20} color={colors.ink} /></IconButton>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 6 }}>
            <PersonAvatar id={friend.id} size={88} />
            <Display size={30} style={{ paddingTop: 6 }}>{friend.fullName}</Display>
            <Body size={15} color={colors.muted}>{friend.handle}{friend.friendsSince ? ` · Friends since ${friend.friendsSince}` : ''}</Body>
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 6 }}>
              <Chip label={`${misses.length} near miss${misses.length === 1 ? '' : 'es'}`} tone="outline" />
              {beforeCount > 0 && <Chip label={`${beforeCount} before you met`} tone="coral" />}
            </View>
          </View>

          <Card style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <IconTile bg={colors.coralTint}><CalendarDays size={18} color={colors.coralText} strokeWidth={2} /></IconTile>
              <View style={{ flex: 1 }}>
                <Body size={15} weight="bold">{year !== null ? `You met in ${metInfo.label}` : "You haven't met yet"}</Body>
                <Body size={13} color={colors.muted}>{year !== null ? source : 'Set it if you have.'}</Body>
              </View>
              {!editing && <TextLink label="Edit" size={15} onPress={() => { setDraft(year !== null ? metInfo.label : ''); setEditing(true); }} />}
            </View>
            {editing && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={save}
                    autoFocus
                    placeholder="Month and year, e.g. Jun 2019"
                    placeholderTextColor={colors.faint}
                    style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 12, fontSize: 16, fontFamily: fonts.regular, backgroundColor: colors.inputBg, color: colors.ink }}
                  />
                  <Pill label="Save" height={44} onPress={save} />
                </View>
                <Body size={13} color={colors.muted}>{friend.name} gets a heads-up and can change it too. It updates which near misses count as "before you met".</Body>
              </View>
            )}
          </Card>

          <Segmented<View_> options={[{ id: 'misses', label: 'Near misses' }, { id: 'photos', label: 'Shared photos' }]} value={view} onChange={setView} />

          {view === 'misses' && (
            <View>
              {rows.map((r, i) => {
                const first = i === 0;
                const last = i === rows.length - 1;
                const isMarker = r.kind === 'marker';
                return (
                  <View key={isMarker ? 'marker' : r.nm.id} style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ width: 14, alignItems: 'center' }}>
                      <View style={{ width: 2, height: 18, backgroundColor: first ? 'transparent' : colors.handle }} />
                      <View style={{ width: isMarker ? 14 : 10, height: isMarker ? 14 : 10, borderRadius: 7, backgroundColor: isMarker ? colors.coral : colors.violet }} />
                      <View style={{ width: 2, flex: 1, backgroundColor: last ? 'transparent' : colors.handle }} />
                    </View>
                    {isMarker ? (
                      <View style={{ paddingTop: 10, paddingBottom: 14 }}>
                        <Body size={15} weight="bold" color={colors.coralText}>You met</Body>
                        <Body size={13} color={colors.muted}>{metInfo.label}</Body>
                      </View>
                    ) : (
                      <Pressable style={{ flex: 1, marginVertical: 6 }} onPress={() => router.push({ pathname: '/near-miss/[id]', params: { id: r.nm.id } })}>
                        <Card style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                            <Body size={16} weight="bold" style={{ flexShrink: 1 }}>{r.nm.place}</Body>
                            <Body size={13} color={colors.muted}>{r.nm.dateShort}</Body>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip label={`${r.nm.distance}m apart`} />
                            {isBeforeMet(met, r.nm) && <Chip label="Before you met" tone="coral" />}
                            {unread[r.nm.id] ? <UnreadDot label={`${unread[r.nm.id]} new`} /> : null}
                          </View>
                        </Card>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {view === 'photos' && (
            <View style={{ gap: 10 }}>
              {photos.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {photos.map((p) => (
                    <Pressable key={p.key} onPress={() => router.push({ pathname: '/near-miss/[id]', params: { id: p.nmId } })}
                      style={{ width: '32%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' }}>
                      <PhotoArt color={p.color} size={200} />
                      <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                        <Body size={11} weight="bold">{p.who}</Body>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Body size={15} color={colors.muted} style={{ textAlign: 'center', paddingVertical: 24 }}>No shared photos yet.</Body>
              )}
              <Body size={13} color={colors.muted} style={{ textAlign: 'center' }}>Only photos you two chose to share with each other.</Body>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
