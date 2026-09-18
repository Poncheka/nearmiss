// A shared clip, playing where it was shared rather than throwing you into Safari.
//
// Kept in its own file so the near miss screen doesn't import expo-video on web, where the
// native player doesn't exist.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'lucide-react-native';
import { colors } from '@/theme';

export function SharedVideo({
  uri,
  size = 220,
  width,
  height,
}: {
  uri: string;
  /** Shorthand for a square. Ignored when width and height are given. */
  size?: number;
  width?: number;
  height?: number;
}) {
  const [started, setStarted] = useState(false);
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  const w = width ?? size;
  const h = height ?? size;

  return (
    <View style={{ width: w, height: h, backgroundColor: colors.ink }}>
      <VideoView
        style={{ width: w, height: h }}
        player={player}
        contentFit="cover"
        nativeControls={started}
        fullscreenOptions={{ enable: true }}
      />
      {!started && (
        <Pressable
          accessibilityLabel="Play"
          onPress={() => { setStarted(true); player.play(); }}
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={24} color={colors.white} fill={colors.white} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
