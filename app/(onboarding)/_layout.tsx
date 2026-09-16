import { Stack } from 'expo-router';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: 'profile' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="profile" options={{ gestureEnabled: false }} />
      <Stack.Screen name="scan" />
      <Stack.Screen name="find-friends" />
    </Stack>
  );
}
