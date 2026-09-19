// Editing who you are.
//
// Until now the only chance to set your name, username and bio was during signup, and for anyone
// who signed in with Google the name was whatever Google had on file. Jeff went by Jeff and the
// app called him Jeffrey with no way to argue.
//
// All three fields go through saveProfile, which already validates the username and turns a
// collision into something you can read.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { AvatarPicker } from '@/components/AvatarPicker';
import { Body, Button, Card, Display, IconButton, Screen, SectionLabel } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius } from '@/theme';

const NAME_MAX = 40;
const BIO_MAX = 160;

function Field({
  label, value, onChangeText, placeholder, prefix, hint, autoCapitalize = 'sentences', maxLength, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  prefix?: string;
  hint?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <SectionLabel>{label}</SectionLabel>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', paddingHorizontal: 16, borderRadius: radius.card, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder }}>
        {prefix ? <Body size={16} color={colors.muted}>{prefix}</Body> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          multiline={multiline}
          style={{
            flex: 1, minHeight: multiline ? 88 : 50, paddingVertical: multiline ? 14 : 0,
            fontFamily: fonts.regular, fontSize: 16, color: colors.ink,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
      </View>
      {hint ? <Body size={13} color={colors.muted}>{hint}</Body> : null}
    </View>
  );
}

export default function EditProfile() {
  const { profile, saveProfile } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed from the profile once it has arrived, but never overwrite something being typed.
  useEffect(() => {
    if (!profile) return;
    setName((n) => (n ? n : profile.name ?? ''));
    setUsername((u) => (u ? u : profile.username ?? ''));
    setBio((b) => (b ? b : profile.bio ?? ''));
  }, [profile]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  const dirtyName = name.trim() !== (profile?.name ?? '');
  const dirtyBio = bio.trim() !== (profile?.bio ?? '');
  const dirtyUsername = username.trim().toLowerCase() !== (profile?.username ?? '').toLowerCase();
  const dirty = dirtyName || dirtyBio || dirtyUsername;

  const save = async () => {
    if (!dirty || saving) return;
    if (!name.trim()) return Alert.alert('Your name is empty', 'This is what friends see above your near misses.');
    setSaving(true);
    try {
      // One call for all three. saveProfile already checks the username shape and turns a
      // collision into a sentence, so there is no second path to keep in step with it.
      await saveProfile({ username: username.trim(), name: name.trim(), bio: bio.trim() });
      back();
    } catch (e) {
      Alert.alert("Couldn't save that", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <Body size={16} weight="bold">Edit profile</Body>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Card style={{ padding: 20, alignItems: 'center', gap: 6 }}>
            <AvatarPicker size={88} showLink />
          </Card>

          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Jeff"
            autoCapitalize="words"
            maxLength={NAME_MAX}
            hint="What friends see above your near misses. Whatever you actually go by."
          />

          <Field
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            placeholder="jeff"
            prefix="@"
            autoCapitalize="none"
            maxLength={24}
            hint="How people find you if they don't have your number. 3 to 24 characters."
          />

          <Field
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="LA. Always at the show."
            maxLength={BIO_MAX}
            multiline
            hint={`${BIO_MAX - bio.length} left`}
          />

          <View style={{ paddingTop: 4 }}>
            {saving
              ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
              : <Button label={dirty ? 'Save' : 'Saved'} variant={dirty ? 'violet' : 'sand'} onPress={save} />}
          </View>

          <Pressable onPress={back} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Body size={15} color={colors.muted}>Cancel</Body>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
