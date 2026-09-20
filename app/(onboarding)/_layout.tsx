import { Stack } from 'expo-router';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: 'scan' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="scan" options={{ gestureEnabled: false }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="find-friends" />
      {/* Last, and optional. It is also the only screen that marks onboarding finished, so
          every route through here has to end on it: both of its buttons call finishOnboarding,
          and nothing else does. */}
      <Stack.Screen name="turn-on-location" />
    </Stack>
  );
}
