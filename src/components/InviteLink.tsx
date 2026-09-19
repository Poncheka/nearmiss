// Your personal invite link.
//
// It used to open the Invite tab, above a search box and a list of contacts, which made a tab
// that was mostly for finding people look like it was mostly for recruiting them. The link is a
// thing about you, so it lives on your profile, and the other tab is free to be search.
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Share as ShareIcon, X } from 'lucide-react-native';
import { Body, Display } from '@/components/ui';
import { inviteLink, inviteMessage } from '@/lib/contacts';
import { colors, fonts, radius } from '@/theme';

export function InviteLink({ username, onDismiss }: { username?: string | null; onDismiss?: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(username ?? undefined);

  const copy = async () => {
    await Clipboard.setStringAsync(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ padding: 16, borderRadius: radius.cardLg, backgroundColor: colors.violet, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Display size={22} style={{ color: colors.white }}>Invite friends to see your missed connections</Display>
          <Body size={14} color="rgba(255,255,255,0.85)">
            When they join and scan their photos, you'll both see every time you were steps apart.
          </Body>
        </View>
        {/* Dismissable, because a card you have read a hundred times is clutter. The link itself
            never goes away: it comes back from the Invite button under your name. */}
        {onDismiss ? (
          <Pressable
            accessibilityLabel="Hide invite card"
            onPress={onDismiss}
            hitSlop={10}
            style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={15} color={colors.white} strokeWidth={2.6} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingLeft: 14, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)' }}>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.white }}>
          {link.replace(/^https?:\/\//, '')}
        </Text>
        <Pressable
          accessibilityLabel="Share invite"
          onPress={() => Share.share({ message: inviteMessage(username ?? undefined) }).catch(() => {})}
          hitSlop={6}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
        >
          <ShareIcon size={18} color={colors.white} strokeWidth={2} />
        </Pressable>
        <Pressable
          accessibilityLabel="Copy invite link"
          onPress={copy}
          style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.violet }}>{copied ? 'Copied' : 'Copy link'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
