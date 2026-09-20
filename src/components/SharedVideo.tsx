// A shared clip, playing where it was shared rather than throwing you into Safari.
//
// Kept in its own file so the near miss screen doesn't import expo-video on web, where the
// native player doesn't exist.
//
// It used to mount a player and a play button and hope. If the source never loaded, and a
// signed URL that has expired never will, you got a black rectangle with a play triangle on it
// that did nothing when pressed, and no way to tell that apart from a clip that was simply
// slow. Now the player's own status drives what is on screen: loading, the first frame, or the
// reason it failed, in words.
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play, VideoOff } from 'lucide-react-native';
import { Body } from '@/components/ui';
import { colors } from '@/theme';

export function SharedVideo({
  uri,
  size = 220,
  width,
  height,
  /** 'cover' fills a square thumbnail; 'contain' is what full screen wants, uncropped. */
  contentFit = 'cover',
}: {
  uri: string;
  /** Shorthand for a square. Ignored when width and height are given. */
  size?: number;
  width?: number;
  height?: number;
  contentFit?: 'cover' | 'contain';
}) {
  const [started, setStarted] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    // Muted so nothing blares out of a thread, and paused so the view settles on a frame. That
    // frame is the thumbnail: there is no separate image to generate or store.
    p.muted = true;
  });
  // The player's properties don't move React state, so the only way to know what it is doing is
  // to listen. Without this there is nothing to tell a slow clip from a broken one.
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const w = width ?? size;
  const h = height ?? size;

  const play = () => {
    setStarted(true);
    player.muted = false;
    player.play();
  };

  return (
    <View style={{ width: w, height: h, backgroundColor: colors.ink }}>
      <VideoView
        style={{ width: w, height: h }}
        player={player}
        contentFit={contentFit}
        nativeControls={started}
        fullscreenOptions={{ enable: true }}
      />

      {/* 'idle' counts as not ready. Left out, a player sitting in idle showed a black box with
          nothing on it and no way to tell it apart from a broken one. */}
      {(status === 'loading' || status === 'idle') && !started && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.white} />
        </View>
      )}

      {status === 'error' && (
        // Shown rather than swallowed. A clip that will not play is worth saying out loud, and
        // the message is the only thing that makes it fixable.
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16 }}>
          <VideoOff size={22} color="rgba(255,255,255,0.75)" strokeWidth={2} />
          <Body size={13} color="rgba(255,255,255,0.75)" style={{ textAlign: 'center' }}>
            This clip wouldn&apos;t play
          </Body>
          {error?.message ? (
            <Body size={11} color="rgba(255,255,255,0.45)" style={{ textAlign: 'center' }} numberOfLines={2}>
              {error.message}
            </Body>
          ) : null}
        </View>
      )}

      {status === 'readyToPlay' && !started && (
        <Pressable
          accessibilityLabel="Play"
          onPress={play}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Play size={24} color={colors.white} fill={colors.white} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
