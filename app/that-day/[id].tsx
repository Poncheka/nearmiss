// Pick from the photos you took at the near miss.
//
// Only those. The near miss already says when and where, so a photo from some other week is not
// a reply to it, and there is deliberately no way to reach the rest of the camera roll from
// here. That also keeps the second permission prompt away: reading the library we were already
// given needs nothing new, while the system picker carries its own.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, Expand, Images, Play } from 'lucide-react-native';
import { Body, Button, Display, IconButton, Screen } from '@/components/ui';
import { ShotPreview } from '@/components/ShotPreview';
import { formatWhen, placeLabel, useNearMisses } from '@/lib/nearMisses';
import { LocalShot, shotsFromThatDay } from '@/lib/thatDay';
import { useSharedPhotos } from '@/lib/sharedPhotos';
import { colors, radius } from '@/theme';

const GAP = 6;
const COLUMNS = 3;

export default function ThatDayPicker() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const nm = useNearMisses((s) => s.items.find((x) => x.id === id));
  const sharing = useSharedPhotos((s) => (id ? !!s.busy[id] : false));

  const [shots, setShots] = useState<LocalShot[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // Which photo is open full size, by position. Null means the grid.
  const [peek, setPeek] = useState<number | null>(null);

  const tile = Math.floor((width - 40 - GAP * (COLUMNS - 1)) / COLUMNS);

  useEffect(() => {
    if (!nm) return;
    let live = true;
    shotsFromThatDay(nm)
      .then((found) => { if (live) setShots(found); })
      .catch(() => { if (live) setShots([]); });
    return () => { live = false; };
  }, [nm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), []);

  const toggle = (shotId: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(shotId)) next.delete(shotId); else next.add(shotId);
    return next;
  });

  const picked = useMemo(() => (shots ?? []).filter((s) => chosen.has(s.id)), [shots, chosen]);

  const send = async () => {
    if (!id || !picked.length) return;
    try {
      await useSharedPhotos.getState().share(id, picked.map((s) => ({
        uri: s.uri,
        isVideo: s.isVideo,
        filename: s.filename,
        assetId: s.id,
      })));
      back();
    } catch (e) {
      Alert.alert("Couldn't share that", e instanceof Error ? e.message : String(e));
    }
  };

  if (!nm) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ padding: 20, gap: 16 }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <Body size={16} color={colors.muted}>This near miss isn't available anymore.</Body>
        </View>
      </Screen>
    );
  }

  const when = formatWhen(nm.closest_at);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        <Body size={16} weight="bold">Your photos</Body>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Display size={30}>That day</Display>
          <Body size={16} color={colors.text2}>
            {placeLabel(nm)} · {when.short}
          </Body>
        </View>

        {shots === null ? (
          <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={colors.violet} />
            <Body size={14} color={colors.muted}>Looking through that afternoon…</Body>
          </View>
        ) : shots.length === 0 ? (
          <View style={{ paddingVertical: 32, gap: 14, alignItems: 'center' }}>
            <Images size={28} color={colors.faint} strokeWidth={1.6} />
            <Body size={16} color={colors.muted} style={{ textAlign: 'center' }}>
              No photos on this phone from that time and place. They may have been taken with location
              switched off in the camera, or deleted since.
            </Body>
          </View>
        ) : (
          <>
            <Body size={14} color={colors.muted}>
              {shots.length} {shots.length === 1 ? 'photo' : 'photos'} from within a few hours, near where you were.
              Tap the ones to share.
            </Body>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {shots.map((s, i) => {
                const on = chosen.has(s.id);
                return (
                  <Pressable
                    key={s.id}
                    accessibilityLabel={`${s.isVideo ? 'Video' : 'Photo'} at ${new Date(s.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => toggle(s.id)}
                    style={{ width: tile, height: tile, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.sand }}
                  >
                    <Image source={{ uri: s.uri }} style={{ width: tile, height: tile }} resizeMode="cover" />
                    {s.isVideo && !on && (
                      <View style={{ position: 'absolute', left: 6, bottom: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={12} color={colors.white} fill={colors.white} />
                      </View>
                    )}
                    {on && (
                      <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(91,63,208,0.35)', alignItems: 'flex-end', padding: 6 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={14} color={colors.white} strokeWidth={3} />
                        </View>
                      </View>
                    )}
                    {/* Tapping the tile still picks it. This is the way to look first. */}
                    <Pressable
                      accessibilityLabel="See this photo full size"
                      onPress={() => setPeek(i)}
                      hitSlop={4}
                      style={{ position: 'absolute', right: 6, bottom: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Expand size={13} color={colors.white} strokeWidth={2.4} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>

          </>
        )}
      </ScrollView>

      <ShotPreview
        shots={shots ?? []}
        startAt={peek}
        chosen={chosen}
        onToggle={toggle}
        onClose={() => setPeek(null)}
      />

      {shots !== null && shots.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.inputBorder, backgroundColor: colors.white }}>
          {sharing
            ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
            : <Button
                label={picked.length ? `Share ${picked.length}` : 'Select photos to share'}
                variant={picked.length ? 'violet' : 'sand'}
                onPress={send}
              />}
        </View>
      )}
    </Screen>
  );
}
