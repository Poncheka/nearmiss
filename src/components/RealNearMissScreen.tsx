import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUp, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react-native';
import { Avatar, PersonAvatar } from '@/components/avatar';
import { NearMissGallery } from '@/components/NearMissGallery';
import { ReactionBar } from '@/components/ReactionBar';
import { SharedVideo } from '@/components/SharedVideo';
import { ShareFromThatNight } from '@/components/ShareFromThatNight';
import { Body, Card, Chip, Display, IconButton, Pill, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addComment, barelyMissedLine, formatWhen, giveFeedback, isBarelyMissed, kindLabel, loadComments, nearLabel, NearMissComment, otherName, placeLabel, useNearMisses } from '@/lib/nearMisses';
import { occasionFor } from '@/lib/occasions';
import { useReactions } from '@/lib/reactions';
import { SharedPhoto, useSharedPhotos } from '@/lib/sharedPhotos';
import { colors, fonts, pastel, radius } from '@/theme';

/** Big enough to recognise the moment, small enough to still read as a message. */
const THUMB = 200;

/** One thing that happened, said or shared, so the thread can show them in order. */
type Entry =
  | { kind: 'text'; id: string; at: string; mine: boolean; body: string }
  | { kind: 'photo'; id: string; at: string; mine: boolean; photo: SharedPhoto };

const FEEDBACK: { kind: 'together' | 'not_interesting'; label: string }[] = [
  { kind: 'together', label: 'We were together' },
  { kind: 'not_interesting', label: 'Not interesting' },
];

export function RealNearMissScreen({ id }: { id: string }) {
  const { session, profile } = useAuth();
  const { width } = useWindowDimensions();
  const nm = useNearMisses((s) => s.items.find((x) => x.id === id));
  const loaded = useNearMisses((s) => s.loaded);
  const [comments, setComments] = useState<NearMissComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loaded) useNearMisses.getState().load();
  }, [loaded]);
  const photos = useSharedPhotos((s) => (nm ? s.byNearMiss[nm.id] : undefined));
  const sharing = useSharedPhotos((s) => (nm ? !!s.busy[nm.id] : false));
  const reactions = useReactions((s) => (nm ? s.byNearMiss[nm.id] : undefined));

  useEffect(() => {
    if (!nm) return;
    useNearMisses.getState().markRead(nm.id);
    loadComments(nm.id).then(setComments).catch(() => setComments([]));
    useSharedPhotos.getState().load(nm.id);
    useReactions.getState().load(nm.id);
  }, [nm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Said and shared, in the order it happened. Jeff's case: a message at 11:59 and a photo at
  // 12:10 read backwards when the photos were pulled out into their own section.
  const me0 = session?.user.id;
  const timeline = useMemo<Entry[]>(() => {
    const said: Entry[] = (comments ?? []).map((c) => ({
      kind: 'text', id: c.id, at: c.created_at, mine: c.author_id === me0, body: c.body,
    }));
    const shown: Entry[] = (photos ?? []).map((p) => ({
      kind: 'photo', id: p.id, at: p.created_at, mine: p.mine, photo: p,
    }));
    return [...said, ...shown].sort((a, b) => a.at.localeCompare(b.at));
  }, [comments, photos, me0]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!nm) {
    return (
      <Screen>
        <View style={{ padding: 20, gap: 16 }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          {loaded ? <Body size={16} color={colors.muted}>This near miss isn't available anymore.</Body> : <ActivityIndicator color={colors.violet} />}
        </View>
      </Screen>
    );
  }

  const name = otherName(nm);
  const when = formatWhen(nm.closest_at);
  const barely = isBarelyMissed(nm);
  const occasion = occasionFor(nm.closest_at, {
    mine: profile?.birthday,
    theirs: nm.other_birthday,
    theirName: nm.other_name,
  });
  const me = session?.user.id;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const c = await addComment(nm.id, text);
      setComments((cs) => [...(cs ?? []), c]);
      setDraft('');
    } catch (e) {
      Alert.alert("Couldn't send", e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  // That day's photos, never the whole library. Also why there is no second permission prompt:
  // this reads the access granted at sign-up rather than opening the system picker.
  const sharePhoto = () => {
    if (!nm) return;
    router.push({ pathname: '/that-day/[id]', params: { id: nm.id } });
  };

  const unshare = (photo: SharedPhoto) => Alert.alert('Remove this?', `${name} won't be able to see it any more.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove', style: 'destructive', onPress: async () => {
        if (!nm) return;
        try { await useSharedPhotos.getState().remove(nm.id, photo); }
        catch (e) { Alert.alert("Couldn't remove it", e instanceof Error ? e.message : String(e)); }
      },
    },
  ]);

  const feedback = (kind: 'together' | 'not_interesting', label: string) => Alert.alert(label, 'This near miss will be hidden from your feed.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Hide it', onPress: async () => {
        try {
          await giveFeedback(nm.id, kind);
          useNearMisses.setState((s) => ({ items: s.items.filter((x) => x.id !== nm.id) }));
          back();
        } catch (e) { Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e)); }
      },
    },
  ]);

  const openProfile = () => router.push({ pathname: '/friend/[id]', params: { id: nm.other_id } });

  const openPhoto = (photo: SharedPhoto) => {
    const at = (photos ?? []).findIndex((p) => p.id === photo.id);
    router.push({ pathname: '/photo/[id]', params: { id: nm.id, index: String(Math.max(at, 0)) } });
  };

  const otherAvatar = (size: number) => nm.other_avatar_url
    ? <Image source={{ uri: nm.other_avatar_url }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.white }} />
    : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={pastel.peach} size={size} ring />;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <Body size={16} weight="bold">Near miss</Body>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}>
            {/* The two faces and the title are one target, because "who is this person" is the
                question you have while looking at them, not one you go to a menu for. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${name}'s profile`}
              onPress={openProfile}
              style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <View style={{ width: 64 + 40, height: 64 }}>
                <View style={{ position: 'absolute', left: 0 }}><PersonAvatar id="jeff" size={64} ring /></View>
                <View style={{ position: 'absolute', left: 40 }}>{otherAvatar(64)}</View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Display size={36}>You + {name}</Display>
                <ChevronRight size={22} color={colors.faint} strokeWidth={2.5} style={{ marginTop: 4 }} />
              </View>
            </Pressable>
            <Body size={17} color={colors.text2}>{placeLabel(nm)}</Body>
            <Body size={17} color={colors.text2}>{when.date} · {when.time}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
              <Chip label={kindLabel(nm)} tone={nm.kind === 'crossed' ? 'violet' : 'outline'} />
              <Chip label={nearLabel(nm)} tone={barely ? 'coral' : 'outline'} />
              {occasion ? <Chip label={occasion.label} tone={occasion.loud ? 'green' : 'outline'} /> : null}
              {nm.via_name ? <Chip label={`Friend of ${nm.via_name.split(' ')[0]}`} tone="green" /> : null}
              {nm.is_before_met ? <Chip label="Before you met" tone="coral" /> : null}
            </View>

            {/* The closest calls get said out loud. Everything else stays in the chips. */}
            {barely ? (
              <Body size={19} weight="bold" style={{ paddingTop: 2 }}>
                {barelyMissedLine(nm, name)}
              </Body>
            ) : nm.kind === 'same_place' ? (
              <Body size={15} color={colors.muted}>
                You didn't overlap. You were both around {placeLabel(nm).split(',')[0]} that night, {nm.distance_m}m apart at the closest.
              </Body>
            ) : null}
          </View>

          {/* Map first, then whatever has been shared from that day. */}
          <NearMissGallery
            nm={nm}
            width={width - 42}
            photos={photos ?? []}
            name={name}
            onUnshare={unshare}
          />

          {/* The photos live in the gallery above, where they are the first thing you see, and
              they appear here too, in the order everything actually happened. A photo sent
              between two messages is part of the conversation, and pulling it out left replies
              answering nothing. */}
          <View style={{ gap: 10 }}>
            <Body size={17} weight="bold" style={{ paddingHorizontal: 4 }}>
              {timeline.length ? 'That day' : `Ask ${name} about that day`}
            </Body>
            {comments === null ? <ActivityIndicator color={colors.violet} /> : timeline.map((entry) => {
              const stamp = new Date(entry.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
              const mine = entry.mine;
              return (
                <View key={`${entry.kind}-${entry.id}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && (
                    <Pressable accessibilityLabel={`Open ${name}'s profile`} onPress={openProfile}>
                      {otherAvatar(32)}
                    </Pressable>
                  )}
                  <View style={{ maxWidth: '78%', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    {entry.kind === 'text' ? (
                      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: mine ? colors.violet : colors.white, borderWidth: mine ? 0 : 1, borderColor: colors.cardBorder }}>
                        <Body size={15} color={mine ? colors.white : colors.ink}>{entry.body}</Body>
                        <Body size={11} color={mine ? 'rgba(255,255,255,0.7)' : colors.faint}>{stamp}</Body>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityLabel={`Open ${entry.photo.isVideo ? 'video' : 'photo'} full screen`}
                        onPress={() => openPhoto(entry.photo)}
                        style={{ width: THUMB, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.sand }}
                      >
                        {!entry.photo.url ? (
                          <View style={{ width: THUMB, height: THUMB, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.violet} />
                          </View>
                        ) : entry.photo.isVideo ? (
                          // A video needs the player to show a frame. Image can't decode an mp4,
                          // so pointing one at the clip gave a blank box with a play badge on it.
                          <SharedVideo uri={entry.photo.url} width={THUMB} height={THUMB} />
                        ) : (
                          <Image source={{ uri: entry.photo.url }} style={{ width: THUMB, height: THUMB }} resizeMode="cover" />
                        )}
                      </Pressable>
                    )}
                    {nm ? (
                      <ReactionBar
                        nearMissId={nm.id}
                        target={entry.kind === 'text' ? 'comment' : 'photo'}
                        targetId={entry.id}
                        all={reactions}
                        align={mine ? 'right' : 'left'}
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Front and centre, with that night's photos already loaded. */}
          <ShareFromThatNight nm={nm} name={name} theyShared={(photos ?? []).some((p) => !p.mine)} />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
            {FEEDBACK.map((f) => <Pill key={f.kind} label={f.label} variant="white" height={36} textSize={14} onPress={() => feedback(f.kind, f.label)} />)}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.inputBorder, backgroundColor: colors.white }}>
          <Pressable
            accessibilityLabel="Share a photo from that day"
            onPress={sharePhoto}
            disabled={sharing}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            {sharing ? <ActivityIndicator color={colors.violet} /> : <ImagePlus size={20} color={colors.ink} strokeWidth={2} />}
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={`Say something to ${name}`}
            placeholderTextColor={colors.faint}
            multiline
            maxLength={2000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}
          />
          <Pressable accessibilityLabel="Send" onPress={send} disabled={!draft.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: draft.trim() ? colors.violet : colors.toggleOff, alignItems: 'center', justifyContent: 'center' }}>
            {sending ? <ActivityIndicator color={colors.white} /> : <ArrowUp size={20} color={colors.white} strokeWidth={2.4} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
