import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, CalendarDays, Check, ChevronLeft, ChevronRight, ImageIcon, Share } from 'lucide-react-native';
import { Body, Button, Card, Chip, Display, IconButton, IconTile, Pill, Screen } from '@/components/ui';
import { AvatarPair, PersonAvatar } from '@/components/avatar';
import { MiniMap, PhotoArt } from '@/components/art';
import { me, myPhotoColors, nearMisses, people, theirPhotoColors } from '@/data/mock';
import { getNearMiss, isBeforeMet, useStore, yearsBeforeMet } from '@/state/store';
import { colors, fonts, radius } from '@/theme';

const FEEDBACK = ['We were together', 'Not interesting', 'Hide this place'];

export default function NearMissScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nm = getNearMiss(id) ?? nearMisses[0];
  const friend = people[nm.friendId];
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState('');

  const s = useStore();
  const picked = s.picked[nm.id] ?? [0];
  const shared = !!s.shared[nm.id];
  const theyShared = !!s.theyShared[nm.id];
  const comments = s.comments[nm.id] ?? [];
  const feedback = s.feedback[nm.id];
  const met = s.met[nm.friendId];
  const before = isBeforeMet(s.met, nm);
  const gap = yearsBeforeMet(s.met, nm);
  const friendMisses = nearMisses.filter((n) => n.friendId === nm.friendId).length;

  useEffect(() => { s.openNearMiss(nm.id); }, [nm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = () => {
    const t = draft.trim();
    if (!t) return;
    s.addComment(nm.id, t);
    setDraft('');
  };

  const shareLabel = shared
    ? `Shared ${picked.length} with ${friend.name}`
    : picked.length
      ? `${theyShared ? 'Share back' : 'Share'} ${picked.length} photo${picked.length > 1 ? 's' : ''} with ${friend.name}`
      : 'Pick a photo to share';

  let theirTitle = `${friend.name}'s side of the night`;
  let theirSub = `Share yours first. If ${friend.name} shares one back, it shows up here.`;
  if (shared && !theyShared) theirSub = `Waiting on ${friend.name}. If they share a photo, it shows up here.`;
  if (theyShared) theirTitle = `${friend.name} shared ${theirPhotoColors.length === 1 ? 'a photo' : 'photos'}`;

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <Body size={16} weight="bold">Near miss</Body>
          <IconButton label="Share"><Share size={19} color={colors.ink} strokeWidth={1.8} /></IconButton>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 10 }}>
            <Pressable onPress={() => router.push({ pathname: '/friend/[id]', params: { id: friend.id } })} style={{ alignSelf: 'flex-start' }}>
              <AvatarPair otherId={friend.id} size={52} />
            </Pressable>
            <Display size={32}>You + {friend.name}</Display>
            <Body size={16} color={colors.text2}>{nm.placeFull}{'\n'}{nm.dateLong} · {nm.time}</Body>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Chip label={`${nm.distance}m apart`} tone="outline" />
              {before && <Chip label={gap > 0 ? `${gap} year${gap > 1 ? 's' : ''} before you met` : 'Before you met'} tone="coral" />}
              {nm.viaFriendId && <Chip label={`Friend of ${people[nm.viaFriendId].name}`} tone="green" />}
            </View>
          </View>

          <Pressable onPress={() => router.push({ pathname: '/friend/[id]', params: { id: friend.id } })}>
            <Card style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <IconTile bg={colors.coralTint}><CalendarDays size={18} color={colors.coralText} strokeWidth={2} /></IconTile>
              <View style={{ flex: 1 }}>
                <Body size={15} weight="bold">{met && /\d/.test(met.label) ? `You met in ${met.label}` : `You haven't met yet`}</Body>
                <Body size={13} color={colors.muted}>See all {friendMisses} near miss{friendMisses > 1 ? 'es' : ''} with {friend.name}</Body>
              </View>
              <ChevronRight size={16} color={colors.faint} />
            </Card>
          </Pressable>

          <Card style={{ overflow: 'hidden' }}>
            <MiniMap width={width - 42} height={190} distance={nm.distance} spread={Math.min(0.5, nm.distance / 180)} detail label={nm.place.split(',')[0]} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.violet }} />
                  <Body size={13} color={colors.text2}>You</Body>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }} />
                  <Body size={13} color={colors.text2}>{friend.name}</Body>
                </View>
              </View>
              <Body size={13} color={colors.text2}>{nm.timeRange}</Body>
            </View>
          </Card>

          <View style={{ gap: 10 }}>
            <Body size={17} weight="bold" style={{ paddingHorizontal: 4, paddingTop: 6 }}>Share a photo from that night</Body>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {myPhotoColors.map((c, i) => {
                const on = picked.includes(i);
                return (
                  <Pressable key={c} onPress={() => s.togglePick(nm.id, i)} accessibilityState={{ selected: on }}
                    style={{ width: 84, height: 84, borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: on ? colors.violet : 'transparent' }}>
                    <PhotoArt color={c} size={78} />
                    <View style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.white, backgroundColor: on ? colors.violet : 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <Check size={12} color={colors.white} strokeWidth={3.2} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button label={shareLabel} variant={shared ? 'sand' : picked.length ? 'violet' : 'sand'} onPress={() => s.sharePicked(nm.id)} style={{ minHeight: 52 }} />
            <Body size={13} color={colors.muted} style={{ textAlign: 'center' }}>
              {shared ? `Sent. ${theyShared ? `${friend.name} can see it now.` : `We asked ${friend.name} to share one back.`}` : `${friend.name} only sees the ones you pick.`}
            </Body>
          </View>

          <Card style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
            {theyShared ? (
              <>
                <Body size={15} weight="bold">{theirTitle}</Body>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {theirPhotoColors.map((c) => (
                    <View key={c} style={{ width: 84, height: 84, borderRadius: 16, overflow: 'hidden' }}><PhotoArt color={c} size={84} /></View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <IconTile bg={colors.sand} size={56} radiusSize={16}><ImageIcon size={24} color={colors.muted} strokeWidth={1.8} /></IconTile>
                  <View style={{ flex: 1 }}>
                    <Body size={15} weight="bold">{theirTitle}</Body>
                    <Body size={13} color={colors.muted}>{theirSub}</Body>
                  </View>
                </View>
                {shared && <Pill label={`Demo: simulate ${friend.name} sharing back`} variant="sand" textSize={13} height={40} onPress={() => s.simulateTheyShare(nm.id)} />}
              </>
            )}
          </Card>

          <View style={{ gap: 8, paddingHorizontal: 4 }}>
            <Body size={13} color={colors.muted}>{feedback ? 'Thanks. That helps us tune your matches.' : 'Not a real near miss?'}</Body>
            {!feedback && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {FEEDBACK.map((f) => <Pill key={f} label={f} variant="white" textSize={13} onPress={() => s.giveFeedback(nm.id, f)} style={{ paddingHorizontal: 12 }} />)}
              </View>
            )}
          </View>

          <View style={{ gap: 12, paddingTop: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 }}>
              <Body size={17} weight="bold">Just you two</Body>
              <Body size={13} color={colors.muted}>Private</Body>
            </View>
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.violetTint }}>
              <Body size={15} color={colors.violetInk}><Body size={15} weight="bold" color={colors.violetInk}>Near Miss asks:</Body> {nm.prompt}</Body>
            </View>
            {comments.map((c) => {
              const author = c.authorId === 'jeff' ? me : people[c.authorId];
              return (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <PersonAvatar id={c.authorId} size={34} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Body size={13} color={colors.muted}><Body size={13} weight="bold">{c.authorId === 'jeff' ? 'You' : author.name}</Body> · {c.when}</Body>
                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderTopLeftRadius: 4, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.cardBorder }}>
                      <Body size={15}>{c.text}</Body>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.inputBorder }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={post}
            placeholder={`Say something to ${friend.name}`}
            placeholderTextColor={colors.faint}
            style={{ flex: 1, height: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 18, fontSize: 16, fontFamily: fonts.regular, backgroundColor: colors.inputBg, color: colors.ink }}
          />
          <Pressable accessibilityLabel="Send" onPress={post} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUp size={20} color={colors.white} strokeWidth={2.2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
