// One near miss, as a card.
//
// Lives here rather than in the feed because the friend profile shows the same thing: the near
// misses you two have, in the same shape, so moving between the two does not feel like looking
// at two different apps.
import { memo, useEffect } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, MessageCircle, Sparkles } from 'lucide-react-native';
import { Avatar, PersonAvatar } from '@/components/avatar';
import { PairMap } from '@/components/map/PairMap';
import { Body, Chip, ChipTone, UnreadDot } from '@/components/ui';
import { barelyMissedLine, formatWhen, isBarelyMissed, kindLabel, nearLabel, otherName, placeLabel, RealNearMiss } from '@/lib/nearMisses';
import { occasionFor } from '@/lib/occasions';
import { colors, fonts, pastel, radius } from '@/theme';

const openNearMiss = (id: string) => router.push({ pathname: '/near-miss/[id]', params: { id } });

const PASTELS = [pastel.lilac, pastel.peach, pastel.sage, pastel.butter, pastel.sky];
const colorFor = (key: string) => PASTELS[[...key].reduce((n, ch) => n + ch.charCodeAt(0), 0) % PASTELS.length];

/**
 * One clock for every card that is waiting to be opened.
 *
 * Shared on purpose. A value per card means each one starts whenever it happened to mount, so a
 * feed of them shimmers at random and reads as a glitch. Driven from here they breathe together,
 * which reads as deliberate. It is also one timer rather than one per row, on the UI thread, so
 * a long feed costs nothing.
 */
const pulse = new Animated.Value(0);
let pulsing = false;
function startPulse() {
  if (pulsing) return;
  pulsing = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]),
  ).start();
}
const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

export function RealPair({ nm, size = 34 }: { nm: RealNearMiss; size?: number }) {
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

export const NearMissCard = memo(function NearMissCard({ nm, width, myBirthday }: { nm: RealNearMiss; width: number; myBirthday?: string | null }) {
  const name = otherName(nm);
  const when = formatWhen(nm.closest_at);
  const place = placeLabel(nm);
  const mapHeight = Math.round(width * 0.72);
  const barely = isBarelyMissed(nm);
  const occasion = occasionFor(nm.closest_at, { mine: myBirthday, theirs: nm.other_birthday, theirName: nm.other_name });
  // Never opened. The ribbon says it now, so it does not also need a chip in a row of five.
  const fresh = nm.is_new;
  useEffect(() => { if (fresh) startPulse(); }, [fresh]);
  const tags: { label: string; tone: ChipTone }[] = [];
  tags.push({ label: kindLabel(nm), tone: nm.kind === 'crossed' ? 'violet' : 'outline' });
  if (occasion) tags.push({ label: occasion.label, tone: occasion.loud ? 'green' : 'outline' });
  if (nm.via_name) tags.push({ label: `Friend of ${nm.via_name.split(' ')[0]}`, tone: 'green' });
  if (nm.is_before_met) tags.push({ label: 'Before you met', tone: 'violet' });
  return (
    <Pressable
      onPress={() => openNearMiss(nm.id)}
      accessibilityRole="button"
      accessibilityLabel={`${fresh ? 'Unopened. ' : ''}${place}, you and ${name}, ${when.date}`}
    >
      <View style={{ backgroundColor: colors.card, borderRadius: radius.cardLg, borderWidth: 1, borderColor: fresh ? colors.violet : colors.cardBorder, overflow: 'hidden' }}>
        {/* The one thing worth interrupting the feed for: something found for you that you have
            not looked at yet. It gets the top of the card rather than a chip in the row below,
            because a chip among four others is not news. */}
        {fresh && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.violet, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Sparkles size={15} color={colors.white} strokeWidth={2.4} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white, letterSpacing: 0.2 }}>
              New · you haven&apos;t seen this one
            </Text>
          </View>
        )}
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
          <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: barely ? colors.violet : colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: barely ? colors.violet : colors.inputBorder, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: barely ? colors.white : colors.ink }}>{nearLabel(nm)}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 8 }}>
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tags.map((t) => <Chip key={t.label} label={t.label} tone={t.tone} />)}
            </View>
          )}
          {barely ? (
            <Body size={16} weight="bold">
              {barelyMissedLine(nm, name)}{nm.place_name ? ` At ${place.split(',')[0]}.` : ''}
            </Body>
          ) : (
            <Body size={15} color={colors.text2}>
              {nm.kind === 'crossed'
                ? `You and ${name} were ${nm.distance_m}m apart${nm.place_name ? ` at ${place.split(',')[0]}` : ''}.`
                : `You and ${name} were both ${nm.place_name ? `at ${place.split(',')[0]}` : 'in the same spot'} that night, ${nearLabel(nm).toLowerCase()}.`}
            </Body>
          )}
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
      {/* Drawn over the card rather than on it, so the breathing is opacity alone and can run on
          the UI thread. pointerEvents none keeps the whole card tappable through it. */}
      {fresh && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: radius.cardLg, borderWidth: 2, borderColor: colors.violet, opacity: glow,
          }}
        />
      )}
    </Pressable>
  );
});
