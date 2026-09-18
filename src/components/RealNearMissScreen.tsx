import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUp, ChevronLeft } from 'lucide-react-native';
import { Avatar, PersonAvatar } from '@/components/avatar';
import { PairMap } from '@/components/map/PairMap';
import { Body, Card, Chip, Display, IconButton, Pill, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addComment, formatWhen, giveFeedback, kindLabel, loadComments, nearLabel, NearMissComment, otherName, placeLabel, useNearMisses } from '@/lib/nearMisses';
import { colors, fonts, pastel, radius } from '@/theme';

const FEEDBACK: { kind: 'together' | 'not_interesting'; label: string }[] = [
  { kind: 'together', label: 'We were together' },
  { kind: 'not_interesting', label: 'Not interesting' },
];

export function RealNearMissScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const nm = useNearMisses((s) => s.items.find((x) => x.id === id));
  const loaded = useNearMisses((s) => s.loaded);
  const [comments, setComments] = useState<NearMissComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loaded) useNearMisses.getState().load();
  }, [loaded]);
  useEffect(() => {
    if (!nm) return;
    useNearMisses.getState().markRead(nm.id);
    loadComments(nm.id).then(setComments).catch(() => setComments([]));
  }, [nm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <View style={{ width: 64 + 40, height: 64 }}>
              <View style={{ position: 'absolute', left: 0 }}><PersonAvatar id="jeff" size={64} ring /></View>
              <View style={{ position: 'absolute', left: 40 }}>{otherAvatar(64)}</View>
            </View>
            <Display size={36}>You + {name}</Display>
            <Body size={17} color={colors.text2}>{placeLabel(nm)}</Body>
            <Body size={17} color={colors.text2}>{when.date} · {when.time}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
              <Chip label={kindLabel(nm)} tone={nm.kind === 'crossed' ? 'violet' : 'outline'} />
              <Chip label={nm.kind === 'crossed' ? `${nm.distance_m}m apart` : nearLabel(nm)} tone="outline" />
              {nm.via_name ? <Chip label={`Friend of ${nm.via_name.split(' ')[0]}`} tone="green" /> : null}
              {nm.is_before_met ? <Chip label="Before you met" tone="coral" /> : null}
            </View>
            {nm.kind === 'same_place' ? (
              <Body size={15} color={colors.muted}>
                You didn't overlap — you were both around {placeLabel(nm).split(',')[0]} that night, {nm.distance_m}m apart at the closest.
              </Body>
            ) : null}
          </View>

          <Card style={{ overflow: 'hidden' }}>
            <PairMap
              me={{ latitude: nm.my_lat, longitude: nm.my_lng }}
              them={{ latitude: nm.their_lat, longitude: nm.their_lng }}
              height={240}
              width={width - 42}
              interactive
            />
            <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.violet }} />
                <Body size={13} color={colors.text2}>You</Body>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }} />
                <Body size={13} color={colors.text2}>{name}</Body>
              </View>
            </View>
          </Card>

          <View style={{ gap: 10 }}>
            <Body size={17} weight="bold" style={{ paddingHorizontal: 4 }}>
              {comments && comments.length ? 'Comments' : `Ask ${name} about that day`}
            </Body>
            {comments === null ? <ActivityIndicator color={colors.violet} /> : comments.map((c) => {
              const mine = c.author_id === me;
              return (
                <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  {!mine && otherAvatar(32)}
                  <View style={{ maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: mine ? colors.violet : colors.white, borderWidth: mine ? 0 : 1, borderColor: colors.cardBorder }}>
                    <Body size={15} color={mine ? colors.white : colors.ink}>{c.body}</Body>
                    <Body size={11} color={mine ? 'rgba(255,255,255,0.7)' : colors.faint}>
                      {new Date(c.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Body>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
            {FEEDBACK.map((f) => <Pill key={f.kind} label={f.label} variant="white" height={36} textSize={14} onPress={() => feedback(f.kind, f.label)} />)}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.inputBorder, backgroundColor: colors.white }}>
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
