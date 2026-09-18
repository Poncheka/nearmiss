import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Body, Button, Card, Display, IconButton, Screen, TextLink } from '@/components/ui';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors, fonts, radius } from '@/theme';

const GOES = ['Your scanned photo places', 'Your near misses', 'Your profile and friends'];

export default function DeleteAccount() {
  const { profile, demo, deleteAccount } = useAuth();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = (profile?.username ?? '').toLowerCase();
  const matches = typed.trim().replace(/^@/, '').toLowerCase() === handle && handle.length > 0;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  const confirm = () => Alert.alert(
    'Delete your account?',
    'This removes everything straight away and cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
            // The account is gone, so the app drops back to the welcome screen on its own.
          } catch (e) {
            setBusy(false);
            Alert.alert("Couldn't delete your account", errorMessage(e));
          }
        },
      },
    ],
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Display size={34}>Delete your account</Display>
          <Body size={17} color={colors.text2}>Permanent, and right away. Your photos stay on your phone.</Body>

          <Card style={{ padding: 16, gap: 8 }}>
            <Body size={15} weight="bold">Deletes</Body>
            {GOES.map((g) => (
              <View key={g} style={{ flexDirection: 'row', gap: 10 }}>
                <Body size={15} color={colors.faint}>·</Body>
                <Body size={15} color={colors.text2} style={{ flex: 1 }}>{g}</Body>
              </View>
            ))}
          </Card>

          {demo ? (
            <Body size={15} color={colors.muted}>Sample data. There's no account to delete.</Body>
          ) : (
            <>
              <View style={{ gap: 8 }}>
                <Body size={15} weight="semibold">Type <Body size={15} weight="bold" color={colors.danger}>{handle || 'your username'}</Body> to confirm</Body>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={handle}
                  placeholderTextColor={colors.faint}
                  editable={!busy}
                  style={{
                    minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 20,
                    backgroundColor: colors.inputBg, borderWidth: 1,
                    borderColor: matches ? colors.danger : colors.inputBorder,
                    fontFamily: fonts.regular, fontSize: 17, color: colors.ink,
                  }}
                />
              </View>

              {busy ? (
                <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
                  <ActivityIndicator color={colors.danger} />
                  <Body size={14} color={colors.muted}>Deleting everything…</Body>
                </View>
              ) : (
                <Button label="Delete my account" variant={matches ? 'danger' : 'sand'} disabled={!matches} onPress={confirm} />
              )}
            </>
          )}

          <View style={{ alignItems: 'center' }}>
            <TextLink label="Keep my account" onPress={back} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
