// The map on the near miss page sits inside a scrolling page, so the page wins every pan
// gesture and the map feels stuck. Full screen, nothing competes: pinch, zoom, drag, and
// Apple's own labels for the shops and bars that are there now.
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { Body, Screen } from '@/components/ui';
import { PairMap } from '@/components/map/PairMap';
import { formatWhen, nearLabel, otherName, placeLabel, useNearMisses } from '@/lib/nearMisses';
import { colors, radius } from '@/theme';

export default function FullMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nm = useNearMisses((s) => s.items.find((x) => x.id === id));
  const [showKey, setShowKey] = useState(true);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!nm) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Body size={16} color={colors.muted}>That near miss isn't loaded.</Body>
          <Pressable onPress={close} style={{ minHeight: 44, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.violet, justifyContent: 'center' }}>
            <Body size={15} weight="bold" color={colors.white}>Close</Body>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const name = otherName(nm);
  const when = formatWhen(nm.closest_at);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PairMap
        me={{ latitude: nm.my_lat, longitude: nm.my_lng }}
        them={{ latitude: nm.their_lat, longitude: nm.their_lng }}
        height={10000}
        interactive
        fill
      />

      <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 20, left: 16, right: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Pressable
            accessibilityLabel="Close map"
            onPress={close}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
          >
            <X size={20} color={colors.ink} strokeWidth={2.2} />
          </Pressable>

          <Pressable
            onPress={() => setShowKey((v) => !v)}
            style={{ flex: 1, backgroundColor: colors.white, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
          >
            <Body size={15} weight="bold" numberOfLines={1}>{placeLabel(nm).split(',')[0]}</Body>
            <Body size={13} color={colors.muted} numberOfLines={1}>
              {when.short} · {nearLabel(nm)}
            </Body>
            {showKey && (
              <View style={{ flexDirection: 'row', gap: 14, paddingTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.violet }} />
                  <Body size={13} color={colors.text2}>You</Body>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }} />
                  <Body size={13} color={colors.text2}>{name}</Body>
                </View>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
