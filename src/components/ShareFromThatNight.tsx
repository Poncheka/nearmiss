// "Share a photo from that night", on the near miss itself.
//
// The photos from that overlap are already known, so they are loaded and shown rather than
// waiting behind a button. Sharing becomes a decision about specific pictures you are looking
// at, which is the moment worth designing for, instead of an errand that starts with hunting
// through a picker.
//
// Disappears once there is nothing left to offer: no photos from that window, or you have
// already shared them all.
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Check, Expand, Play } from 'lucide-react-native';
import { Body, TextLink } from '@/components/ui';
import { ShotPreview } from '@/components/ShotPreview';
import { RealNearMiss } from '@/lib/nearMisses';
import { useSharedPhotos } from '@/lib/sharedPhotos';
import { LocalShot, shotsFromThatDay } from '@/lib/thatDay';
import { colors, radius } from '@/theme';

/** Enough to choose from without turning the near miss into a camera roll. */
const SHOWN = 8;
const TILE = 76;

export function ShareFromThatNight({ nm, name, theyShared }: { nm: RealNearMiss; name: string; theyShared: boolean }) {
  const busy = useSharedPhotos((s) => !!s.busy[nm.id]);
  // Anything already on this near miss drops out of the strip, so the same photo can't be sent
  // twice and pile up in the carousel.
  //
  // The selector returns the stored array itself and the Set is built here. Building it inside
  // the selector crashed the app: zustand v5 compares snapshots with Object.is, and a fresh Set
  // every read is never equal to the last one, so React re-rendered forever. In a release build
  // that is not a warning, it is the app closing.
  const shared = useSharedPhotos((s) => s.byNearMiss[nm.id]);
  const alreadyShared = useMemo(
    () => new Set((shared ?? []).map((p) => p.asset_id).filter(Boolean) as string[]),
    [shared],
  );
  const [shots, setShots] = useState<LocalShot[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // Shared in this session: dropped from the strip so it doesn't offer the same photo twice.
  const [sent, setSent] = useState<Set<string>>(new Set());
  // Position within the visible strip of whichever photo is open full size.
  const [peek, setPeek] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setShots(null);
    setChosen(new Set());
    setSent(new Set());
    shotsFromThatDay(nm)
      .then((found) => { if (live) setShots(found); })
      .catch(() => { if (live) setShots([]); });
    return () => { live = false; };
  }, [nm.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = useMemo(
    () => (shots ?? []).filter((s) => !sent.has(s.id) && !alreadyShared.has(s.id)),
    [shots, sent, alreadyShared],
  );
  const picked = useMemo(() => available.filter((s) => chosen.has(s.id)), [available, chosen]);
  // The strip and the preview walk the same list, so "3 of 8" means what it says.
  const shown = useMemo(() => available.slice(0, SHOWN), [available]);

  // Nothing found on this phone: no strip at all. The composer still has the picker for the
  // person who knows they have something we couldn't find.
  if (shots !== null && available.length === 0) return null;

  const toggle = (id: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const share = async () => {
    if (!picked.length) return;
    try {
      await useSharedPhotos.getState().share(nm.id, picked.map((s) => ({
        uri: s.uri,
        isVideo: s.isVideo,
        filename: s.filename,
        assetId: s.id,
      })));
      setSent((prev) => new Set([...prev, ...picked.map((s) => s.id)]));
      setChosen(new Set());
    } catch (e) {
      Alert.alert("Couldn't share that", e instanceof Error ? e.message : String(e));
    }
  };

  const night = new Date(nm.closest_at).getHours() >= 17 ? 'that night' : 'that day';
  const label = picked.length === 1 ? 'photo' : 'photos';
  // "Share back" only when they went first. Otherwise it reads like a reply to nothing.
  const verb = theyShared ? 'Share back' : 'Share';

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Body size={17} weight="bold">Share a photo from {night}</Body>
        {shots && shots.length > SHOWN ? (
          <TextLink
            label="See all"
            size={14}
            onPress={() => router.push({ pathname: '/that-day/[id]', params: { id: nm.id } })}
          />
        ) : null}
      </View>

      {shots === null ? (
        <View style={{ height: TILE, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.violet} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        >
          {shown.map((s, i) => {
            const on = chosen.has(s.id);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${s.isVideo ? 'Video' : 'Photo'} at ${new Date(s.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                onPress={() => toggle(s.id)}
                style={{ width: TILE, height: TILE, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.sand }}
              >
                <Image source={{ uri: s.uri }} style={{ width: TILE, height: TILE }} resizeMode="cover" />
                {s.isVideo && !on ? (
                  <View style={{ position: 'absolute', left: 6, bottom: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={10} color={colors.white} fill={colors.white} />
                  </View>
                ) : null}
                <View style={{ position: 'absolute', inset: 0, backgroundColor: on ? 'rgba(91,63,208,0.3)' : 'transparent', alignItems: 'flex-end', padding: 5 }}>
                  <View style={{
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: on ? colors.violet : 'rgba(0,0,0,0.28)',
                    borderWidth: on ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.9)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {on ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
                  </View>
                </View>
                {/* 76pt is enough to remember a moment, not enough to choose one. */}
                <Pressable
                  accessibilityLabel="See this photo full size"
                  onPress={() => setPeek(i)}
                  hitSlop={4}
                  style={{ position: 'absolute', right: 5, bottom: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Expand size={11} color={colors.white} strokeWidth={2.4} />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {picked.length > 0 ? (
        <Pressable
          onPress={share}
          disabled={busy}
          accessibilityRole="button"
          style={{
            minHeight: 50, borderRadius: radius.pill, backgroundColor: colors.violet,
            alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1,
          }}
        >
          {busy
            ? <ActivityIndicator color={colors.white} />
            : <Body size={16} weight="bold" color={colors.white}>
                {verb} {picked.length} {label} with {name}
              </Body>}
        </Pressable>
      ) : null}

      <ShotPreview
        shots={shown}
        startAt={peek}
        chosen={chosen}
        onToggle={toggle}
        onClose={() => setPeek(null)}
      />
    </View>
  );
}
