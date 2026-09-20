// The bell, with its count.
//
// It used to live only on the feed, which meant that finding out someone had replied depended on
// which tab you happened to be standing on. Notifications are not a property of one screen, so
// this goes in the header of all three.
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { IconButton } from '@/components/ui';
import { useActivity } from '@/lib/activity';
import { useContacts } from '@/lib/contacts';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/state/store';
import { activity as demoActivity } from '@/data/mock';
import { colors, fonts } from '@/theme';

export function ActivityButton() {
  const { demo } = useAuth();
  const realUnread = useActivity((s) => s.unread);
  const demoRead = useStore((s) => s.activityRead);
  // Contacts who have turned up are only known to this phone, so they are counted here rather
  // than coming back from the server with everything else. Without this the bell stays quiet and
  // the one place that shows them is the one place nobody is told to look.
  const arrivals = useContacts((st) => st.arrivals.length);
  const unread = demo
    ? (demoRead ? 0 : demoActivity.filter((a) => a.fresh).length)
    : realUnread + arrivals;

  return (
    <View>
      <IconButton label="Activity" onPress={() => router.push('/activity')}>
        <Bell size={20} color={colors.ink} strokeWidth={1.8} />
      </IconButton>
      {unread > 0 && (
        <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.violet, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.white }}>{unread}</Text>
        </View>
      )}
    </View>
  );
}
