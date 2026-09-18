// The one time we ask about notifications.
//
// Shown in the feed, under the first near miss, because that is the moment the question answers
// itself: you are looking at something a friend might reply to. Asking at sign-up would spend
// the single prompt iOS allows on someone who has not seen the app work yet.
//
// Either button spends the offer. Dismissing is an answer, and nagging is how "Not now" turns
// into "never" in the system settings.
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { Body, Card, IconTile } from '@/components/ui';
import { askForPush, canOfferPush, offerDeclined } from '@/lib/push';
import { colors, radius } from '@/theme';

export function PushOffer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    canOfferPush().then((can) => { if (live) setShow(can); }).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!show) return null;

  const yes = async () => {
    setShow(false);
    await askForPush();
  };

  const no = async () => {
    setShow(false);
    await offerDeclined();
  };

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <IconTile bg={colors.violetTint} size={40} radiusSize={14}>
          <Bell size={19} color={colors.ink} strokeWidth={2} />
        </IconTile>
        <View style={{ flex: 1 }}>
          <Body size={16} weight="bold">Hear about it when it happens</Body>
          <Body size={14} color={colors.muted}>
            A new near miss, a reply, a photo from that day. Nothing else.
          </Body>
        </View>
        <Pressable accessibilityLabel="Not now" onPress={no} hitSlop={10} style={{ padding: 2 }}>
          <X size={18} color={colors.faint} strokeWidth={2} />
        </Pressable>
      </View>
      <Pressable
        onPress={yes}
        accessibilityRole="button"
        style={{ minHeight: 46, borderRadius: radius.pill, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}
      >
        <Body size={15} weight="bold" color={colors.white}>Turn on notifications</Body>
      </Pressable>
    </Card>
  );
}
