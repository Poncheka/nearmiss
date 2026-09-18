import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Body, Button, Display, IconButton, ProgressDots, Screen } from '@/components/ui';
import { AvatarPicker } from '@/components/AvatarPicker';
import { colors, fonts, radius } from '@/theme';
import { errorMessage, useAuth } from '@/lib/auth';

function Field({ label, value, onChangeText, placeholder, prefix }: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; prefix?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Body size={14} weight="semibold" color={colors.muted} style={{ paddingLeft: 4 }}>{label}</Body>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 16, backgroundColor: colors.white }}>
        {prefix ? <Body size={17} color={colors.muted}>{prefix}</Body> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          autoCapitalize={prefix ? 'none' : 'sentences'}
          autoCorrect={!prefix}
          style={{ flex: 1, height: 50, fontSize: 17, fontFamily: fonts.regular, color: colors.ink }}
        />
      </View>
    </View>
  );
}

export default function Profile() {
  const { profile, saveProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const next = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await saveProfile({ username, name, bio });
      router.push('/find-friends');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <IconButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/scan'))}><ChevronLeft size={20} color={colors.ink} /></IconButton>
            <ProgressDots total={4} active={2} />
            <View style={{ width: 44 }} />
          </View>
          <Display size={32}>Make your profile</Display>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <AvatarPicker />
            <Body size={13} color={colors.muted}>Optional. You can add one later.</Body>
          </View>
          <View style={{ gap: 16 }}>
            <Field label="Username" value={username} onChangeText={(t) => setUsername(t.replace(/^@/, '').toLowerCase())} placeholder="yourname" prefix="@" />
            <Field label="Name" value={name} onChangeText={setName} placeholder="First name" />
            <Field label="Bio (optional)" value={bio} onChangeText={setBio} placeholder="SF. Always at the show." />
          </View>
          {error ? <Body size={14} color={colors.danger}>{error}</Body> : null}
          <View style={{ flex: 1 }} />
          {busy
            ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
            : <Button label="Continue" onPress={next} variant={username.length >= 3 ? 'violet' : 'sand'} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
