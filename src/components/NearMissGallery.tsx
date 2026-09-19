// The map, then the photos, in one swipe.
//
// The map is always first because it is the thing that makes a near miss legible: two dots and
// the distance between them. But once people start adding photos from that day, those are the
// reason to come back, and burying them below a conversation made them feel like attachments
// rather than the point.
//
// Swiping works here only because the card map is not interactive: it renders with
// pointerEvents "none", so it never takes the pan. An interactive map inside a pager would
// swallow every horizontal gesture, which is the same trap that made the map look broken when it
// sat inside the vertical scroll view.
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Maximize2 } from 'lucide-react-native';
import { PairMap } from '@/components/map/PairMap';
import { SharedVideo } from '@/components/SharedVideo';
import { Body, Card } from '@/components/ui';
import { RealNearMiss } from '@/lib/nearMisses';
import { SharedPhoto } from '@/lib/sharedPhotos';
import { colors, radius } from '@/theme';

const HEIGHT = 240;

export function NearMissGallery({
  nm,
  width,
  photos,
  name,
  onUnshare,
}: {
  nm: RealNearMiss;
  width: number;
  photos: SharedPhoto[];
  name: string;
  onUnshare: (photo: SharedPhoto) => void;
}) {
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const pages = 1 + photos.length;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const current = page > 0 ? photos[page - 1] : null;
  const stamp = current
    ? new Date(current.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <Card style={{ overflow: 'hidden' }}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={{ width, height: HEIGHT }}
      >
        <Pressable
          onPress={() => router.push({ pathname: '/map/[id]', params: { id: nm.id } })}
          style={{ width, height: HEIGHT }}
        >
          <PairMap
            me={{ latitude: nm.my_lat, longitude: nm.my_lng }}
            them={{ latitude: nm.their_lat, longitude: nm.their_lng }}
            height={HEIGHT}
            width={width}
          />
          <View style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Maximize2 size={14} color={colors.ink} strokeWidth={2.2} />
            <Body size={13} weight="semibold">Open map</Body>
          </View>
        </Pressable>

        {photos.map((photo, i) => (
          <Pressable
            key={photo.id}
            accessibilityLabel={`Open ${photo.isVideo ? 'video' : 'photo'} full screen`}
            onPress={() => router.push({ pathname: '/photo/[id]', params: { id: nm.id, index: String(i) } })}
            onLongPress={() => photo.mine && onUnshare(photo)}
            style={{ width, height: HEIGHT, backgroundColor: colors.ink }}
          >
            {!photo.url ? (
              <View style={{ width, height: HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.violet} />
              </View>
            ) : photo.isVideo ? (
              <SharedVideo uri={photo.url} width={width} height={HEIGHT} />
            ) : (
              <Image source={{ uri: photo.url }} style={{ width, height: HEIGHT }} resizeMode="cover" />
            )}
            {/* The carousel crops to fill, so it isn't obvious there is more of the picture.
                This says there is. */}
            {!photo.isVideo && photo.url ? (
              <View style={{ position: 'absolute', right: 12, top: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }}>
                <Maximize2 size={15} color={colors.white} strokeWidth={2.2} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      {/* Dots, and whatever the current page needs said about it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
        {page === 0 ? (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.violet }} />
              <Body size={13} color={colors.text2}>You</Body>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }} />
              <Body size={13} color={colors.text2}>{name}</Body>
            </View>
          </View>
        ) : (
          <Body size={13} color={colors.text2} numberOfLines={1} style={{ flex: 1 }}>
            {current?.mine ? 'You' : (current?.owner_name?.split(' ')[0] ?? name)} · {stamp}
          </Body>
        )}

        {pages > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {Array.from({ length: pages }, (_, i) => (
              <View
                key={i}
                style={{
                  width: i === page ? 18 : 6, height: 6, borderRadius: 3,
                  backgroundColor: i === page ? colors.ink : colors.inputBorder,
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
