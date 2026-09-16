import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { PersonAvatar } from '@/components/avatar';
import { TextLink } from '@/components/ui';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors } from '@/theme';

/** Tap the circle (or the link) to choose a profile photo from your library. */
export function AvatarPicker({ size = 104, showLink = true }: { size?: number; showLink?: boolean }) {
  const { profile, uploadAvatar } = useAuth();
  const [busy, setBusy] = useState(false);
  const url = profile?.avatar_url;

  const pick = async () => {
    if (busy) return;
    try {
      // The system photo picker doesn't need library permission.
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        shape: 'oval',
        quality: 0.7,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setBusy(true);
      const a = res.assets[0];
      await uploadAvatar({ uri: a.uri, mimeType: a.mimeType });
    } catch (e) {
      console.warn('Avatar upload failed', e);
      Alert.alert("Couldn't add your photo", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={url ? 'Change photo' : 'Add photo'}
        onPress={pick}
        style={{
          width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
          backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
          borderWidth: url || !showLink ? 0 : 2, borderStyle: 'dashed', borderColor: colors.toggleOff,
        }}
      >
        {url
          ? <Image source={{ uri: url }} style={{ width: size, height: size }} />
          : showLink
            ? <Camera size={size * 0.29} color={colors.muted} strokeWidth={1.6} />
            : <PersonAvatar id="jeff" size={size} />}
        {busy && (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.violet} />
          </View>
        )}
      </Pressable>
      {!showLink && !url && (
        <View pointerEvents="none" style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.violet, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Camera size={12} color={colors.white} strokeWidth={2.2} />
        </View>
      )}
      {showLink && <TextLink label={url ? 'Change photo' : 'Add photo'} onPress={pick} />}
    </View>
  );
}
