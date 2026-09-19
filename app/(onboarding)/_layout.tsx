import { Stack } from 'expo-router';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: 'scan' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="scan" options={{ gestureEnabled: false }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="find-friends" />
      {/* Location is no longer part of onboarding. Asking for someone's ongoing whereabouts in
          the first two minutes, before the app has shown them anything, is asking for trust it
          has not earned yet. It lives in Settings and we can ask again once it has. */}
      <Stack.Screen name="turn-on-location" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
