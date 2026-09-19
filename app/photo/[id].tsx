// A shared photo, full screen.
//
// Pinch to zoom is a plain ScrollView with zoom scales set, not a gesture library. iOS gives
// that for free, it costs no native dependency, and it means this shipped over the air instead
// of waiting for a build.
//
// The reactions sit under the photo rather than over it, because a heart floating on top of
// someone's picture from 2019 covers the thing you came to look at.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
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

export default function PhotoViewer() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const nm = useNearMisses((s) => s.items.find((x) => x.id === id));
  const photos = useSharedPhotos((s) => (id ? s.byNearMiss[id] ?? [] : []));
  const reactions = useReactions((s) => (id ? s.byNearMiss[id] : undefined));

  const start = Math.min(Math.max(Number(index ?? 0) || 0, 0), Math.max(photos.length - 1, 0));
  const [page, setPage] = useState(start);
  const pager = useRef<ScrollView>(null);

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
  const stamp = current
    ? new Date(current.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <StatusBar style="light" />

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
              <SharedVideo uri={photo.url} width={width} height={frameHeight} />
            ) : (
              // Zooming is per photo, so pinching one doesn't leave the next one scaled.
              <ScrollView
                maximumZoomScale={4}
                minimumZoomScale={1}
                bouncesZoom
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
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
          <Body size={12} color="rgba(255,255,255,0.65)" numberOfLines={1}>{stamp}</Body>
        </View>
        {photos.length > 1 ? (
          <Body size={13} color="rgba(255,255,255,0.65)">{page + 1} of {photos.length}</Body>
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
    </View>
  );
}
