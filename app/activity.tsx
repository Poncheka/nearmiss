import { Pressable, ScrollView, View } from 'react-native';
import { Href, router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Body, Card, Divider, IconButton, Pill, Screen, SectionLabel, TextLink } from '@/components/ui';
import { Avatar, PersonAvatar } from '@/components/avatar';
import { activity, activityBadge, ActivityItem } from '@/data/mock';
import { useStore } from '@/state/store';
import { colors } from '@/theme';

function ActivityRow({ item, unread, last }: { item: ActivityItem; unread: boolean; last: boolean }) {
  const go = () => router.push(item.href as Href);
  return (
    <>
      <Pressable onPress={go} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14 }}>
        <View>
          {item.personId === 'app'
            ? <Avatar initial="📍" color={colors.violetTint} size={44} />
            : <PersonAvatar id={item.personId} size={44} />}
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: activityBadge[item.kind], borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Body size={15}>
            <Body size={15} weight="bold">{item.who}</Body> {item.text}
          </Body>
          {item.quote ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: colors.bg }}>
              <Body size={14} color={colors.text2}>{item.quote}</Body>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2 }}>
            <Body size={13} color={colors.muted}>{item.when}</Body>
            {item.action ? <Pill label={item.action} height={32} textSize={13} onPress={go} /> : null}
          </View>
        </View>
        {unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.violet, marginTop: 6 }} />}
      </Pressable>
      {!last && <Divider />}
    </>
  );
}

export default function Activity() {
  const read = useStore((s) => s.activityRead);
  const markRead = useStore((s) => s.markActivityRead);
  const fresh = activity.filter((a) => a.fresh);
  const earlier = activity.filter((a) => !a.fresh);

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton label="Back" onPress={() => router.back()}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        <Body size={16} weight="bold">Activity</Body>
        <TextLink label={read ? 'All read' : 'Mark read'} size={15} onPress={markRead} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {[{ title: 'New', items: fresh }, { title: 'Earlier this week', items: earlier }].map((g) => (
          <View key={g.title}>
            <SectionLabel>{g.title}</SectionLabel>
            <Card style={{ paddingHorizontal: 14 }}>
              {g.items.map((it, i) => (
                <ActivityRow key={it.id} item={it} unread={!read && !!it.fresh} last={i === g.items.length - 1} />
              ))}
            </Card>
          </View>
        ))}
        <Body size={13} color={colors.muted} style={{ textAlign: 'center', paddingTop: 18 }}>New near misses come in your weekly report, not one by one.</Body>
      </ScrollView>
    </Screen>
  );
}
