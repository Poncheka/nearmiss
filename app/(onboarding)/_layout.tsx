import { Stack } from 'expo-router';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: 'scan' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="scan" options={{ gestureEnabled: false }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="find-friends" />
      <Stack.Screen name="turn-on-location" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
