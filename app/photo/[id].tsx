// A shared photo, full screen.
//
// Pinch to zoom is a plain ScrollView with zoom scales set, not a gesture library. iOS gives
// that for free, it costs no native dependency, and it means this shipped over the air instead
// of waiting for a build.
//
// The reactions sit under the photo rather than over it, because a heart floating on top of
// someone's picture from 2019 covers the thing you came to look at.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, PanResponder, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, X } from 'lucide-react-native';
import { SharedVideo } from '@/components/SharedVideo';
import { ReactionBar } from '@/components/ReactionBar';
import { Body } from '@/components/ui';
import { otherName, useNearMisses } from '@/lib/nearMisses';
import { SharedPhoto, useSharedPhotos } from '@/lib/sharedPhotos';
import { useReactions } from '@/lib/reactions';
import { colors } from '@/theme';

/** One shared empty array, so the selector below always hands back the same reference. */
const NONE: SharedPhoto[] = [];

export default function PhotoViewer() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const nm = useNearMisses((s) => s.items.find((x) => x.id === id));
  // NONE rather than a fresh [], for the reason spelled out in ShareFromThatNight: a selector
  // that builds a new value every read never compares equal, and React spins.
  const photos = useSharedPhotos((s) => (id ? s.byNearMiss[id] ?? NONE : NONE));
  const reactions = useReactions((s) => (id ? s.byNearMiss[id] : undefined));

  const start = Math.min(Math.max(Number(index ?? 0) || 0, 0), Math.max(photos.length - 1, 0));
  const [page, setPage] = useState(start);
  const pager = useRef<ScrollView>(null);

  // Flick down to leave, the way every photo viewer works. PanResponder rather than a gesture
  // library, because the library would be a native dependency and this ships over the air.
  //
  // The responder only claims a gesture that is clearly downward, so the horizontal pager still
  // gets its swipes, and only while the photo is unzoomed, so panning around a zoomed picture is
  // never mistaken for a dismissal.
  const drag = useRef(new Animated.Value(0)).current;
  const zoomed = useRef(false);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) =>
      !zoomed.current && g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.6,
    onPanResponderMove: (_e, g) => { if (g.dy > 0) drag.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 120 || g.vy > 0.8) {
        Animated.timing(drag, { toValue: 900, duration: 180, useNativeDriver: true })
          .start(() => (router.canGoBack() ? router.back() : router.replace('/')));
      } else {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    },
  }), [drag]);

  // The backdrop thins out as you pull, so the gesture feels like lifting the photo off the page.
  const backdrop = drag.interpolate({ inputRange: [0, 300], outputRange: [1, 0.2], extrapolate: 'clamp' });

  // The pager can't be told where to start until it has been laid out once.
  useEffect(() => {
    if (start > 0) requestAnimationFrame(() => pager.current?.scrollTo({ x: start * width, animated: false }));
  }, [start, width]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const current: SharedPhoto | undefined = photos[page];
  const name = nm ? otherName(nm) : 'them';

  // Room for the chrome above and below, so a tall photo isn't hidden behind either.
  const frameTop = insets.top + 52;
  const frameBottom = insets.bottom + 104;
  const frameHeight = Math.max(height - frameTop - frameBottom, 200);

  const unshare = () => {
    if (!current || !current.mine || !id) return;
    Alert.alert(
      'Remove this photo?',
      `${name} won't be able to see it anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await useSharedPhotos.getState().remove(id, current);
              if (photos.length <= 1) close(); else setPage((p) => Math.max(0, p - 1));
            } catch (e) {
              Alert.alert("Couldn't remove it", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  if (!photos.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <StatusBar style="light" />
        <Body size={16} color={colors.white}>That photo isn't here anymore.</Body>
        <Pressable onPress={close} style={{ minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
          <Body size={15} weight="bold" color={colors.white}>Close</Body>
        </Pressable>
      </View>
    );
  }

  const who = current?.mine ? 'You' : (current?.owner_name?.split(' ')[0] ?? name);

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <StatusBar style="light" />
      <Animated.View style={{ position: 'absolute', inset: 0, backgroundColor: colors.ink, opacity: backdrop }} />

      <Animated.View style={{ flex: 1, transform: [{ translateY: drag }] }}>
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
        {photos.map((photo) => (
          <View key={photo.id} style={{ width, height: frameHeight }}>
            {!photo.url ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : photo.isVideo ? (
              <SharedVideo uri={photo.url} width={width} height={frameHeight} contentFit="contain" />
            ) : (
              // Zooming is per photo, so pinching one doesn't leave the next one scaled.
              <ScrollView
                maximumZoomScale={4}
                minimumZoomScale={1}
                bouncesZoom
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => { zoomed.current = e.nativeEvent.zoomScale > 1.01; }}
                contentContainerStyle={{ width, height: frameHeight, alignItems: 'center', justifyContent: 'center' }}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={{ width, height: frameHeight }}
                  resizeMode="contain"
                  accessibilityLabel={`Photo shared by ${photo.mine ? 'you' : name}`}
                />
              </ScrollView>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Close, and who this belongs to. */}
      <View style={{ position: 'absolute', top: insets.top + 6, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={close}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} color={colors.white} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Body size={15} weight="bold" color={colors.white} numberOfLines={1}>{who}</Body>
        </View>
        {/* Where you are in the set, as dots rather than "3 of 5". You can see how many there
            are and which one this is without being handed arithmetic. Past a handful the count
            stops being the interesting part, so the dots stop too. */}
        {photos.length > 1 && photos.length <= 8 ? (
          <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
            {photos.map((p, i) => (
              <View
                key={p.id}
                style={{
                  width: 6, height: 6, borderRadius: 3,
                  backgroundColor: i === page ? colors.white : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </View>
        ) : null}
        {current?.mine ? (
          <Pressable
            accessibilityLabel="Remove this photo"
            onPress={unshare}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={18} color={colors.white} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {/* React to the one you're looking at. */}
      {current && id ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16, paddingHorizontal: 16 }}>
          <ReactionBar
            nearMissId={id}
            target="photo"
            targetId={current.id}
            all={reactions}
            dark
          />
        </View>
      ) : null}
      </Animated.View>
    </View>
  );
}
