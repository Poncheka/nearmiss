import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronLeft, House, Lock, ShieldCheck } from 'lucide-react-native';
import { Body, Button, Card, Display, IconButton, IconTile, ProgressDots, Screen } from '@/components/ui';
import { ScanArt } from '@/components/art';
import { colors } from '@/theme';

const TOTAL = 4212;
type Step = 'intro' | 'scanning' | 'done';

function Point({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconTile size={30} radiusSize={10}>{icon}</IconTile>
      <Body size={15} weight="semibold">{label}</Body>
    </View>
  );
}

export default function Scan() {
  const [step, setStep] = useState<Step>('intro');
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulated scan. Step 3 of the build replaces this with expo-media-library.
  const start = () => {
    setStep('scanning');
    setCount(0);
    timer.current = setInterval(() => {
      setCount((c) => {
        const n = Math.min(TOTAL, c + 157);
        if (n >= TOTAL) {
          if (timer.current) clearInterval(timer.current);
          setStep('done');
        }
        return n;
      });
    }, 90);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const back = () => {
    if (step === 'intro') return router.back();
    if (timer.current) clearInterval(timer.current);
    setStep('intro');
    setCount(0);
  };
  const next = () => router.push('/find-friends');
  const pct = Math.round((count / TOTAL) * 100);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <ProgressDots total={3} active={2} />
          <View style={{ width: 44 }} />
        </View>

        {step === 'intro' && (
          <View style={{ flex: 1, gap: 18 }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ScanArt />
            </View>
            <View style={{ gap: 10 }}>
              <Display size={34}>Scan your photos</Display>
              <Body size={17} color={colors.text2}>We use where and when they were taken to find your near misses.</Body>
            </View>
            <View style={{ gap: 10 }}>
              <Point icon={<Lock size={16} color={colors.violet} strokeWidth={2.2} />} label="Photos stay on your phone" />
              <Point icon={<ShieldCheck size={16} color={colors.violet} strokeWidth={2.2} />} label="Never shared without asking you" />
              <Point icon={<House size={16} color={colors.violet} strokeWidth={2.2} />} label="Home and work are skipped" />
            </View>
            <View style={{ gap: 4 }}>
              <Button label="Scan my photos" onPress={start} />
              <Body size={13} color={colors.muted} style={{ textAlign: 'center', paddingTop: 4 }}>Choose "Allow Full Access" when asked</Body>
              <Button label="Skip for now" variant="text" onPress={next} />
            </View>
          </View>
        )}

        {step === 'scanning' && (
          <View style={{ flex: 1, gap: 14, justifyContent: 'center', alignItems: 'center' }}>
            <Display size={64} style={{ lineHeight: 66 }}>{count.toLocaleString('en-US')}</Display>
            <Body size={17} color={colors.text2}>of {TOTAL.toLocaleString('en-US')} photos scanned</Body>
            <View style={{ width: '100%', height: 12, borderRadius: 6, backgroundColor: colors.inputBorder, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.violet, borderRadius: 6 }} />
            </View>
            <Card style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
              <Body size={15} color={colors.muted}>With a location</Body>
              <Body size={15} weight="bold">{Math.round(count * 0.698).toLocaleString('en-US')}</Body>
            </Card>
            <Body size={14} color={colors.muted} style={{ textAlign: 'center' }}>Oldest so far: Aug 2013, San Francisco. You can close the app and we'll keep going.</Body>
          </View>
        )}

        {step === 'done' && (
          <View style={{ flex: 1, gap: 18 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color={colors.white} strokeWidth={2.6} />
            </View>
            <Display size={32}>2,941 photos with a time and place</Display>
            <Body size={17} color={colors.text2}>From 2013 to today. That's plenty to find near misses.</Body>
            <Card style={{ padding: 16, gap: 6 }}>
              <Body size={17} weight="bold">Next: find your friends</Body>
              <Body size={15} color={colors.text2}>Near misses appear when friends join and scan their photos too. Photos from the last 30 days are never matched.</Body>
            </Card>
            <View style={{ flex: 1 }} />
            <View style={{ gap: 4 }}>
              <Button label="Continue" onPress={next} />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
