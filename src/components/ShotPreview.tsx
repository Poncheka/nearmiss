// Look at a photo properly before you send it.
//
// The picker shows 76pt tiles, which is enough to remember a moment but not enough to decide
// whether this is the one. Deciding is the whole point of the screen, so a photo you are about
// to hand to someone should be lookable at first.
//
// A modal rather than a route: the shots come from the phone's library and live in the picker's
// own state, so pushing a screen would mean marshalling them through route params or a store for
// no gain. Pinch to zoom is a ScrollView with zoom scales, the same trick as the shared-photo
// viewer, which keeps this free of any native dependency.
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Body } from '@/components/ui';
import { LocalShot } from '@/lib/thatDay';
import { colors, radius } from '@/theme';

export function ShotPreview({
  shots,
  startAt,
  chosen,
  onToggle,
  onClose,
}: {
  shots: LocalShot[];
  /** Which one was tapped, or null when nothing is open. */
  startAt: number | null;
  chosen: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(startAt ?? 0);
  const pager = useRef<ScrollView>(null);

  const open = startAt !== null;

  useEffect(() => {
    if (startAt === null) return;
    setPage(startAt);
    // The pager has to exist before it can be scrolled, so this waits a frame.
    requestAnimationFrame(() => pager.current?.scrollTo({ x: startAt * width, animated: false }));
  }, [startAt, width]);

  if (!open) return null;

  const frameTop = insets.top + 52;
  const frameBottom = insets.bottom + 92;
  const frameHeight = Math.max(height - frameTop - frameBottom, 200);

  const current = shots[page];
  const on = current ? chosen.has(current.id) : false;
  const taken = current
    ? new Date(current.at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  const step = (by: number) => {
    const next = Math.min(Math.max(page + by, 0), shots.length - 1);
    pager.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / width);
            if (next !== page) setPage(next);
          }}
          style={{ position: 'absolute', top: frameTop, height: frameHeight, width }}
        >
          {shots.map((s) => (
            <ScrollView
              key={s.id}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={{ width, height: frameHeight }}
              contentContainerStyle={{ width, height: frameHeight, alignItems: 'center', justifyContent: 'center' }}
            >
              <Image
                source={{ uri: s.uri }}
                style={{ width, height: frameHeight }}
                resizeMode="contain"
                accessibilityLabel={`Photo taken at ${new Date(s.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
              />
            </ScrollView>
          ))}
        </ScrollView>

        <View style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            accessibilityLabel="Close preview"
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.white} strokeWidth={2.2} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Body size={15} weight="bold" color={colors.white}>{taken}</Body>
            {current ? (
              <Body size={12} color="rgba(255,255,255,0.65)">
                {current.distanceM}m from where you were
              </Body>
            ) : null}
          </View>
          {shots.length > 1 ? (
            <Body size={13} color="rgba(255,255,255,0.65)">{page + 1} of {shots.length}</Body>
          ) : null}
        </View>

        {/* Arrows as well as swipe: one hand on a phone, deciding between twenty photos. */}
        {shots.length > 1 ? (
          <>
            {page > 0 ? (
              <Pressable
                accessibilityLabel="Previous photo"
                onPress={() => step(-1)}
                style={{ position: 'absolute', left: 8, top: frameTop + frameHeight / 2 - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={22} color={colors.white} strokeWidth={2.4} />
              </Pressable>
            ) : null}
            {page < shots.length - 1 ? (
              <Pressable
                accessibilityLabel="Next photo"
                onPress={() => step(1)}
                style={{ position: 'absolute', right: 8, top: frameTop + frameHeight / 2 - 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={22} color={colors.white} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </>
        ) : null}

        {/* Choosing from in here is the point: you looked, now decide. */}
        {current ? (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16 }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => onToggle(current.id)}
              style={{
                minHeight: 52, borderRadius: radius.pill, flexDirection: 'row', gap: 8,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? colors.violet : 'rgba(255,255,255,0.16)',
              }}
            >
              {on ? <Check size={18} color={colors.white} strokeWidth={3} /> : null}
              <Body size={16} weight="bold" color={colors.white}>
                {on ? 'Selected' : 'Select this one'}
              </Body>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
