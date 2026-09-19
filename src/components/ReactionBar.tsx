// React to a message or a photo.
//
// Two states in one component. Closed, it shows whatever has been said: the emoji on this thing,
// with yours ringed. Tapping opens the six choices, tapping one picks it, tapping your own again
// takes it back.
//
// It opens inline rather than as a popover because a popover over a photo covers the photo, and
// because everything here is two people, so the row is never longer than two.
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SmilePlus } from 'lucide-react-native';
import { Body } from '@/components/ui';
import { EMOJI, Reaction, ReactionTarget, reactionsFor, useReactions } from '@/lib/reactions';
import { colors, radius } from '@/theme';

export function ReactionBar({
  nearMissId,
  target,
  targetId,
  all,
  dark = false,
  align = 'left',
}: {
  nearMissId: string;
  target: ReactionTarget;
  targetId: string;
  all: Reaction[] | undefined;
  /** On the full-screen photo, where the background is the photo itself. */
  dark?: boolean;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const { list, mine } = reactionsFor(all, target, targetId);

  const chipBg = dark ? 'rgba(255,255,255,0.16)' : colors.white;
  const chipBorder = dark ? 'rgba(255,255,255,0.22)' : colors.cardBorder;
  const hint = dark ? 'rgba(255,255,255,0.6)' : colors.faint;

  const pick = async (emoji: string) => {
    setOpen(false);
    Haptics.selectionAsync().catch(() => {});
    try {
      await useReactions.getState().react(nearMissId, target, targetId, emoji);
    } catch (e) {
      Alert.alert("Couldn't react", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={{ gap: 6, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {open ? (
        <View style={{
          flexDirection: 'row', gap: 2, padding: 4,
          borderRadius: radius.pill, backgroundColor: chipBg,
          borderWidth: 1, borderColor: chipBorder,
        }}>
          {EMOJI.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={mine === emoji ? `Remove ${emoji}` : `React ${emoji}`}
              onPress={() => pick(emoji)}
              style={{
                width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                backgroundColor: mine === emoji ? (dark ? 'rgba(255,255,255,0.22)' : colors.violetTint) : 'transparent',
              }}
            >
              <Body size={21}>{emoji}</Body>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {list.map((r) => (
          <Pressable
            key={`${r.user_id}-${r.emoji}`}
            accessibilityLabel={r.mine ? `Your reaction, ${r.emoji}` : `Their reaction, ${r.emoji}`}
            onPress={() => (r.mine ? pick(r.emoji) : setOpen((v) => !v))}
            style={{
              minWidth: 32, height: 28, paddingHorizontal: 7, borderRadius: radius.pill,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: chipBg,
              borderWidth: r.mine ? 1.5 : 1,
              borderColor: r.mine ? colors.violet : chipBorder,
            }}
          >
            <Body size={15}>{r.emoji}</Body>
          </Pressable>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close reactions' : 'Add a reaction'}
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          style={{
            width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: open ? chipBg : 'transparent',
            borderWidth: open ? 1 : 0, borderColor: chipBorder,
          }}
        >
          <SmilePlus size={16} color={hint} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}
