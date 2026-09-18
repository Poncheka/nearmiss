import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, MailCheck } from 'lucide-react-native';
import { Body, Button, Display, IconButton, IconTile, Screen, TextLink } from '@/components/ui';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors, fonts, radius } from '@/theme';

export default function EmailSignIn() {
  const { sendEmailCode: sendLink, linkError } = useAuth();
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = async (again = false) => {
    if (!validEmail || busy) return;
    setBusy(true); setError('');
    try {
      await sendLink(email);
      setStep('sent');
      setResent(again);
    } catch (e) {
      // Leaving the app mid-request (to go and read the email) cancels the fetch. That is
      // not a failure worth showing anyone in red.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancell?ed|aborted/i.test(msg)) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openMail = () => Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:').catch(() => {});
  // A link failure explains itself; a stale local error from a cancelled request does not.
  const shownError = linkError || error;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 22 }}>
          <IconButton label="Back" onPress={() => (step === 'sent' ? (setStep('email'), setError('')) : router.back())}>
            <ChevronLeft size={20} color={colors.ink} />
          </IconButton>

          {step === 'email' ? (
            <View style={{ gap: 14 }}>
              <Display size={32}>What's your email?</Display>
              <Body size={16} color={colors.text2}>We'll email you a sign-in link. No password needed.</Body>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => send()}
                autoFocus
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.faint}
                style={{ height: 56, borderRadius: radius.input, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: 16, fontSize: 18, fontFamily: fonts.regular, backgroundColor: colors.white, color: colors.ink }}
              />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <IconTile size={64} radiusSize={20}><MailCheck size={30} color={colors.violet} strokeWidth={1.8} /></IconTile>
              <Display size={32}>Check your email</Display>
              <Body size={16} color={colors.text2}>
                We sent a sign-in link to <Body size={16} weight="semibold">{email.trim()}</Body>. Open it on this phone and tap the link. It brings you right back here, signed in.
              </Body>
              <Body size={14} color={colors.muted}>{resent ? 'Sent again. ' : ''}The link works once and expires after an hour. Check spam if you don't see it.</Body>
            </View>
          )}

          {shownError ? <Body size={14} color={colors.danger}>{shownError}</Body> : null}
          <View style={{ flex: 1 }} />
          {busy ? (
            <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
          ) : step === 'email' ? (
            <Button label="Email me a link" onPress={() => send()} variant={validEmail ? 'violet' : 'sand'} />
          ) : (
            <View style={{ gap: 4 }}>
              <Button label="Open Mail" onPress={openMail} />
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
                <TextLink label="Send again" size={15} onPress={() => send(true)} />
                <TextLink label="Use a different email" size={15} onPress={() => { setStep('email'); setError(''); }} />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
