// Your birthday, month and day only.
//
// It exists for one reason: so a near miss that landed on it says so. "You were 40m apart on
// June 4th" is a fact; "on your birthday" is a story, and the birthday one is the one people
// tell each other about.
//
// No year is asked for, because no part of the app needs to know your age. Built from the app's
// own components rather than a native date picker, which would mean another build to install.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Cake, ChevronLeft } from 'lucide-react-native';
import { Body, Button, Card, Display, IconButton, IconTile, Screen, TextLink } from '@/components/ui';
import { errorMessage, useAuth } from '@/lib/auth';
import { colors, radius } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// A leap year, so 29 February can be chosen.
const DAYS_IN = (m: number) => new Date(2024, m, 0).getDate();

function Choice({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        minWidth: wide ? 56 : 44, paddingHorizontal: 12, height: 44, borderRadius: radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? colors.violet : colors.white,
        borderWidth: 1, borderColor: on ? colors.violet : colors.inputBorder,
      }}
    >
      <Body size={15} weight="semibold" color={on ? colors.white : colors.ink}>{label}</Body>
    </Pressable>
  );
}

export default function Birthday() {
  const { profile, saveProfile } = useAuth();

  const saved = useMemo(() => {
    const m = profile?.birthday?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? { month: Number(m[2]), day: Number(m[3]) } : null;
  }, [profile?.birthday]);

  const [month, setMonth] = useState<number | null>(saved?.month ?? null);
  const [day, setDay] = useState<number | null>(saved?.day ?? null);
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  const store = async (value: string | null) => {
    if (busy || !profile) return;
    setBusy(true);
    try {
      await saveProfile({
        username: profile.username ?? '',
        name: profile.name ?? '',
        bio: profile.bio ?? '',
        birthday: value,
      });
      back();
    } catch (e) {
      Alert.alert("Couldn't save that", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // A fixed year nobody reads. Only the month and day are ever used.
  const save = () => (month && day ? store(`2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`) : undefined);

  const maxDay = month ? DAYS_IN(month) : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 18 }}>
        <IconTile bg={colors.greenTint} size={52} radiusSize={18}>
          <Cake size={24} color={colors.ink} strokeWidth={2} />
        </IconTile>
        <Display size={32}>Your birthday</Display>
        <Body size={17} color={colors.text2}>
          Near misses that landed on it get marked. Your friends see the day, never the year, and
          nothing else in the app uses it.
        </Body>

        <Card style={{ padding: 16, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Body size={14} weight="semibold" color={colors.muted}>Month</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTHS.map((label, i) => (
                <Choice
                  key={label}
                  label={label}
                  wide
                  on={month === i + 1}
                  onPress={() => {
                    setMonth(i + 1);
                    if (day && day > DAYS_IN(i + 1)) setDay(null);
                  }}
                />
              ))}
            </View>
          </View>

          {month ? (
            <View style={{ gap: 8 }}>
              <Body size={14} weight="semibold" color={colors.muted}>Day</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {days.map((d) => (
                  <Choice key={d} label={String(d)} on={day === d} onPress={() => setDay(d)} />
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        {busy
          ? <View style={{ height: 54, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.violet} /></View>
          : <Button
              label={month && day ? `Save ${LONG[month - 1]} ${day}` : 'Pick a month and day'}
              variant={month && day ? 'violet' : 'sand'}
              onPress={save}
            />}

        {profile?.birthday ? (
          <View style={{ alignItems: 'center' }}>
            <TextLink label="Remove my birthday" color={colors.danger} onPress={() => store(null)} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
