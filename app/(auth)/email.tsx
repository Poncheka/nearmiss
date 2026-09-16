import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Body, Button, Display, IconButton, Screen, TextLink } from '@/components/ui';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors, fonts, radius } from '@/theme';

const inputStyle = {
  height: 56, borderRadius: radius.input, borderWidth: 1, borderColor: colors.inputBorder,
  paddingHorizontal: 16, fontSize: 18, fontFamily: fonts.regular, backgroundColor: colors.white, color: colors.ink,
} as const;

export default function EmailSignIn() {
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = async () => {
    if (!validEmail || busy) return;
    setBusy(true); setError('');
    try {
      await sendEmailCode(email);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true); setError('');
    try {
      await verifyEmailCode(email, value);
      // The root navigator moves on automatically once signed in.
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 22 }}>
          <IconButton label="Back" onPress={() => (step === 'code' ? (setStep('email'), setCode(''), setError('')) : router.back())}>
            <ChevronLeft size={20} color={colors.ink} />
          </IconButton>

          {step === 'email' ? (
            <View style={{ gap: 14 }}>
              <Display size={32}>What's your email?</Display>
              <Body size={16} color={colors.text2}>We'll send you a 6-digit code. No password needed.</Body>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={send}
                autoFocus
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.faint}
                style={inputStyle}
              />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Display size={32}>Check your email</Display>
              <Body size={16} color={colors.text2}>Enter the 6-digit code we sent to {email.trim()}.</Body>
              <TextInput
                value={code}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, '').slice(0, 6);
                  setCode(digits);
                  if (digits.length === 6) verify(digits);
                }}
                autoFocus
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder="123456"
                placeholderTextColor={colors.faint}
                style={[inputStyle, { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontFamily: fonts.semibold }]}
              />
              <TextLink label="Send a new code" size={15} onPress={send} style={{ alignSelf: 'center' }} />
            </View>
          )}

          {error ? <Body size={14} color={colors.danger}>{error}</Body> : null}
          <View style={{ flex: 1 }} />
          {busy ? (
            <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
          ) : step === 'email' ? (
            <Button label="Send code" onPress={send} variant={validEmail ? 'violet' : 'sand'} />
          ) : (
            <Button label="Continue" onPress={() => verify()} variant={code.length === 6 ? 'violet' : 'sand'} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
