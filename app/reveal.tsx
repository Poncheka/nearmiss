import { useEffect, useRef, useState } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { Body, Button, Chip, Display, IconButton, Screen } from '@/components/ui';
import { AvatarPair } from '@/components/avatar';
import { MiniMap } from '@/components/art';
import { nearMisses } from '@/data/mock';
import { isBeforeMet, useStore } from '@/state/store';
import { colors, radius } from '@/theme';

// The three near misses with Maya, oldest first.
const cards = ['fillmore', 'tartine', 'dolores'].map((id) => nearMisses.find((n) => n.id === id)!);
const spreads = [0.13, 0.3, 0.46];
const LAST = 4;

export default function Reveal() {
  const [step, setStep] = useState(0);
  const met = useStore((s) => s.met);
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [step, fade]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const next = () => (step < LAST ? setStep(step + 1) : router.replace({ pathname: '/near-miss/[id]', params: { id: 'fillmore' } }));
  const isCard = step >= 1 && step <= 3;
  const nm = cards[Math.max(0, step - 1)];
  const cta = ['Show me', 'Next', 'Next', 'Next', 'Send to Maya'][step];
  const secondary = step === LAST ? 'Share to story' : step === 0 ? 'Later' : 'See more';
  const onSecondary = step === LAST ? undefined : isCard
    ? () => router.replace({ pathname: '/near-miss/[id]', params: { id: nm.id } })
    : close;
  const anim = { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label="Close" onPress={close}><X size={18} color={colors.ink} strokeWidth={2} /></IconButton>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: 18, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.violet : colors.handle }} />
            ))}
          </View>
          <View style={{ width: 44 }} />
        </View>

        <Animated.View style={[{ flex: 1, justifyContent: 'center' }, anim]}>
          {step === 0 && (
            <View style={{ gap: 18 }}>
              <AvatarPair otherId="maya" size={72} />
              <Body size={18} color={colors.text2}>Maya just joined Near Miss</Body>
              <Display size={52} style={{ lineHeight: 52 }}>You two almost met 3 times.</Display>
              <Body size={18} color={colors.text2}>The first was 3 years before you actually met.</Body>
            </View>
          )}

          {isCard && (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label={`Near miss ${step} of 3`} tone="outline" />
                {isBeforeMet(met, nm) ? <Chip label="Before you met" tone="coral" /> : <Chip label="Since you met" tone="violet" />}
              </View>
              <Display size={38}>{nm.place}</Display>
              <Body size={17} color={colors.text2}>{nm.dateLong} · {nm.time}</Body>
              <View style={{ borderRadius: radius.cardLg, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder }}>
                <MiniMap width={width - 42} height={180} distance={nm.distance} spread={spreads[step - 1]} />
              </View>
              <Body size={18}>{nm.revealLine}</Body>
            </View>
          )}

          {step === LAST && (
            <View style={{ gap: 14 }}>
              <View style={{ borderRadius: 28, backgroundColor: colors.violet, paddingHorizontal: 22, paddingVertical: 24, gap: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Display size={18} style={{ color: colors.white }}>📍 near miss</Display>
                  <AvatarPair otherId="maya" size={36} />
                </View>
                <Display size={34} style={{ color: colors.white }}>Jeff and Maya were 22m apart at the Fillmore.</Display>
                <Body size={17} color="rgba(255,255,255,0.9)">March 4, 2016. Three years before they met.</Body>
                <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: 12 }}>
                  <Body size={14} color="rgba(255,255,255,0.75)">Who did you almost meet? · [domain]</Body>
                </View>
              </View>
              <Body size={14} color={colors.muted} style={{ textAlign: 'center' }}>Only the place and date are shared, never your path.</Body>
            </View>
          )}
        </Animated.View>

        <View style={{ gap: 8 }}>
          <Button label={cta} onPress={next} />
          <Button label={secondary} variant="white" onPress={onSecondary} />
        </View>
      </View>
    </Screen>
  );
}
