import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronLeft, House, ImageOff, Lock, ShieldCheck } from 'lucide-react-native';
import { Body, Button, Card, Display, IconButton, IconTile, ProgressDots, Screen, TextLink } from '@/components/ui';
import { ScanArt } from '@/components/art';
import { useAuth } from '@/lib/auth';
import { Access, choosePhotos, getPhotoAccess, requestPhotoAccess } from '@/lib/photoScan';
import { useScan } from '@/state/scan';
import { colors } from '@/theme';

type Step = 'intro' | 'denied' | 'scanning' | 'done';

const fmt = (n: number) => n.toLocaleString('en-US');
const monthYear = (ms: number | null) => (ms == null ? null : new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

// flex: 1 on the text, because without it a label longer than the row ran off the screen
// instead of wrapping, and the last word of two of these was invisible on a narrow phone.
function Point({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconTile size={30} radiusSize={10}>{icon}</IconTile>
      <Body size={15} weight="semibold" style={{ flex: 1 }}>{label}</Body>
    </View>
  );
}

// Sample-data mode has no account to save to, so it plays a pretend scan.
function useDemoScan() {
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = (onDone: () => void) => {
    setCount(0);
    timer.current = setInterval(() => {
      setCount((c) => {
        const n = Math.min(4212, c + 157);
        if (n >= 4212) { if (timer.current) clearInterval(timer.current); onDone(); }
        return n;
      });
    }, 60);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  return { count, start, stop: () => timer.current && clearInterval(timer.current) };
}

export default function Scan() {
  const { demo, signOut } = useAuth();
  const scan = useScan();
  const demoScan = useDemoScan();
  const [access, setAccess] = useState<Access | null>(null);
  const [step, setStep] = useState<Step>(() => (useScan.getState().running ? 'scanning' : useScan.getState().result ? 'done' : 'intro'));

  useEffect(() => { getPhotoAccess().then(setAccess).catch(() => setAccess('unavailable')); }, []);
  useEffect(() => {
    if (step === 'scanning' && !demo && !scan.running && (scan.result || scan.error)) setStep(scan.error ? 'intro' : 'done');
  }, [step, demo, scan.running, scan.result, scan.error]);

  const begin = async () => {
    if (demo) {
      setStep('scanning');
      demoScan.start(() => setStep('done'));
      return;
    }
    const a = access === 'granted' || access === 'limited' ? access : await requestPhotoAccess();
    setAccess(a);
    if (a === 'denied' || a === 'undetermined') return setStep('denied');
    if (a === 'unavailable') return;
    setStep('scanning');
    scan.start();
  };

  const back = () => {
    if (step === 'intro') return signOut();
    if (step === 'scanning') { scan.stop(); demoScan.stop(); }
    setStep('intro');
  };
  const next = () => router.push('/profile');

  const p = scan.progress;
  const total = demo ? 4212 : p?.total ?? 0;
  const scanned = demo ? demoScan.count : Math.min(p?.scanned ?? 0, total || Infinity);
  const withLocation = demo ? Math.round(demoScan.count * 0.698) : p?.withLocation ?? 0;
  const pct = total ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
  const status = demo ? 'Reading your photos' : ({
    counting: 'Counting your photos…',
    reading: 'Reading where and when…',
    saving: 'Saving places and times…',
    grouping: 'Grouping into moments…',
    done: 'Done',
  } as const)[p?.phase ?? 'counting'];

  const r = scan.result;
  const doneCount = demo ? 2941 : r?.withLocation ?? 0;
  const oldest = demo ? 'Aug 2013' : monthYear(r?.oldest ?? null);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton label={step === 'intro' ? 'Sign out' : 'Back'} onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
          <ProgressDots total={3} active={1} />
          <View style={{ width: 44 }} />
        </View>

        {step === 'intro' && (
          <View style={{ flex: 1, gap: 18 }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ScanArt />
            </View>
            <View style={{ gap: 10 }}>
              <Display size={34}>Link your photo data, not your photos</Display>
              <Body size={17} color={colors.text2}>
                We use the time and location attached to your photos to find when you and your
                friends were nearby.
              </Body>
            </View>
            <View style={{ gap: 10 }}>
              <Point icon={<Lock size={16} color={colors.violet} strokeWidth={2.2} />} label="Time and location finds the match" />
              <Point icon={<ImageOff size={16} color={colors.violet} strokeWidth={2.2} />} label="You can privately review photos from that moment" />
              <Point icon={<Check size={16} color={colors.violet} strokeWidth={2.2} />} label="You choose what, if anything, gets shared" />
            </View>
            {scan.error ? <Body size={14} color={colors.danger}>{scan.error}</Body> : null}
            {access === 'unavailable' && !demo ? (
              <Card style={{ padding: 14 }}>
                <Body size={15} color={colors.text2}>Photo scanning works in the Near Miss app on your phone. You can skip this for now.</Body>
              </Card>
            ) : null}
            <View style={{ gap: 4 }}>
              {access !== 'unavailable' || demo ? <Button label={scan.error ? 'Try again' : 'Find my near misses'} onPress={begin} /> : null}
              {access !== 'granted' && access !== 'unavailable' && (
                <Body size={13} color={colors.muted} style={{ textAlign: 'center', paddingTop: 4 }}>
                  Choose Full Access so we can read every date and place
                </Body>
              )}
              <Button label="Skip for now" variant="text" onPress={next} />
            </View>
          </View>
        )}

        {step === 'denied' && (
          <View style={{ flex: 1, gap: 18 }}>
            <IconTile size={64} radiusSize={32}><ImageOff size={28} color={colors.violet} strokeWidth={2} /></IconTile>
            <Display size={32}>Near Miss can't see your photos yet</Display>
            <Body size={17} color={colors.text2}>Open Settings, tap Photos, and choose Full Access. Then come back here.</Body>
            <View style={{ flex: 1 }} />
            <View style={{ gap: 4 }}>
              <Button label="Open Settings" onPress={() => Linking.openSettings()} />
              <Button label="I've turned it on" variant="white" onPress={begin} />
              <Button label="Skip for now" variant="text" onPress={next} />
            </View>
          </View>
        )}

        {step === 'scanning' && (
          <View style={{ flex: 1, gap: 14, justifyContent: 'center', alignItems: 'center' }}>
            <Display size={64} style={{ lineHeight: 66 }}>{fmt(scanned)}</Display>
            <Body size={17} color={colors.text2}>{total ? `of ${fmt(total)} photos` : status}</Body>
            <View style={{ width: '100%', height: 12, borderRadius: 6, backgroundColor: colors.inputBorder, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.violet, borderRadius: 6 }} />
            </View>
            <Card style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
              <Body size={15} color={colors.muted}>With a time and place</Body>
              <Body size={15} weight="bold">{fmt(withLocation)}</Body>
            </Card>
            <Body size={14} color={colors.muted} style={{ textAlign: 'center' }}>
              {status}{!demo && p?.oldest ? ` Back to ${monthYear(p.oldest)}.` : ''}
            </Body>
            {access === 'limited' && (
              <Card style={{ width: '100%', padding: 14, gap: 6 }}>
                <Body size={15} color={colors.text2}>You shared only some photos, so we can only look at those.</Body>
                <TextLink label="Choose more photos" size={15} onPress={choosePhotos} />
              </Card>
            )}
            <View style={{ width: '100%', gap: 4, paddingTop: 8 }}>
              <Button label="Keep going while I make my profile" variant="white" onPress={next} />
            </View>
          </View>
        )}

        {step === 'done' && (
          <View style={{ flex: 1, gap: 18 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' }}>
              <Check size={30} color={colors.white} strokeWidth={2.6} />
            </View>
            {doneCount > 0 ? (
              <>
                <Display size={32}>{fmt(doneCount)} photos with a time and place</Display>
                <Body size={17} color={colors.text2}>
                  {oldest ? `Going back to ${oldest}. ` : ''}
                  {!demo && r ? `Grouped into ${fmt(r.moments)} moments.` : "That's plenty to find near misses."}
                </Body>
              </>
            ) : (
              <>
                <Display size={32}>No photos with a place yet</Display>
                <Body size={17} color={colors.text2}>
                  We didn't find photos older than 30 days with location on. Turn on Location for the Camera app and your future photos will count.
                </Body>
              </>
            )}
            <Card style={{ padding: 16, gap: 6 }}>
              <Body size={17} weight="bold">Next: make your profile</Body>
              <Body size={15} color={colors.text2}>Near misses appear when friends join and scan their photos too.</Body>
            </Card>
            <View style={{ flex: 1 }} />
            <Button label="Continue" onPress={next} />
          </View>
        )}
      </View>
    </Screen>
  );
}
