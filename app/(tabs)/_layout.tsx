import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, UserPlus } from 'lucide-react-native';
import { OverlapIcon } from '@/components/art';
import { useAuth } from '@/lib/auth';
import { useScan } from '@/state/scan';
import { colors, fonts } from '@/theme';

const TABS: Record<string, { label: string; icon: (c: string) => React.ReactNode }> = {
  invite: { label: 'Invite', icon: (c) => <UserPlus size={24} color={c} strokeWidth={1.8} /> },
  index: { label: 'Near misses', icon: (c) => <OverlapIcon color={c} /> },
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
  const { demo } = useAuth();
  // Pick up newly eligible photos when the app opens (at most every 12 hours).
  useEffect(() => {
    if (demo) return;
    useScan.getState().autoScan();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') useScan.getState().autoScan(); });
    return () => sub.remove();
  }, [demo]);
  return (
    <Tabs initialRouteName="index" backBehavior="initialRoute" tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      {/* Near misses sits in the middle; the app still opens on it. */}
      <Tabs.Screen name="invite" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
