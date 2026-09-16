import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Camera, ChevronLeft } from 'lucide-react-native';
import { Body, Button, Display, IconButton, ProgressDots, Screen, TextLink } from '@/components/ui';
import { colors, fonts, radius } from '@/theme';

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Body size={14} weight="semibold" color={colors.muted} style={{ paddingLeft: 4 }}>{label}</Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        style={{ height: 52, borderRadius: radius.input, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 16, fontSize: 17, fontFamily: fonts.regular, backgroundColor: colors.white, color: colors.ink }}
      />
    </View>
  );
}

export default function Profile() {
  const [username, setUsername] = useState('@jeff');
  const [name, setName] = useState('Jeff');
  const [bio, setBio] = useState('');
  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <IconButton label="Back" onPress={() => router.back()}><ChevronLeft size={20} color={colors.ink} /></IconButton>
            <ProgressDots total={3} active={1} />
            <View style={{ width: 44 }} />
          </View>
          <Display size={32}>Make your profile</Display>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Pressable accessibilityLabel="Add photo" style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.white, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.toggleOff, alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={30} color={colors.muted} strokeWidth={1.6} />
            </Pressable>
            <TextLink label="Add photo" />
            <Body size={13} color={colors.muted}>We'll use your Apple or Google photo if you have one</Body>
          </View>
          <View style={{ gap: 16 }}>
            <Field label="Username" value={username} onChangeText={setUsername} />
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Bio (optional)" value={bio} onChangeText={setBio} placeholder="SF. Always at the show." />
          </View>
          <View style={{ flex: 1 }} />
          <Button label="Continue" onPress={() => router.push('/scan')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
