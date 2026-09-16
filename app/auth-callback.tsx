import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Body } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

// Sign-in links land here. The auth provider reads the tokens from the link and signs you in,
// then we hand off to onboarding or the app.
export default function AuthCallback() {
  const { signedIn, linkError } = useAuth();
  if (signedIn) return <Redirect href="/" />;
  if (linkError) return <Redirect href="/email" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.violet} />
      <Body size={15} color={colors.muted}>Signing you in…</Body>
    </View>
  );
}
