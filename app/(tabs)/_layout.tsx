import { Pressable, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Users } from 'lucide-react-native';
import { OverlapIcon } from '@/components/art';
import { useStore } from '@/state/store';
import { colors, fonts } from '@/theme';

const TABS: Record<string, { label: string; icon: (c: string) => React.ReactNode }> = {
  index: { label: 'Near misses', icon: (c) => <OverlapIcon color={c} /> },
  friends: { label: 'Friends', icon: (c) => <Users size={24} color={c} strokeWidth={1.8} /> },
  you: { label: 'You', icon: (c) => <User size={24} color={c} strokeWidth={1.8} /> },
};

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.inputBorder }}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const color = focused ? colors.ink : colors.faint;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            {tab.icon(color)}
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const onboarded = useStore((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
