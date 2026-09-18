// "When did you two meet?"
//
// Without this, a couple's holidays look exactly like a string of near misses — three nights
// in Cannes, three metres apart. Knowing roughly when two people met is the one thing that
// separates "we almost crossed paths" from "we were on that trip together".
//
// Month and year is enough precision to split a feed, so this is built from the app's own
// components rather than a native date picker, which would mean a new build to install.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { Body, Button, Card, Display, IconButton, Screen, TextLink } from '@/components/ui';
import { useNearMisses } from '@/lib/nearMisses';
import { colors, fonts, pastel, radius } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Choice({ label, on, onPress, wide }: { label: string; on: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        minWidth: wide ? 78 : 56, paddingHorizontal: 14, height: 44, borderRadius: radius.pill,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? colors.violet : colors.white,
        borderWidth: 1, borderColor: on ? colors.violet : colors.inputBorder,
      }}
    >
      <Body size={15} weight="semibold" color={on ? colors.white : colors.ink}>{label}</Body>
    </Pressable>
  );
}

export default function WhenWeMet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const needs = useNearMisses((s) => s.needsMetOn.find((n) => n.friend_id === id));
  const setMetOn = useNearMisses((s) => s.setMetOn);
  const thisYear = new Date().getFullYear();

  // Offer every year from their oldest near miss to now — meeting before that is "always knew".
  const earliestYear = needs?.earliest ? new Date(needs.earliest).getFullYear() : thisYear - 10;
  const years = useMemo(
    () => Array.from({ length: thisYear - earliestYear + 1 }, (_, i) => thisYear - i),
    [earliestYear, thisYear],
  );

  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const name = needs?.name?.split(' ')[0] || (needs?.username ? `@${needs.username}` : 'them');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = async (date: string | null) => {
    if (busy || !id) return;
    setBusy(true);
    try {
      await setMetOn(id, date);
      back();
    } catch (e) {
      Alert.alert("Couldn't save that", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (year == null) return;
    // First of the chosen month; anything before it counts as before you met.
    const m = month == null ? 0 : month;
    save(`${year}-${String(m + 1).padStart(2, '0')}-01`);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <IconButton label="Back" onPress={back}><ChevronLeft size={20} color={colors.ink} /></IconButton>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 20 }}>
        <View style={{ gap: 10 }}>
          {needs?.avatar_url
            ? <Image source={{ uri: needs.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32 }} />
            : <Avatar initial={name.replace('@', '').charAt(0).toUpperCase()} color={pastel.peach} size={64} ring />}
          <Display size={34}>When did you and {name} meet?</Display>
          <Body size={17} color={colors.text2}>
            Roughly is fine. Times before this are the near misses worth knowing about. Times after
            it are usually days you already remember, so they go in their own section.
          </Body>
        </View>

        <View style={{ gap: 10 }}>
          <Body size={15} weight="bold">Year</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {years.map((y) => <Choice key={y} label={String(y)} wide on={year === y} onPress={() => setYear(y)} />)}
          </View>
        </View>

        {year != null && (
          <View style={{ gap: 10 }}>
            <Body size={15} weight="bold">Month <Body size={15} color={colors.muted}>(optional)</Body></Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTHS.map((m, i) => <Choice key={m} label={m} on={month === i} onPress={() => setMonth(month === i ? null : i)} />)}
            </View>
          </View>
        )}

        {busy
          ? <ActivityIndicator color={colors.violet} />
          : (
            <Button
              label={year == null ? 'Pick a year' : month == null ? `We met in ${year}` : `We met in ${MONTHS[month]} ${year}`}
              variant={year == null ? 'sand' : 'violet'}
              disabled={year == null}
              onPress={confirm}
            />
          )}

        <Card style={{ padding: 16, gap: 6 }}>
          <Body size={15} weight="bold">Not sure, or you've always known each other?</Body>
          <Body size={14} color={colors.muted}>
            Leave it unset and every near miss stays in one list. You can set it later from their profile.
          </Body>
          <View style={{ alignItems: 'flex-start', paddingTop: 4 }}>
            <TextLink label="Skip for now" onPress={back} />
          </View>
        </Card>

        {needs ? (
          <Body size={13} color={colors.faint} style={{ fontFamily: fonts.regular }}>
            {needs.near_miss_count} near {needs.near_miss_count === 1 ? 'miss' : 'misses'} so far, oldest in{' '}
            {new Date(needs.earliest).getFullYear()}.
          </Body>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
